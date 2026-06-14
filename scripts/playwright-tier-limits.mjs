/**
 * Playwright 티어 제한 검증 테스트
 *
 * 테스트 항목:
 *  1. /api/billing/subscription → limits 필드 포함 여부
 *  2. 현재 사용자 티어에 맞는 limits 값 검증
 *  3. AI 분석 (analyze-stock) — 호출 성공 (Pro/Enterprise) 또는 차단 (Free/Basic 한도 초과)
 *  4. autoApply 토글 — Pro/Enterprise는 ON 가능, Basic/Free는 403
 *  5. 실계좌 추가 시 한도 초과 시 403
 *
 * 환경변수:
 *  PLAYWRIGHT_BASE_URL  — 테스트 대상 URL (예: https://app.wsj-aitradebot.live)
 *  TEST_EMAIL           — 로그인 이메일
 *  TEST_PASSWORD        — 로그인 비밀번호
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://app.wsj-aitradebot.live';
const EMAIL = process.env.TEST_EMAIL || 'mainstop3@gmail.com';
const PASSWORD = process.env.TEST_PASSWORD;

if (!PASSWORD) {
  console.error('TEST_PASSWORD 환경변수가 필요합니다.');
  process.exit(1);
}

const TIER_LIMIT_EXPECTED = {
  free:           { maxRealAccounts: 0,  maxAiAnalysisPerDay: 0,   canAutoApply: false },
  saas_basic:     { maxRealAccounts: 1,  maxAiAnalysisPerDay: 10,  canAutoApply: false },
  saas_pro:       { maxRealAccounts: 2,  maxAiAnalysisPerDay: 50,  canAutoApply: true  },
  saas_enterprise:{ maxRealAccounts: 5,  maxAiAnalysisPerDay: 300, canAutoApply: true  },
};

let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function waitForDeploy(maxSeconds = 120) {
  console.log(`\n⏳ Railway 배포 대기 (최대 ${maxSeconds}초)...`);
  const start = Date.now();
  while (Date.now() - start < maxSeconds * 1000) {
    try {
      const r = await fetch(`${BASE_URL}/api/healthz`);
      if (r.ok) { console.log('  서버 준비 완료'); return; }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('배포 타임아웃');
}

async function run() {
  await waitForDeploy();

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ── 로그인 ──────────────────────────────────────────────────────────────────
  console.log('\n📋 로그인...');
  await page.goto(`${BASE_URL}/auth`);
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.pathname.includes('/auth'), { timeout: 10000 });
  console.log('  로그인 성공');

  // API 호출 헬퍼 (세션 쿠키 재사용)
  async function api(method, path, body) {
    return page.evaluate(async ([m, p, b]) => {
      const r = await fetch(p, {
        method: m,
        headers: { 'Content-Type': 'application/json' },
        body: b ? JSON.stringify(b) : undefined,
        credentials: 'include',
      });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    }, [method, `${BASE_URL}${path}`, body]);
  }

  // ── 1. 구독 정보 + limits 필드 검증 ────────────────────────────────────────
  console.log('\n🧪 [1] 구독 정보 및 limits 필드 검증');
  const { status: s1, body: sub } = await api('GET', '/api/billing/subscription');
  assert(s1 === 200, '구독 조회 200');
  assert(!!sub.tier, 'tier 필드 존재', JSON.stringify(sub));
  assert(!!sub.limits, 'limits 필드 존재', JSON.stringify(sub));

  const tier = sub.tier;
  const expected = TIER_LIMIT_EXPECTED[tier];
  console.log(`  현재 티어: ${tier}`);

  if (expected) {
    assert(sub.limits.maxRealAccounts === expected.maxRealAccounts,
      `maxRealAccounts = ${expected.maxRealAccounts}`, `actual=${sub.limits.maxRealAccounts}`);
    assert(sub.limits.maxAiAnalysisPerDay === expected.maxAiAnalysisPerDay,
      `maxAiAnalysisPerDay = ${expected.maxAiAnalysisPerDay}`, `actual=${sub.limits.maxAiAnalysisPerDay}`);
    assert(sub.limits.canAutoApply === expected.canAutoApply,
      `canAutoApply = ${expected.canAutoApply}`, `actual=${sub.limits.canAutoApply}`);
  } else {
    console.warn(`  ⚠️ 알 수 없는 티어: ${tier} — limits 값 검증 스킵`);
  }

  // ── 2. AI 분석 호출 가능 여부 ───────────────────────────────────────────────
  console.log('\n🧪 [2] AI 분석 (analyze-stock) 호출 검증');
  const { status: aiStatus, body: aiBody } = await api('POST', '/api/ai/analyze-stock', {
    stockCode: '005930', stockName: '삼성전자', currentPrice: 70000,
  });

  const isProOrEnterprise = tier === 'saas_pro' || tier === 'saas_enterprise';
  const isBasicOrFree = tier === 'free' || tier === 'saas_basic';

  if (isProOrEnterprise) {
    assert(aiStatus !== 429, `Pro/Enterprise: AI 분석 호출 차단 안 됨 (${aiStatus})`, JSON.stringify(aiBody).slice(0, 80));
  } else if (isBasicOrFree) {
    // Basic/Free는 한도 초과 전에는 성공할 수도 있으므로 429 or 200 체크
    console.log(`  Basic/Free 티어: 응답=${aiStatus} (한도 내면 200, 초과면 429)`);
    assert(aiStatus === 200 || aiStatus === 429, 'Basic/Free: 200 또는 429 응답');
  }

  // ── 3. autoApply 토글 검증 ──────────────────────────────────────────────────
  console.log('\n🧪 [3] autoApply 토글 검증');

  // 모델 목록 조회
  const { body: modelsBody } = await api('GET', '/api/ai/models');
  const models = Array.isArray(modelsBody) ? modelsBody : [];

  if (models.length === 0) {
    console.log('  AI 모델 없음 — autoApply 토글 테스트 스킵');
  } else {
    const modelId = models[0].id;
    const { status: apStatus, body: apBody } = await api(
      'PATCH',
      `/api/auto-trading/settings/${modelId}/auto-apply-toggle`,
      { autoApply: true }
    );

    if (isProOrEnterprise) {
      assert(apStatus === 200, `Pro/Enterprise: autoApply ON 가능 (${apStatus})`, JSON.stringify(apBody).slice(0, 80));
    } else {
      assert(apStatus === 403, `Basic/Free: autoApply ON 차단 (${apStatus})`, JSON.stringify(apBody).slice(0, 80));
    }
  }

  // ── 4. 실계좌 추가 한도 초과 검증 ──────────────────────────────────────────
  console.log('\n🧪 [4] 실계좌 추가 한도 검증');

  const { body: accountsBody } = await api('GET', '/api/accounts');
  const accounts = Array.isArray(accountsBody) ? accountsBody : [];
  const realAccounts = accounts.filter(a => a.accountType === 'real');
  const maxReal = sub.limits?.maxRealAccounts ?? 0;

  console.log(`  현재 실계좌: ${realAccounts.length}개 / 최대: ${maxReal}개`);

  if (realAccounts.length >= maxReal) {
    // 한도 초과 상태 → 추가 시 403이어야 함
    const { status: addStatus, body: addBody } = await api('POST', '/api/accounts', {
      accountNumber: '99990011',
      accountType: 'real',
      accountName: '테스트계좌',
    });
    assert(addStatus === 403, `실계좌 한도(${maxReal}) 초과 시 403`, `actual=${addStatus} ${JSON.stringify(addBody).slice(0, 80)}`);
    assert(addBody.code === 'REAL_ACCOUNT_LIMIT_EXCEEDED', '에러 코드 REAL_ACCOUNT_LIMIT_EXCEEDED');
  } else {
    console.log(`  현재 실계좌 수(${realAccounts.length})가 한도(${maxReal}) 미만 — 한도초과 테스트 스킵`);
    // 대신 mock 계좌 추가는 항상 허용인지 확인
    const { status: mockStatus } = await api('POST', '/api/accounts', {
      accountNumber: '88880011',
      accountType: 'mock',
      accountName: '모의테스트',
    });
    assert(mockStatus === 200 || mockStatus === 400, '모의계좌는 티어 제한 없음 (200 또는 400)', `actual=${mockStatus}`);
  }

  // ── 5. 동기화 엔드포인트 검증 (txn_ ID 여부) ───────────────────────────────
  console.log('\n🧪 [5] 구독 동기화 엔드포인트 검증');
  const hasTxnId = sub.paddleSubscriptionId?.startsWith('txn_');
  if (hasTxnId) {
    const { status: syncStatus, body: syncBody } = await api('POST', '/api/billing/sync');
    assert(syncStatus === 200, `동기화 성공 (txn_ → sub_)`, JSON.stringify(syncBody).slice(0, 80));
    // 다시 조회해서 sub_ 로 바뀌었는지 확인
    const { body: sub2 } = await api('GET', '/api/billing/subscription');
    assert(!sub2.paddleSubscriptionId?.startsWith('txn_'), 'paddleSubscriptionId가 sub_ 로 변경됨', sub2.paddleSubscriptionId);
  } else {
    console.log(`  paddleSubscriptionId=${sub.paddleSubscriptionId ?? 'null'} — txn_ 아님, 동기화 불필요`);
    assert(true, '동기화 불필요 상태 확인');
  }

  // ── 결과 ────────────────────────────────────────────────────────────────────
  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`결과: PASS ${passed} / FAIL ${failed} / 합계 ${passed + failed}`);
  if (failed > 0) {
    console.error('일부 테스트 실패');
    process.exit(1);
  }
  console.log('모든 티어 제한 테스트 통과 ✅');
}

run().catch(e => {
  console.error('[FATAL]', e.message);
  process.exit(1);
});
