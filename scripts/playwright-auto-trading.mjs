/**
 * playwright-auto-trading.mjs
 * 자동매매 UI 기능 테스트 — 모델 생성 다이얼로그 + 설정 화면
 *
 * 실행: node scripts/playwright-auto-trading.mjs
 * 전제: 개발 서버가 http://localhost:5173 에서 실행 중이어야 합니다.
 *       로그인이 필요한 경우 TEST_EMAIL / TEST_PASSWORD 환경변수 설정.
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const EMAIL    = process.env.TEST_EMAIL    || 'test@test.com';
const PASSWORD = process.env.TEST_PASSWORD || '12345678';

let passed = 0;
let failed = 0;

function ok(name) {
  console.log(`  ✅ ${name}`);
  passed++;
}

function fail(name, reason) {
  console.error(`  ❌ ${name}: ${reason}`);
  failed++;
}

/** API로 테스트 계정을 사전 등록 (이미 있으면 무시) */
async function ensureTestAccount() {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'Playwright Test' }),
    });
    if (res.ok) {
      console.log('  ℹ️  테스트 계정 등록 완료');
    } else {
      const body = await res.json().catch(() => ({}));
      // 이미 존재하는 경우는 정상
      if (!body.error?.includes('already') && res.status !== 409) {
        console.log(`  ℹ️  계정 등록 응답 (${res.status}): ${JSON.stringify(body).slice(0, 100)}`);
      }
    }
  } catch (e) {
    console.log(`  ⚠️  계정 사전 등록 실패 (무시): ${e.message}`);
  }
}

async function login(page) {
  await ensureTestAccount();

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  const emailInput = page.locator('[data-testid="input-email"]');
  const loginFormVisible = await emailInput.isVisible({ timeout: 15000 }).catch(() => false);
  if (!loginFormVisible) {
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error(`login form not visible on /login (url=${currentUrl})`);
    }
    console.log('  [INFO] already authenticated session detected');
    return;
  }

  await emailInput.fill(EMAIL);
  await page.locator('[data-testid="input-password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();

  await page.waitForFunction(
    () => !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register'),
    { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(500);
  console.log(`  [INFO] login result URL: ${page.url()}`);

  if (page.url().includes('/login')) {
    throw new Error(`login failed for ${EMAIL}`);
  }
}
// ─────────────────────────────────────────────────────────────
// TC-1: 모델 생성 다이얼로그 — modelType 변경 시 설명 업데이트
// ─────────────────────────────────────────────────────────────
async function testModelTypeDescription(page) {
  console.log('\n[TC-1] 모델 생성 다이얼로그 — 전략 유형 설명 업데이트');

  await page.goto(`${BASE_URL}/auto-trading`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const createBtn = page.locator('[data-testid="button-create-model"]');
  if (!(await createBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    fail('다이얼로그 열기', '모델 생성 버튼 없음 — 로그인 또는 페이지 구조 확인 필요');
    return;
  }
  await createBtn.click();
  await page.waitForTimeout(300);

  const typeSelect = page.locator('[data-testid="select-model-type"]');
  if (!(await typeSelect.isVisible({ timeout: 3000 }).catch(() => false))) {
    fail('전략 유형 셀렉터', '셀렉터 없음');
    return;
  }

  const descBox = page.locator('[data-testid="model-type-description"]');

  // momentum 선택
  await typeSelect.click();
  await page.locator('[role="option"]').filter({ hasText: '모멘텀' }).click();
  await page.waitForTimeout(200);
  const momentumText = await descBox.textContent().catch(() => '');
  if (momentumText.includes('거래량') || momentumText.includes('추종')) {
    ok('momentum 선택 → 설명 표시');
  } else {
    fail('momentum 설명', `예상 텍스트 없음: "${momentumText.slice(0, 80)}"`);
  }

  // value 선택
  await typeSelect.click();
  await page.locator('[role="option"]').filter({ hasText: '가치투자' }).click();
  await page.waitForTimeout(200);
  const valueText = await descBox.textContent().catch(() => '');
  if (valueText.includes('재무') || valueText.includes('저평가')) {
    ok('value 선택 → 설명 전환');
  } else {
    fail('value 설명', `예상 텍스트 없음: "${valueText.slice(0, 80)}"`);
  }

  // technical 선택
  await typeSelect.click();
  await page.locator('[role="option"]').filter({ hasText: '기술적분석' }).click();
  await page.waitForTimeout(200);
  const techText = await descBox.textContent().catch(() => '');
  if (techText.includes('차트') || techText.includes('신호')) {
    ok('technical 선택 → 설명 전환');
  } else {
    fail('technical 설명', `예상 텍스트 없음: "${techText.slice(0, 80)}"`);
  }

  await page.keyboard.press('Escape');
}

// ─────────────────────────────────────────────────────────────
// TC-2: 고급 손절 규칙 Collapsible 열기/닫기
// ─────────────────────────────────────────────────────────────
async function testAdvancedStopLossCollapsible(page) {
  console.log('\n[TC-2] 고급 손절 규칙 Collapsible');

  await page.goto(`${BASE_URL}/auto-trading`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const createBtn = page.locator('[data-testid="button-create-model"]');
  if (!(await createBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    fail('Collapsible', '모델 생성 버튼 없음');
    return;
  }
  await createBtn.click();
  await page.waitForTimeout(300);

  // CL선 셀렉터가 처음엔 안 보여야 함 (접힌 상태)
  const stopLossSelect = page.locator('[data-testid="select-stop-loss-color"]');
  const isHiddenInitially = !(await stopLossSelect.isVisible({ timeout: 500 }).catch(() => false));
  if (isHiddenInitially) {
    ok('초기 상태: 고급 손절 규칙 접혀 있음');
  } else {
    fail('초기 상태', 'CL 손절 UI가 기본 노출됨 (고급 옵션으로 숨겨야 함)');
  }

  // Collapsible 트리거 클릭
  const trigger = page.locator('button').filter({ hasText: '고급 손절 규칙' });
  if (!(await trigger.isVisible({ timeout: 2000 }).catch(() => false))) {
    fail('Collapsible 트리거', '버튼 없음');
    await page.keyboard.press('Escape');
    return;
  }
  await trigger.click();
  await page.waitForTimeout(300);

  const isVisibleAfterOpen = await stopLossSelect.isVisible({ timeout: 1000 }).catch(() => false);
  if (isVisibleAfterOpen) {
    ok('Collapsible 열기 → CL 손절 UI 표시');
  } else {
    fail('Collapsible 열기', '열었는데도 CL 셀렉터가 안 보임');
  }

  // 다시 닫기
  await trigger.click();
  await page.waitForTimeout(300);
  const isHiddenAfterClose = !(await stopLossSelect.isVisible({ timeout: 500 }).catch(() => false));
  if (isHiddenAfterClose) {
    ok('Collapsible 닫기 → CL 손절 UI 숨겨짐');
  } else {
    fail('Collapsible 닫기', '닫았는데도 CL 셀렉터가 보임');
  }

  await page.keyboard.press('Escape');
}

/** API로 테스트용 모델을 생성하고 모델 ID를 반환. 이미 있으면 기존 것 반환. */
async function ensureTestModel(page) {
  // 현재 로그인된 세션 쿠키를 사용하여 API 호출 (page.evaluate로 fetch)
  const result = await page.evaluate(async (baseUrl) => {
    // 기존 모델 목록 확인
    const listRes = await fetch(`${baseUrl}/api/ai/models`, { credentials: 'include' });
    const models = await listRes.json();
    if (Array.isArray(models) && models.length > 0) return models[0].id;

    // 없으면 새로 생성
    const createRes = await fetch(`${baseUrl}/api/ai/models`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelName: 'PW Test Model',
        modelType: 'momentum',
        description: '플레이라이트 테스트용',
        config: {},
      }),
    });
    if (createRes.ok) {
      const m = await createRes.json();
      return m.id;
    }
    return null;
  }, BASE_URL);
  return result;
}

/** 자동매매 페이지에서 모델을 클릭해 선택 후 설정 패널이 로드될 때까지 대기 */
async function selectModelAndWaitForSettings(page, modelId) {
  await page.goto(`${BASE_URL}/auto-trading`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 모델 카드 클릭
  const card = page.locator(`[data-testid="card-model-${modelId}"]`);
  if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
    // 모델 카드가 없으면 첫 번째 카드 클릭
    const firstCard = page.locator('[data-testid^="card-model-"]').first();
    if (!(await firstCard.isVisible({ timeout: 3000 }).catch(() => false))) return false;
    await firstCard.click();
  } else {
    await card.click();
  }
  // 설정 저장 버튼이 나타날 때까지 대기
  await page.waitForSelector('[data-testid="button-save-trading-settings"]', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  return true;
}

// ─────────────────────────────────────────────────────────────
// TC-3: 설정화면 — 손절 모드별 hardCutLossPct 입력 표시
// ─────────────────────────────────────────────────────────────
async function testStopLossModeSelector(page) {
  console.log('\n[TC-3] 설정화면 — 손절 모드별 hardCutLossPct 표시/숨김');

  const modelId = await ensureTestModel(page);
  if (!modelId) { fail('테스트 모델', '모델 생성 실패'); return; }

  const ok2 = await selectModelAndWaitForSettings(page, modelId);
  if (!ok2) { fail('모델 선택', '설정 패널 로드 실패'); return; }

  // 손절 모드 셀렉터 — data-testid 직접 사용
  const modeSelect = page.locator('[data-testid="select-stop-loss-mode"]');
  if (!(await modeSelect.isVisible({ timeout: 3000 }).catch(() => false))) {
    fail('손절 모드 셀렉터', '찾을 수 없음');
    return;
  }

  // hard 선택 → hardCutLossPct 입력 표시 확인
  await modeSelect.click();
  const hardOption = page.locator('[role="option"]').filter({ hasText: /강제/ }).first();
  if (await hardOption.isVisible({ timeout: 1000 }).catch(() => false)) {
    await hardOption.click();
    await page.waitForTimeout(300);
    const hardInput = page.locator('[data-testid="input-hard-cut-loss"]');
    const hardVisible = await hardInput.isVisible({ timeout: 1000 }).catch(() => false);
    if (hardVisible) {
      ok('hard 모드 → hardCutLossPct 입력 표시');
    } else {
      fail('hard 모드 입력', 'input-hard-cut-loss 가 보이지 않음');
    }
  } else {
    fail('hard 모드 옵션', '옵션 없음');
  }

  // disabled 선택 → hardCutLossPct 숨김 확인
  await modeSelect.click();
  const disabledOption = page.locator('[role="option"]').filter({ hasText: /비활성/ }).first();
  if (await disabledOption.isVisible({ timeout: 1000 }).catch(() => false)) {
    await disabledOption.click();
    await page.waitForTimeout(300);
    const hardInput = page.locator('[data-testid="input-hard-cut-loss"]');
    const hiddenAfter = !(await hardInput.isVisible({ timeout: 500 }).catch(() => false));
    if (hiddenAfter) {
      ok('disabled 모드 → hardCutLossPct 숨김');
    } else {
      fail('disabled 모드 숨김', 'input-hard-cut-loss 가 여전히 보임');
    }
  } else {
    fail('disabled 모드 옵션', '옵션 없음');
  }
}

// ─────────────────────────────────────────────────────────────
// TC-4: 라더 유닛 합계 > maxUnitsPerStock → 저장 차단
// ─────────────────────────────────────────────────────────────
async function testLadderValidation(page) {
  console.log('\n[TC-4] 설정화면 — 라더 유닛 합계 초과 시 저장 차단');

  const modelId = await ensureTestModel(page);
  if (!modelId) { fail('테스트 모델', '모델 생성 실패'); return; }

  const ready = await selectModelAndWaitForSettings(page, modelId);
  if (!ready) { fail('모델 선택', '설정 패널 로드 실패'); return; }

  // maxUnitsPerStock 를 2로 설정
  const maxUnitsInput = page.locator('[data-testid="input-max-units-per-stock"]');
  if (!(await maxUnitsInput.isVisible({ timeout: 2000 }).catch(() => false))) {
    fail('maxUnitsPerStock 입력', '찾을 수 없음');
    return;
  }
  await maxUnitsInput.click({ clickCount: 3 });
  await maxUnitsInput.fill('2');

  // 라더 첫 3칸을 각각 2로 설정 (합계 = 6 > 2)
  for (const line of [50, 40, 30]) {
    const inp = page.locator(`[data-testid="input-ladder-${line}"]`);
    if (await inp.isVisible({ timeout: 500 }).catch(() => false)) {
      await inp.click({ clickCount: 3 });
      await inp.fill('2');
    }
  }

  // 저장 버튼 클릭
  const saveBtn = page.locator('[data-testid="button-save-trading-settings"]');
  await saveBtn.click();
  await page.waitForTimeout(800);

  // 토스트 에러 메시지 확인
  const toastEl = page.locator('[role="status"], [role="alert"], [data-sonner-toast]').first();
  const toastText = await toastEl.textContent({ timeout: 2000 }).catch(() => '');
  if (toastText.includes('유닛') || toastText.includes('초과') || toastText.includes('라더') || toastText.includes('합계')) {
    ok('라더 유닛 초과 → 에러 토스트 표시');
  } else {
    fail('라더 유닛 초과 검증', `토스트 텍스트: "${toastText.slice(0, 100)}"`);
  }
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────
async function run() {
  console.log('🎭 자동매매 UI 기능 테스트 시작');
  console.log(`   대상: ${BASE_URL}`);

  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);

  try {
    await login(page);
    await testModelTypeDescription(page);
    await testAdvancedStopLossCollapsible(page);
    await testStopLossModeSelector(page);
    await testLadderValidation(page);
  } catch (err) {
    console.error('\n[치명 오류]', err.message);
    failed++;
  } finally {
    await browser.close();
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`결과: ✅ ${passed}개 통과  ❌ ${failed}개 실패`);
  if (failed > 0) process.exit(1);
}

run();
