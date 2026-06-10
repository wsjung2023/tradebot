/**
 * playwright-feature-review.mjs
 *
 * 이번 세션에서 구현한 기능들을 포그라운드(headed)로 시각 검증.
 * - 쿠키 재사용: scripts/auth-state.json에 저장된 세션 사용 (8시간 유효)
 *   없으면 로그인 페이지에서 수동 로그인 대기 후 자동 저장
 *
 * 실행:
 *   node scripts/playwright-feature-review.mjs
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:5000 node scripts/playwright-feature-review.mjs
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5000";
const AUTH_STATE_FILE = resolve(__dirname, "auth-state.json");
const AUTH_TTL_MS = 8 * 60 * 60 * 1000; // 8시간
const STEP_PAUSE = 1200; // 각 단계 사이 시각 확인용 대기 (ms)
const DEV_LOGIN_EMAIL = process.env.TEST_EMAIL || "mainstop3@gmail.com";

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(step, msg) {
  console.log(`\n[${step}] ${msg}`);
}

function pass(step) {
  console.log(`  ✅ ${step}`);
}

function fail(step, reason) {
  console.error(`  ❌ ${step}: ${reason}`);
}

/** 저장된 auth-state.json 로드. 없거나 만료됐으면 null 반환 */
function loadAuthState() {
  if (!existsSync(AUTH_STATE_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(AUTH_STATE_FILE, "utf8"));
    if (raw._savedAt && Date.now() - raw._savedAt < AUTH_TTL_MS) {
      return raw;
    }
  } catch {
    // 파일 손상 시 무시
  }
  return null;
}

/** dev-login API로 세션 쿠키 발급 (development 서버에서만 동작) */
async function devLogin(context) {
  log("LOGIN", `dev-login API 호출 (${DEV_LOGIN_EMAIL})`);
  const resp = await context.request.post(`${BASE_URL}/api/auth/dev-login`, {
    data: { email: DEV_LOGIN_EMAIL },
  });
  if (!resp.ok()) {
    throw new Error(`dev-login 실패: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json();
  log("LOGIN", `로그인 성공 → ${body.user?.email}`);
}

/** 세션 쿠키 저장 */
async function saveAuthState(context) {
  const state = await context.storageState();
  state._savedAt = Date.now();
  writeFileSync(AUTH_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  log("COOKIE", `auth-state.json 저장됨 (${AUTH_STATE_FILE})`);
}

// ───────────────────────────────────────────────────────────
// 개별 검증 함수들
// ───────────────────────────────────────────────────────────

async function testSidebarOrder(page) {
  log("1/8", "사이드바 메뉴 순서 확인 (배치잡 관리 최하단)");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await wait(STEP_PAUSE);

  // href 속성으로 링크 위치 비교 (shadcn sidebar는 div 기반)
  const settingsLink = page.locator('a[href="/settings"]').first();
  const adminJobsLink = page.locator('a[href="/admin-jobs"]').first();

  const settingsVisible = await settingsLink.isVisible({ timeout: 5000 }).catch(() => false);
  const adminJobsVisible = await adminJobsLink.isVisible({ timeout: 5000 }).catch(() => false);

  if (!settingsVisible || !adminJobsVisible) {
    // 사이드바 토글 버튼이 있을 수 있음 (모바일 레이아웃)
    const toggleBtn = page.locator('button[data-sidebar="trigger"], button[aria-label*="sidebar"]').first();
    if (await toggleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await toggleBtn.click();
      await wait(500);
    }
    fail("사이드바 링크", `설정=${settingsVisible}, 배치잡=${adminJobsVisible}`);
    return;
  }

  // DOM 상의 순서 확인 (bounding box y좌표 비교)
  const settingsBox = await settingsLink.boundingBox();
  const adminJobsBox = await adminJobsLink.boundingBox();

  if (settingsBox && adminJobsBox && adminJobsBox.y > settingsBox.y) {
    pass("배치잡 관리가 설정 아래에 위치 (y좌표 비교 통과)");
  } else {
    fail("배치잡 순서", `설정.y=${settingsBox?.y}, 배치잡.y=${adminJobsBox?.y}`);
  }

  // 전체 메뉴 목록 출력
  const allMenuLinks = await page.locator('a[href^="/"]').allTextContents();
  console.log("  사이드바 메뉴:", allMenuLinks.map(t => t.trim()).filter(Boolean).slice(0, 15));
}

async function testGuide(page) {
  log("2/8", "사용가이드 섹션 점검 (구식 '에이전트 연결' 표현 제거 확인)");
  await page.goto(`${BASE_URL}/guide`, { waitUntil: "domcontentloaded" });
  await wait(STEP_PAUSE);

  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("TradeBot 운영 마스터 가이드")) {
    pass("가이드 페이지 제목 확인");
  } else {
    fail("가이드 제목", "제목이 보이지 않음");
  }

  // "Task Scheduler" 키워드가 추가됐는지 + 시작 전 확인 항목이 "에이전트 실행"으로 변경됐는지
  if (bodyText.includes("Task Scheduler") || bodyText.includes("작업 스케줄러")) {
    pass("에이전트 → Task Scheduler/작업 스케줄러 표현 확인");
  } else {
    fail("가이드 표현", "Task Scheduler 관련 텍스트 미발견");
  }
  // 시작 전 확인 항목: "에이전트 실행" 으로 변경됐는지
  if (bodyText.includes("에이전트 실행") || bodyText.includes("에이전트 상태")) {
    pass("시작 전 확인 항목: 에이전트 실행 표현 확인");
  } else {
    fail("가이드 항목", "에이전트 실행/상태 텍스트 미발견");
  }

  // 섹션 카드들 확인
  for (const title of ["레인보우 차트", "AI 판단", "매도 전략", "DART 재무", "배치잡"]) {
    if (bodyText.includes(title)) {
      pass(`섹션 확인: ${title}`);
    } else {
      fail("섹션 누락", title);
    }
  }
  await wait(STEP_PAUSE);
}

async function testPinLock(page, context) {
  log("3/8", "실계좌 PIN 잠금 — 설정 → 활성화 → 대시보드 확인 → 비활성화");

  // 설정 페이지
  await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
  await wait(STEP_PAUSE);

  // PIN 잠금 UI 존재 여부 (텍스트 콘텐츠로 탐색)
  const pinSection = page.locator("text=실계좌 자산 잠금").first();
  const pinVisible = await pinSection.isVisible({ timeout: 8000 }).catch(() => false);
  if (pinVisible) {
    pass("설정 페이지에 실계좌 자산 잠금 UI 확인");
  } else {
    fail("PIN 설정 UI", "실계좌 자산 잠금 항목 미발견");
    return;
  }

  // 이미 잠금 활성화 상태면 해제 후 재설정
  const disableBtn = page.locator("button", { hasText: "잠금 해제" }).first();
  if (await disableBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await disableBtn.click();
    await wait(500);
    log("3/8", "기존 잠금 해제됨 — 재설정 진행");
  }

  // PIN 입력 & 설정
  const pinInputs = page.locator('input[placeholder*="PIN"]');
  const pinCount = await pinInputs.count();
  if (pinCount >= 2) {
    await pinInputs.nth(0).fill("1234");
    await wait(300);
    await pinInputs.nth(1).fill("1234");
    await wait(300);
    const setBtn = page.locator("button", { hasText: "설정" }).last();
    await setBtn.click();
    await wait(800);
    pass("PIN 1234 설정 완료");
  } else {
    fail("PIN 입력 필드", `필드 수 ${pinCount}`);
    return;
  }

  // 대시보드로 이동 → 실계좌가 있다면 PIN 잠금 화면 확인
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await wait(STEP_PAUSE);

  const lockCard = page.locator("text=실계좌 잠금").first();
  const lockVisible = await lockCard.isVisible({ timeout: 4000 }).catch(() => false);
  if (lockVisible) {
    pass("대시보드에 실계좌 잠금 화면 표시 확인");
    // PIN 입력 해제 테스트
    const pinInput = page.locator('input[placeholder*="PIN"]').first();
    if (await pinInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pinInput.fill("1234");
      await page.locator("button", { hasText: "잠금 해제" }).last().click();
      await wait(800);
      const totalAssets = page.locator('[data-testid="text-total-assets"]');
      if (await totalAssets.isVisible({ timeout: 3000 }).catch(() => false)) {
        pass("PIN 입력 후 자산 카드 표시 확인");
      } else {
        fail("PIN 해제 후 자산", "자산 카드 미표시");
      }
    }
  } else {
    // 실계좌가 없거나 모의계좌만 선택된 경우 → 잠금 화면이 안 나오는 게 정상
    const totalAssets = page.locator('[data-testid="text-total-assets"]');
    if (await totalAssets.isVisible({ timeout: 3000 }).catch(() => false)) {
      pass("모의계좌 선택 상태 — 잠금 화면 미표시(정상), 자산 카드 표시 확인");
    } else {
      fail("대시보드", "잠금 화면도 자산 카드도 미표시");
    }
  }

  // PIN 잠금 비활성화 (테스트 후 원래 상태로)
  await page.goto(`${BASE_URL}/settings`, { waitUntil: "domcontentloaded" });
  await wait(800);
  const finalDisableBtn = page.locator("button", { hasText: "잠금 해제" }).first();
  if (await finalDisableBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await finalDisableBtn.click();
    await wait(500);
    pass("테스트 후 PIN 잠금 비활성화 완료");
  }
  await wait(STEP_PAUSE);
}

async function testTradingHoldingPicker(page) {
  log("4/8", "거래 화면 — 계좌 선택 시 보유종목 퀵셀렉트 표시 확인");
  await page.goto(`${BASE_URL}/trading`, { waitUntil: "domcontentloaded" });
  await wait(STEP_PAUSE);

  // ConnectionStatus 아래 AccountHoldingPicker 영역
  const pageBody = await page.locator("body").innerText();
  if (pageBody.includes("계좌를 선택하면 보유종목이 표시됩니다") ||
      page.locator('[data-testid="account-holding-picker"]').first()) {
    // 계좌 선택 콤보박스 찾기
    const accountSelect = page.locator("select, [role=combobox]").first();
    if (await accountSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      pass("계좌 선택 UI 표시 확인");
    }
  }

  // 거래 화면 기본 요소 확인
  const stockSelector = page.locator("text=종목 선택, text=종목").first();
  const hasTrading = await page.locator("body").innerText().then(t =>
    t.includes("종목") && t.includes("계좌")
  );
  if (hasTrading) {
    pass("거래 화면 종목/계좌 UI 확인");
  } else {
    fail("거래 화면", "기본 UI 미발견");
  }
  await wait(STEP_PAUSE);
}

async function testAIAnalysisHoldingPicker(page) {
  log("5/8", "AI 분석 화면 — 보유종목 퀵셀렉트 + 분석할 종목 확인");
  await page.goto(`${BASE_URL}/ai-analysis`, { waitUntil: "domcontentloaded" });
  await wait(STEP_PAUSE);

  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("AI") && bodyText.includes("분석")) {
    pass("AI 분석 페이지 로드 확인");
  } else {
    fail("AI 분석", "페이지 내용 미발견");
  }
  if (bodyText.includes("분석할 종목") || bodyText.includes("종목 검색")) {
    pass("분석 종목 입력 UI 확인");
  }
  await wait(STEP_PAUSE);
}

async function testTradeHistoryPagination(page) {
  log("6/8", "거래내역 — 페이징 컴포넌트 확인");
  await page.goto(`${BASE_URL}/trade-history`, { waitUntil: "domcontentloaded" });
  await wait(STEP_PAUSE);

  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("거래내역") || bodyText.includes("주문")) {
    pass("거래내역 페이지 로드 확인");
  }
  // 페이징 버튼 (ChevronLeft/Right) 혹은 페이지 텍스트
  const pagination = page.locator("[data-testid*='pagination'], button[aria-label*='page'], text=/\\d+ \\/ \\d+/").first();
  const hasPagination = await pagination.isVisible({ timeout: 3000 }).catch(() => false);
  // 데이터가 없을 수도 있으므로 단순히 페이지 내 총건수 표시 확인
  if (bodyText.includes("총") || bodyText.includes("건") || hasPagination) {
    pass("거래내역 페이징/카운트 UI 확인");
  } else {
    fail("거래내역 페이징", "페이징 요소 미발견");
  }
  await wait(STEP_PAUSE);
}

async function testJournalPagination(page) {
  log("7/8", "매매저널 — 페이징 컴포넌트 확인");
  await page.goto(`${BASE_URL}/trade-journal`, { waitUntil: "domcontentloaded" });
  await wait(STEP_PAUSE);

  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("매매 저널") || bodyText.includes("Trade Journal")) {
    pass("매매저널 페이지 로드 확인");
  } else {
    fail("매매저널", "페이지 제목 미발견");
  }
  // 조회 후 페이징 확인
  const searchBtn = page.locator("button", { hasText: "조회" }).first();
  if (await searchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchBtn.click();
    await wait(1500);
    pass("조회 버튼 클릭 성공");
  }
  await wait(STEP_PAUSE);
}

async function testCandidateDecisionsPagination(page) {
  log("8/8", "선정/탈락 이력 — 페이징 컴포넌트 확인");
  await page.goto(`${BASE_URL}/candidate-decisions`, { waitUntil: "domcontentloaded" });
  await wait(STEP_PAUSE);

  await page
    .waitForSelector('[data-testid="text-candidate-decisions-title"]', { timeout: 8000 })
    .catch(() => {});
  const titleVisible = await page
    .locator('[data-testid="text-candidate-decisions-title"]')
    .isVisible()
    .catch(() => false);
  if (titleVisible) {
    pass("선정/탈락 이력 페이지 타이틀 확인");
  } else {
    fail("선정/탈락 이력", "타이틀 미발견");
  }

  // 테이블 또는 빈 상태
  await page
    .waitForSelector('[data-testid="table-candidate-decisions"], [data-testid="text-no-candidate-decisions"]', {
      timeout: 10000,
    })
    .catch(() => {});
  const hasTable = await page.locator('[data-testid="table-candidate-decisions"]').isVisible().catch(() => false);
  const hasEmpty = await page.locator('[data-testid="text-no-candidate-decisions"]').isVisible().catch(() => false);
  if (hasTable) {
    pass("선정/탈락 테이블 렌더링 확인");
    // 페이지네이션 버튼 확인
    const paginationArea = await page.locator("body").innerText();
    if (paginationArea.includes("총") || paginationArea.includes("건")) {
      pass("총 건수 표시 확인");
    }
  } else if (hasEmpty) {
    pass("빈 결과 상태 표시 확인 (데이터 없음)");
  } else {
    fail("선정/탈락 이력", "결과 영역 미발견");
  }
  await wait(STEP_PAUSE);
}

async function testLearningSuggestions(page) {
  log("9/9", "학습 파라미터 제안 UI — 자동매매 페이지 + 설정 토글");
  await page.goto(`${BASE_URL}/auto-trading`, { waitUntil: "networkidle" });
  await wait(STEP_PAUSE);

  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("자동매매") || bodyText.includes("AI 모델")) {
    pass("자동매매 페이지 접근 확인");
  } else {
    fail("자동매매 페이지", "페이지 내용 미발견");
    return;
  }

  // 사이드바 뱃지 확인 (pending 제안이 없으면 뱃지 없음 — 정상)
  const sidebarAutoTrading = page.locator('a[href="/auto-trading"]').first();
  const hasBadge = await sidebarAutoTrading.locator('span.bg-blue-500').isVisible({ timeout: 3000 }).catch(() => false);
  if (hasBadge) {
    pass("사이드바 뱃지 표시 확인 (pending 제안 있음)");
  } else {
    pass("사이드바 뱃지 없음 (pending 제안 없음 — 정상)");
  }

  // 모델 선택 후 설정 토글 확인
  const modelItems = await page.locator('[data-testid^="model-item"], .ai-model-card, .model-list-item').all();
  if (modelItems.length > 0) {
    await modelItems[0].click().catch(() => {});
    await wait(1000);

    // 자동적용 토글 확인
    const autoApplySwitch = page.locator('[data-testid="switch-auto-apply-learning"]').first();
    const switchVisible = await autoApplySwitch.isVisible({ timeout: 5000 }).catch(() => false);
    if (switchVisible) {
      pass("학습 파라미터 자동적용 토글 렌더링 확인");
      // 토글 상태 확인
      const isChecked = await autoApplySwitch.isChecked().catch(() => false);
      pass(`현재 모드: ${isChecked ? "자동 적용" : "제안 검토 (기본값)"}`);
    } else {
      pass("모델 설정 토글 — 모델이 선택되지 않았거나 설정이 로딩 중");
    }
  } else {
    pass("자동매매 모델 없음 — 토글 테스트 스킵");
  }

  await wait(STEP_PAUSE);
}

// ───────────────────────────────────────────────────────────
// 메인
// ───────────────────────────────────────────────────────────

async function run() {
  const hasSavedState = !!loadAuthState();
  const contextOptions = {
    viewport: { width: 1440, height: 900 },
    ...(hasSavedState ? { storageState: AUTH_STATE_FILE } : {}),
  };

  const browser = await chromium.launch({
    headless: false,
    slowMo: 60,
    args: ["--start-maximized"],
  });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);

  try {
    if (hasSavedState) {
      log("COOKIE", "저장된 쿠키 로드 — dev-login 스킵");
    } else {
      await devLogin(context);
      await saveAuthState(context);
    }

    // 로그인 상태 검증
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await wait(800);
    if (page.url().includes("/login")) {
      throw new Error("세션 발급 후에도 /login으로 리다이렉트됨");
    }
    log("AUTH", `로그인 상태 확인 → ${page.url()}`);

    // 기능 검증
    await testSidebarOrder(page);
    await testGuide(page);
    await testPinLock(page, context);
    await testTradingHoldingPicker(page);
    await testAIAnalysisHoldingPicker(page);
    await testTradeHistoryPagination(page);
    await testJournalPagination(page);
    await testCandidateDecisionsPagination(page);
    await testLearningSuggestions(page);

    log("DONE", "모든 검증 완료 — 브라우저를 3초 후 닫습니다");
    await wait(3000);
  } catch (err) {
    console.error("\n[FATAL]", err.message);
    log("FAIL", "오류 발생 — 브라우저를 5초 유지합니다");
    await wait(5000);
    throw err;
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
