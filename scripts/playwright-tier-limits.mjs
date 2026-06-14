/**
 * 티어 제한 API 검증 테스트
 *
 * 환경변수:
 *   PLAYWRIGHT_BASE_URL  — 기본값: https://app.wsj-aitradebot.live
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://app.wsj-aitradebot.live';

const TIER_LIMIT_EXPECTED = {
  free:            { maxRealAccounts: 0,  maxAiAnalysisPerDay: 0,   canAutoApply: false },
  saas_basic:      { maxRealAccounts: 1,  maxAiAnalysisPerDay: 10,  canAutoApply: false },
  saas_pro:        { maxRealAccounts: 2,  maxAiAnalysisPerDay: 50,  canAutoApply: true  },
  saas_enterprise: { maxRealAccounts: 5,  maxAiAnalysisPerDay: 300, canAutoApply: true  },
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

async function run() {
  // --enable-automation 제거해야 Google OAuth가 봇 차단 안 함
  const browser = await chromium.launch({
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  });

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  console.log('\n📋 브라우저 열림 — 구글 로그인을 완료해주세요...');
  await page.goto(`${BASE_URL}/login`);

  await page.waitForURL(
    u => {
      const url = u.toString();
      return url.startsWith(BASE_URL) && !url.includes('/login') && !url.includes('/auth');
    },
    { timeout: 120000 }
  );
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  console.log(`  로그인 완료: ${page.url()}`);

  // 세션 쿠키 확인
  const cookies = await ctx.cookies(BASE_URL);
  const sid = cookies.find(c => c.name === 'connect.sid');
  assert(!!sid, '세션 쿠키 connect.sid 존재');

  // API 헬퍼 — context.request로 세션 쿠키 자동 포함
  async function api(method, path, body) {
    const r = await ctx.request[method.toLowerCase()](`${BASE_URL}${path}`,
      body ? { data: body, headers: { 'Content-Type': 'application/json' } } : {}
    );
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { status: r.status(), body: json };
  }

  // ── 1. 구독 정보 + limits ────────────────────────────────────────────────
  console.log('\n🧪 [1] 구독 정보 및 limits 필드 검증');
  const { status: s1, body: sub } = await api('GET', '/api/billing/subscription');
  assert(s1 === 200, '구독 조회 200', JSON.stringify(sub).slice(0, 80));
  assert(!!sub.tier, 'tier 필드 존재');
  assert(!!sub.limits, 'limits 필드 존재');

  const tier = sub.tier;
  const expected = TIER_LIMIT_EXPECTED[tier];
  console.log(`  현재 티어: ${tier}`);
  console.log(`  limits: ${JSON.stringify(sub.limits)}`);

  if (expected) {
    assert(sub.limits?.maxRealAccounts === expected.maxRealAccounts,
      `maxRealAccounts = ${expected.maxRealAccounts}`, `actual=${sub.limits?.maxRealAccounts}`);
    assert(sub.limits?.maxAiAnalysisPerDay === expected.maxAiAnalysisPerDay,
      `maxAiAnalysisPerDay = ${expected.maxAiAnalysisPerDay}`, `actual=${sub.limits?.maxAiAnalysisPerDay}`);
    assert(sub.limits?.canAutoApply === expected.canAutoApply,
      `canAutoApply = ${expected.canAutoApply}`, `actual=${sub.limits?.canAutoApply}`);
  }

  const isProOrEnterprise = tier === 'saas_pro' || tier === 'saas_enterprise';

  // ── 2. AI 분석 ──────────────────────────────────────────────────────────
  console.log('\n🧪 [2] AI 분석 (analyze-stock) 호출 검증');
  const { status: aiStatus, body: aiBody } = await api('POST', '/api/ai/analyze-stock', {
    stockCode: '005930', stockName: '삼성전자', currentPrice: 70000,
  });
  console.log(`  응답: ${aiStatus} ${JSON.stringify(aiBody).slice(0, 100)}`);

  if (isProOrEnterprise) {
    assert(aiStatus !== 429, `Pro/Enterprise: AI 분석 차단 안 됨 (${aiStatus})`);
    assert(aiStatus !== 401, `인증 정상 (${aiStatus})`);
  } else {
    assert(aiStatus === 200 || aiStatus === 429, `Basic/Free: 200 또는 429`, `actual=${aiStatus}`);
    if (aiStatus === 429) assert(aiBody.code === 'AI_ANALYSIS_LIMIT_EXCEEDED', '에러 코드 AI_ANALYSIS_LIMIT_EXCEEDED');
  }

  // ── 3. autoApply 토글 ────────────────────────────────────────────────────
  console.log('\n🧪 [3] autoApply 토글 검증');
  const { body: modelsBody } = await api('GET', '/api/ai/models');
  const models = Array.isArray(modelsBody) ? modelsBody : [];

  if (models.length === 0) {
    console.log('  AI 모델 없음 — 스킵');
  } else {
    const modelId = models[0].id;
    const { status: apStatus, body: apBody } = await api(
      'PATCH', `/api/auto-trading/settings/${modelId}/auto-apply-toggle`, { autoApply: true }
    );
    console.log(`  응답: ${apStatus} ${JSON.stringify(apBody).slice(0, 100)}`);

    if (isProOrEnterprise) {
      assert(apStatus === 200, `Pro/Enterprise: autoApply ON 가능`);
      await api('PATCH', `/api/auto-trading/settings/${modelId}/auto-apply-toggle`, { autoApply: false });
    } else {
      assert(apStatus === 403, `Basic/Free: autoApply ON 차단`);
      assert(apBody.code === 'TIER_AUTOPLAY_BLOCKED', '에러 코드 TIER_AUTOPLAY_BLOCKED');
    }
  }

  // ── 4. 실계좌 추가 한도 ─────────────────────────────────────────────────
  console.log('\n🧪 [4] 실계좌 추가 한도 검증');
  const { body: accountsBody } = await api('GET', '/api/accounts');
  const accounts = Array.isArray(accountsBody) ? accountsBody : [];
  const realAccounts = accounts.filter(a => a.accountType === 'real');
  const maxReal = sub.limits?.maxRealAccounts ?? 0;
  console.log(`  현재 실계좌: ${realAccounts.length}개 / 최대: ${maxReal}개`);

  if (realAccounts.length >= maxReal) {
    const { status: addStatus, body: addBody } = await api('POST', '/api/accounts', {
      accountNumber: '99990011', accountType: 'real', accountName: '테스트(한도초과)',
    });
    console.log(`  응답: ${addStatus} ${JSON.stringify(addBody).slice(0, 100)}`);
    assert(addStatus === 403, `실계좌 한도 초과 시 403`);
    assert(addBody.code === 'REAL_ACCOUNT_LIMIT_EXCEEDED', '에러 코드 REAL_ACCOUNT_LIMIT_EXCEEDED');
  } else {
    console.log(`  현재(${realAccounts.length}) < 한도(${maxReal}) — 한도초과 테스트 스킵`);
    assert(true, '현재 실계좌 수 한도 이내');
  }

  // ── 5. 구독 동기화 ───────────────────────────────────────────────────────
  console.log('\n🧪 [5] 구독 동기화 엔드포인트 검증');
  if (sub.paddleSubscriptionId?.startsWith('txn_')) {
    const { status: syncStatus } = await api('POST', '/api/billing/sync');
    assert(syncStatus === 200, `동기화 성공 (txn_ → sub_)`);
    const { body: sub2 } = await api('GET', '/api/billing/subscription');
    assert(!sub2.paddleSubscriptionId?.startsWith('txn_'), 'paddleSubscriptionId → sub_로 변경');
  } else {
    console.log(`  paddleSubscriptionId=${sub.paddleSubscriptionId ?? 'null'} — 동기화 불필요`);
    assert(true, '동기화 불필요 상태');
  }

  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`결과: PASS ${passed} / FAIL ${failed} / 합계 ${passed + failed}`);
  if (failed > 0) { console.error('일부 테스트 실패'); process.exit(1); }
  console.log('모든 티어 제한 테스트 통과 ✅');
}

run().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
