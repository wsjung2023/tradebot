/**
 * 티어 제한 UI 테스트 — 각 플랜별로 실제 화면에서 막히는지 확인
 *
 * 실행 순서:
 *   free → saas_basic → saas_pro → saas_enterprise → 원복(saas_pro)
 *
 * 각 플랜에서 테스트:
 *   [A] /billing 페이지 — limits 값 확인
 *   [B] /accounts 실계좌 추가 — 한도 초과 시 403 + UI 토스트
 *   [C] AI 분석 일일 한도 초과 차단 확인
 *   [D] autoApply 토글 — Basic/Free 차단, Pro/Enterprise 허용
 *
 * 사전 준비: 테스트용 AI 모델 생성 → 사후 삭제
 * 사전 준비: 각 티어별 한도만큼 실계좌 API 생성 → 테스트 후 삭제
 *
 * 환경변수:
 *   PLAYWRIGHT_BASE_URL  기본값 https://app.wsj-aitradebot.live
 */

import { chromium } from 'playwright';
import { existsSync } from 'fs';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://app.wsj-aitradebot.live';
const SESSION_FILE = '.playwright-session.json';

let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`    ✅ ${label}`);
    passed++;
  } else {
    console.error(`    ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function setTier(ctx, userId, tier) {
  const res = await ctx.request.patch(`${BASE_URL}/api/admin/users/${userId}/subscription`, {
    data: { tier },
  });
  if (!res.ok()) throw new Error(`티어 설정 실패: ${await res.text()}`);
  console.log(`  → 티어 설정: ${tier}`);
}

async function waitForToast(page, keywords, timeoutMs = 6000) {
  try {
    const toastEl = page.locator('[data-testid="toast"], [role="status"], .toast, [class*="toast"]').first();
    await toastEl.waitFor({ timeout: timeoutMs });
    const text = await toastEl.textContent();
    const matched = keywords.some(k => text?.includes(k));
    return { found: true, text, matched };
  } catch {
    try {
      const toastEl = page.locator('li[data-sonner-toast], [data-radix-toast-viewport] li').first();
      await toastEl.waitFor({ timeout: 2000 });
      const text = await toastEl.textContent();
      const matched = keywords.some(k => text?.includes(k));
      return { found: true, text, matched };
    } catch {
      return { found: false, text: '', matched: false };
    }
  }
}

async function getUserId(ctx) {
  const r = await ctx.request.get(`${BASE_URL}/api/auth/me`);
  const body = await r.json();
  return body.user?.id;
}

// 테스트용 AI 모델 생성 (settings 레코드까지) → id 반환
async function createTestAiModel(ctx) {
  const res = await ctx.request.post(`${BASE_URL}/api/ai/models`, {
    data: { modelName: '[TEST] 티어테스트모델', modelType: 'momentum', config: {} },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`테스트 AI 모델 생성 실패: ${text}`);
  }
  const model = await res.json();
  // auto-apply-toggle이 settings 레코드를 요구하므로 미리 생성 (가중치 합=100 필요)
  await ctx.request.put(`${BASE_URL}/api/ai/models/${model.id}/trading-settings`, {
    data: {
      themeWeight: '20', newsWeight: '20', financialsWeight: '20',
      liquidityWeight: '20', institutionalWeight: '20',
    },
    headers: { 'Content-Type': 'application/json' },
  });
  console.log(`  ✔ 테스트 AI 모델 생성: id=${model.id} (settings 포함)`);
  return model.id;
}

async function deleteTestAiModel(ctx, modelId) {
  await ctx.request.delete(`${BASE_URL}/api/ai/models/${modelId}`);
  console.log(`  ✔ 테스트 AI 모델 삭제: id=${modelId}`);
}

// 실계좌를 count개 생성 → 생성된 id 목록 반환
async function createRealAccounts(ctx, count, tierLabel) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const num = `9999${String(i).padStart(4, '0')}`;
    const res = await ctx.request.post(`${BASE_URL}/api/accounts`, {
      data: { accountNumber: num, accountType: 'real', accountName: `[TEST]${tierLabel}_${i}` },
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const body = await res.json();
      if (body.id) ids.push(body.id);
    }
  }
  console.log(`  ✔ 테스트 실계좌 생성 ${ids.length}개`);
  return ids;
}

async function deleteAccounts(ctx, ids) {
  for (const id of ids) {
    await ctx.request.delete(`${BASE_URL}/api/accounts/${id}`);
  }
  if (ids.length > 0) console.log(`  ✔ 테스트 실계좌 삭제 ${ids.length}개`);
}

async function run() {
  const browser = await chromium.launch({
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  const hasSession = existsSync(SESSION_FILE);
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    ...(hasSession ? { storageState: SESSION_FILE } : {}),
  });
  const page = await ctx.newPage();

  // ── 로그인 (세션 파일 없을 때만) ──────────────────────────────────────────
  if (!hasSession) {
    console.log(`\n📋 로그인 — 구글 로그인 완료해주세요... (완료 후 세션 저장됩니다)`);
    await page.goto(`${BASE_URL}/login`);
    await page.waitForURL(
      u => u.toString().startsWith(BASE_URL) && !u.toString().includes('/login') && !u.toString().includes('/auth'),
      { timeout: 180000 }
    );
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
    await ctx.storageState({ path: SESSION_FILE });
    console.log(`  로그인 완료 & 세션 저장 (${SESSION_FILE}) ✅`);
  } else {
    console.log(`\n📋 저장된 세션 로드 (${SESSION_FILE})`);
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const meRes = await ctx.request.get(`${BASE_URL}/api/auth/me`);
    if (meRes.status() !== 200) {
      console.log('  세션 만료 — 재로그인 필요. SESSION_FILE 삭제 후 재실행하세요.');
      const { unlinkSync } = await import('fs');
      unlinkSync(SESSION_FILE);
      await browser.close();
      process.exit(1);
    }
    console.log('  세션 유효 ✅');
  }

  const userId = await getUserId(ctx);
  console.log(`  userId: ${userId}`);

  // ── 사전 준비: 어드민 권한 확인 / 부트스트랩 ───────────────────────────────
  console.log('\n⚙️  어드민 권한 확인');
  const meRes2 = await ctx.request.get(`${BASE_URL}/api/auth/me`);
  const meData = await meRes2.json();
  if (meData.user?.role !== 'admin') {
    console.log('  어드민 아님 — 부트스트랩 시도...');
    const bsRes = await ctx.request.post(`${BASE_URL}/api/admin/bootstrap`);
    if (bsRes.ok()) {
      console.log('  부트스트랩 성공 ✅');
    } else {
      const err = await bsRes.text();
      console.error(`  [FATAL] 어드민 부트스트랩 실패 (이미 어드민 존재?): ${err}`);
      console.error('  어드민 계정으로 로그인하거나 SESSION_FILE을 삭제 후 재실행하세요.');
      await browser.close();
      process.exit(1);
    }
  } else {
    console.log('  어드민 확인 ✅');
  }

  // ── 사전 준비: 테스트용 AI 모델 생성 ──────────────────────────────────────
  console.log('\n⚙️  사전 준비: 테스트 AI 모델 생성');
  let testModelId = null;
  try {
    testModelId = await createTestAiModel(ctx);
  } catch (e) {
    console.error(`  ⚠️  AI 모델 생성 실패: ${e.message} — [D] autoApply 테스트 스킵됨`);
  }

  const tiers = [
    { tier: 'free',            label: 'Free',        maxReal: 0, maxAi: 0,   autoApplyOk: false },
    { tier: 'saas_basic',      label: 'Basic',       maxReal: 1, maxAi: 10,  autoApplyOk: false },
    { tier: 'saas_pro',        label: 'Pro',         maxReal: 2, maxAi: 50,  autoApplyOk: true  },
    { tier: 'saas_enterprise', label: 'Enterprise',  maxReal: 5, maxAi: 300, autoApplyOk: true  },
  ];

  for (const { tier, label, maxReal, maxAi, autoApplyOk } of tiers) {
    console.log(`\n${'═'.repeat(55)}`);
    console.log(`🧪 [${label}] 플랜 테스트 시작`);

    await setTier(ctx, userId, tier);
    await new Promise(r => setTimeout(r, 500));

    // ── A. /billing 페이지 limits 확인 ───────────────────────────────────
    console.log(`\n  [A] /billing 페이지 limits 표시 확인`);
    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));

    const subRes = await ctx.request.get(`${BASE_URL}/api/billing/subscription`);
    const sub = await subRes.json();
    assert(sub.limits?.maxRealAccounts === maxReal, `maxRealAccounts = ${maxReal}`, `actual=${sub.limits?.maxRealAccounts}`);
    assert(sub.limits?.maxAiAnalysisPerDay === maxAi, `maxAiAnalysisPerDay = ${maxAi}`, `actual=${sub.limits?.maxAiAnalysisPerDay}`);
    assert(sub.limits?.canAutoApply === autoApplyOk, `canAutoApply = ${autoApplyOk}`, `actual=${sub.limits?.canAutoApply}`);
    await page.screenshot({ path: `test-${tier}-billing.png` });

    // ── B. 실계좌 추가 한도 초과 ─────────────────────────────────────────
    console.log(`\n  [B] 실계좌 추가 한도(${maxReal}개) 초과 테스트`);

    // 현재 실계좌 조회 → 한도만큼 채우기
    const acctRes = await ctx.request.get(`${BASE_URL}/api/accounts`);
    const accounts = await acctRes.json();
    const realAccounts = Array.isArray(accounts) ? accounts.filter(a => a.accountType === 'real') : [];
    const realCount = realAccounts.length;

    let testAccountIds = [];
    if (realCount < maxReal) {
      const needed = maxReal - realCount;
      console.log(`    실계좌 ${realCount}개 → ${needed}개 추가로 한도(${maxReal}) 채우는 중...`);
      testAccountIds = await createRealAccounts(ctx, needed, label);
    }

    // 이제 realCount >= maxReal 상태 — 한도 초과 API 테스트
    const addRes = await ctx.request.post(`${BASE_URL}/api/accounts`, {
      data: { accountNumber: '88881234', accountType: 'real', accountName: `[TEST]한도초과_${label}` },
      headers: { 'Content-Type': 'application/json' },
    });
    assert(addRes.status() === 403, `실계좌 한도 초과 → 403`, `actual=${addRes.status()}`);
    const addBody = await addRes.json();
    assert(addBody.code === 'REAL_ACCOUNT_LIMIT_EXCEEDED', '에러 코드 REAL_ACCOUNT_LIMIT_EXCEEDED');

    // UI 토스트 확인 (maxReal === 0인 Free 또는 계좌를 채운 경우)
    await page.goto(`${BASE_URL}/accounts`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const addBtn = page.locator('[data-testid="button-add-account"], [data-testid="button-add-first-account"]').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await new Promise(r => setTimeout(r, 800));
      const accountNumInput = page.locator('[data-testid="input-account-number"]');
      if (await accountNumInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await accountNumInput.fill('88881234');
      }
      const accountNameInput = page.locator('[data-testid="input-account-name"]');
      if (await accountNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await accountNameInput.fill('테스트한도초과');
      }
      const typeSelect = page.locator('[data-testid="select-account-type"]');
      if (await typeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeSelect.click();
        await new Promise(r => setTimeout(r, 300));
        await page.locator('[role="option"]:has-text("실전투자")').click();
        await new Promise(r => setTimeout(r, 300));
      }
      const submitBtn = page.locator('[data-testid="button-submit"]');
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) await submitBtn.click();
      const toast = await waitForToast(page, ['한도', '업그레이드', 'REAL_ACCOUNT_LIMIT']);
      assert(toast.matched, `UI 토스트: 실계좌 한도 에러 메시지`, `text=${toast.text?.slice(0, 60)}`);
      await page.screenshot({ path: `test-${tier}-account-limit.png` });
    } else {
      console.log('    ℹ️  계좌 추가 버튼 미발견 — UI 토스트 테스트 스킵');
    }

    // 테스트용 계좌 삭제 (원복)
    await deleteAccounts(ctx, testAccountIds);

    // ── C. AI 분석 일일 한도 ─────────────────────────────────────────────
    console.log(`\n  [C] AI 분석 일일 한도(${maxAi}회) 테스트`);
    const aiRes = await ctx.request.post(`${BASE_URL}/api/ai/analyze-stock`, {
      data: { stockCode: '005930', stockName: '삼성전자', currentPrice: 70000 },
      headers: { 'Content-Type': 'application/json' },
    });
    const aiStatus = aiRes.status();
    if (maxAi === 0) {
      // free 티어: 한도 0 → 즉시 차단
      assert(aiStatus === 429, `Free: AI 분석 즉시 차단 → 429`, `actual=${aiStatus}`);
      const aiBody = await aiRes.json();
      assert(aiBody.code === 'AI_ANALYSIS_LIMIT_EXCEEDED', '에러 코드 AI_ANALYSIS_LIMIT_EXCEEDED');
    } else {
      // 한도 있는 티어: 429가 아니면 한도 체크는 통과한 것 (AI 키 없어 500이어도 OK)
      assert(aiStatus !== 429, `${label}: AI 분석 한도 차단 안 됨 (응답 ${aiStatus})`,
        aiStatus === 429 ? 'AI_ANALYSIS_LIMIT_EXCEEDED — 한도 초과로 차단됨' : '');
      if (aiStatus === 429) {
        const aiBody = await aiRes.json();
        console.log(`    (응답) ${JSON.stringify(aiBody).slice(0, 100)}`);
      } else if (aiStatus >= 400 && aiStatus !== 429) {
        console.log(`    (참고) ${aiStatus} 응답 — 한도 체크 통과, AI 키 미설정으로 에러`);
      }
    }

    // ── D. autoApply 토글 ─────────────────────────────────────────────────
    console.log(`\n  [D] autoApply 토글 — ${autoApplyOk ? '허용' : '차단'} 확인`);
    if (testModelId) {
      const toggleRes = await ctx.request.patch(
        `${BASE_URL}/api/auto-trading/settings/${testModelId}/auto-apply-toggle`,
        { data: { autoApply: true }, headers: { 'Content-Type': 'application/json' } }
      );
      const toggleStatus = toggleRes.status();
      if (autoApplyOk) {
        assert(toggleStatus === 200, `${label}: autoApply ON 허용`, `actual=${toggleStatus}`);
        // 원복 (OFF)
        await ctx.request.patch(`${BASE_URL}/api/auto-trading/settings/${testModelId}/auto-apply-toggle`,
          { data: { autoApply: false }, headers: { 'Content-Type': 'application/json' } });
      } else {
        assert(toggleStatus === 403, `${label}: autoApply ON 차단`, `actual=${toggleStatus}`);
        const body = await toggleRes.json();
        assert(body.code === 'TIER_AUTOPLAY_BLOCKED', '에러 코드 TIER_AUTOPLAY_BLOCKED');
      }
    } else {
      console.log('    ℹ️  AI 모델 생성 실패로 스킵');
    }
  }

  // ── 사후 정리: 테스트 AI 모델 삭제 ───────────────────────────────────────
  if (testModelId) {
    console.log(`\n⚙️  사후 정리: 테스트 AI 모델 삭제`);
    await deleteTestAiModel(ctx, testModelId);
  }

  // ── 원복: saas_pro 복원 ────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(55)}`);
  console.log('🔄 원복: saas_pro 복원');
  await setTier(ctx, userId, 'saas_pro');

  await browser.close();

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`최종 결과: PASS ${passed} / FAIL ${failed} / 합계 ${passed + failed}`);
  if (failed > 0) { console.error('일부 테스트 실패'); process.exit(1); }
  console.log('모든 티어 UI 테스트 통과 ✅');
}

run().catch(e => { console.error('[FATAL]', e.message, e.stack); process.exit(1); });
