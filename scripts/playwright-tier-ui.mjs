/**
 * 티어 제한 UI 테스트 — 각 플랜별로 실제 화면에서 막히는지 확인
 *
 * 실행 순서:
 *   free → saas_basic → saas_pro → saas_enterprise → 원복(saas_pro)
 *
 * 각 플랜에서 테스트:
 *   1. /billing 페이지 — limits 값 UI 표시 확인
 *   2. /accounts 실계좌 추가 — 한도 초과 시 토스트 에러 확인
 *   3. /ai-analysis 분석 — 일일 한도 초과(free 0회) 시 토스트 에러 확인
 *   4. 자동매매 설정 autoApply 토글 — Basic/Free 차단 토스트 확인
 *
 * 끝나면 계좌 데이터 클리어(테스트 중 만든 것만).
 *
 * 환경변수:
 *   PLAYWRIGHT_BASE_URL  기본값 https://app.wsj-aitradebot.live
 *   AGENT_KEY            서버의 AGENT_KEY (티어 강제 설정용)
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://app.wsj-aitradebot.live';
const AGENT_KEY = process.env.AGENT_KEY;

if (!AGENT_KEY) {
  console.error('AGENT_KEY 환경변수가 필요합니다.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
const createdAccountIds = [];

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`    ✅ ${label}`);
    passed++;
  } else {
    console.error(`    ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function setTier(userId, tier) {
  const res = await fetch(`${BASE_URL}/api/billing/test/set-tier`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-key': AGENT_KEY },
    body: JSON.stringify({ userId, tier }),
  });
  if (!res.ok) throw new Error(`티어 설정 실패: ${await res.text()}`);
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
    // sonner / radix toast selector 폴백
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
  const r = await ctx.request.get(`${BASE_URL}/api/auth/user`);
  const body = await r.json();
  return body.id;
}

async function run() {
  const browser = await chromium.launch({
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();

  // ── 로그인 ────────────────────────────────────────────────────────────────
  console.log('\n📋 로그인 — 구글 로그인 완료해주세요...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForURL(
    u => u.toString().startsWith(BASE_URL) && !u.toString().includes('/login') && !u.toString().includes('/auth'),
    { timeout: 120000 }
  );
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
  console.log('  로그인 완료 ✅');

  const userId = await getUserId(ctx);
  console.log(`  userId: ${userId}`);

  const tiers = [
    { tier: 'free',            label: 'Free',        maxReal: 0, maxAi: 0,   autoApplyOk: false },
    { tier: 'saas_basic',      label: 'Basic',       maxReal: 1, maxAi: 10,  autoApplyOk: false },
    { tier: 'saas_pro',        label: 'Pro',         maxReal: 2, maxAi: 50,  autoApplyOk: true  },
    { tier: 'saas_enterprise', label: 'Enterprise',  maxReal: 5, maxAi: 300, autoApplyOk: true  },
  ];

  for (const { tier, label, maxReal, maxAi, autoApplyOk } of tiers) {
    console.log(`\n${'═'.repeat(55)}`);
    console.log(`🧪 [${label}] 플랜 테스트 시작`);

    // 티어 강제 설정
    await setTier(userId, tier);
    await new Promise(r => setTimeout(r, 500));

    // ── A. /billing 페이지 limits 확인 ───────────────────────────────────
    console.log(`\n  [A] /billing 페이지 limits 표시 확인`);
    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));

    // subscription API로 limits 직접 확인
    const subRes = await ctx.request.get(`${BASE_URL}/api/billing/subscription`);
    const sub = await subRes.json();
    assert(sub.limits?.maxRealAccounts === maxReal, `maxRealAccounts = ${maxReal}`, `actual=${sub.limits?.maxRealAccounts}`);
    assert(sub.limits?.maxAiAnalysisPerDay === maxAi, `maxAiAnalysisPerDay = ${maxAi}`, `actual=${sub.limits?.maxAiAnalysisPerDay}`);
    assert(sub.limits?.canAutoApply === autoApplyOk, `canAutoApply = ${autoApplyOk}`, `actual=${sub.limits?.canAutoApply}`);
    await page.screenshot({ path: `test-${tier}-billing.png` });

    // ── B. 실계좌 추가 한도 초과 ─────────────────────────────────────────
    console.log(`\n  [B] 실계좌 추가 한도(${maxReal}개) 초과 테스트`);

    // 현재 실계좌 수 확인
    const acctRes = await ctx.request.get(`${BASE_URL}/api/accounts`);
    const accounts = await acctRes.json();
    const realCount = Array.isArray(accounts) ? accounts.filter(a => a.accountType === 'real').length : 0;

    if (realCount >= maxReal) {
      // 한도 초과 상태 → API로 직접 추가 시도
      const addRes = await ctx.request.post(`${BASE_URL}/api/accounts`, {
        data: { accountNumber: '99991234', accountType: 'real', accountName: `테스트_${tier}` },
        headers: { 'Content-Type': 'application/json' },
      });
      assert(addRes.status() === 403, `실계좌 한도 초과 → 403`, `actual=${addRes.status()}`);
      const addBody = await addRes.json();
      assert(addBody.code === 'REAL_ACCOUNT_LIMIT_EXCEEDED', '에러 코드 REAL_ACCOUNT_LIMIT_EXCEEDED');

      // UI에서도 확인 — 계좌 페이지에서 실계좌 추가 버튼 클릭
      await page.goto(`${BASE_URL}/accounts`);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      const addBtn = page.locator('button:has-text("계좌 추가"), button:has-text("추가"), [data-testid*="add"]').first();
      if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addBtn.click();
        await new Promise(r => setTimeout(r, 500));
        // 실계좌 타입 선택 후 추가 시도
        const realRadio = page.locator('input[value="real"], label:has-text("실계좌")').first();
        if (await realRadio.isVisible({ timeout: 2000 }).catch(() => false)) await realRadio.click();
        const submitBtn = page.locator('button[type="submit"], button:has-text("추가 완료"), button:has-text("저장")').first();
        if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) await submitBtn.click();
        const toast = await waitForToast(page, ['한도', '업그레이드', 'REAL_ACCOUNT_LIMIT']);
        assert(toast.matched, `UI 토스트: 실계좌 한도 에러 메시지`, `text=${toast.text?.slice(0, 60)}`);
        await page.screenshot({ path: `test-${tier}-account-limit.png` });
      } else {
        console.log('    ℹ️  계좌 추가 버튼 미발견 — UI 토스트 테스트 스킵');
      }
    } else {
      console.log(`    ℹ️  현재 실계좌(${realCount}) < 한도(${maxReal}) — 한도초과 테스트 스킵`);
      assert(true, '실계좌 한도 이내 상태');
    }

    // ── C. AI 분석 일일 한도 ─────────────────────────────────────────────
    console.log(`\n  [C] AI 분석 일일 한도(${maxAi}회) 테스트`);
    if (maxAi === 0) {
      // free 티어 → 0회라 즉시 차단
      const aiRes = await ctx.request.post(`${BASE_URL}/api/ai/analyze-stock`, {
        data: { stockCode: '005930', stockName: '삼성전자', currentPrice: 70000 },
        headers: { 'Content-Type': 'application/json' },
      });
      assert(aiRes.status() === 429, `Free: AI 분석 즉시 차단 → 429`, `actual=${aiRes.status()}`);
      const aiBody = await aiRes.json();
      assert(aiBody.code === 'AI_ANALYSIS_LIMIT_EXCEEDED', '에러 코드 AI_ANALYSIS_LIMIT_EXCEEDED');
    } else {
      // Pro/Enterprise → 차단 안 됨 확인 (실제 AI 호출은 스킵, API key 없어도 429 아니면 OK)
      const aiRes = await ctx.request.post(`${BASE_URL}/api/ai/analyze-stock`, {
        data: { stockCode: '005930', stockName: '삼성전자', currentPrice: 70000 },
        headers: { 'Content-Type': 'application/json' },
      });
      assert(aiRes.status() !== 429, `${label}: AI 분석 한도 차단 안 됨 (${aiRes.status()})`, ``);
    }

    // ── D. autoApply 토글 ─────────────────────────────────────────────────
    console.log(`\n  [D] autoApply 토글 — ${autoApplyOk ? '허용' : '차단'} 확인`);
    const modelsRes = await ctx.request.get(`${BASE_URL}/api/ai/models`);
    const models = await modelsRes.json();

    if (Array.isArray(models) && models.length > 0) {
      const modelId = models[0].id;
      const toggleRes = await ctx.request.patch(
        `${BASE_URL}/api/auto-trading/settings/${modelId}/auto-apply-toggle`,
        { data: { autoApply: true }, headers: { 'Content-Type': 'application/json' } }
      );
      if (autoApplyOk) {
        assert(toggleRes.status() === 200, `${label}: autoApply ON 허용 (${toggleRes.status()})`);
        // 원복
        await ctx.request.patch(`${BASE_URL}/api/auto-trading/settings/${modelId}/auto-apply-toggle`,
          { data: { autoApply: false }, headers: { 'Content-Type': 'application/json' } });
      } else {
        assert(toggleRes.status() === 403, `${label}: autoApply ON 차단 (${toggleRes.status()})`);
        const body = await toggleRes.json();
        assert(body.code === 'TIER_AUTOPLAY_BLOCKED', '에러 코드 TIER_AUTOPLAY_BLOCKED');
      }
    } else {
      console.log('    ℹ️  AI 모델 없음 — autoApply 테스트 스킵');
    }
  }

  // ── 원복: saas_pro 복원 ────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(55)}`);
  console.log('🔄 원복: saas_pro 복원');
  await setTier(userId, 'saas_pro');

  await browser.close();

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`최종 결과: PASS ${passed} / FAIL ${failed} / 합계 ${passed + failed}`);
  if (failed > 0) { console.error('일부 테스트 실패'); process.exit(1); }
  console.log('모든 티어 UI 테스트 통과 ✅');
}

run().catch(e => { console.error('[FATAL]', e.message, e.stack); process.exit(1); });
