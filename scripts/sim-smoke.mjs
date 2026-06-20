// 전방 섀도우 시뮬레이션 트리거 스모크 테스트 (Track 1)
// 세션 재사용(.playwright-session.json) → /api/auto-trading/simulation/run 호출.
// 실주문 미발생 확인용. 후보 없으면 evaluated=0, 키 없으면 reason 반환 — 어느 쪽이든 안전.
import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://app.wsj-aitradebot.live';
const SESSION_FILE = '.playwright-session.json';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: SESSION_FILE, userAgent: UA });
try {
  const meRes = await ctx.request.get(`${BASE_URL}/api/auth/me`);
  const me = await meRes.json();
  console.log(`auth: ${me.user?.email} role=${me.user?.role}`);

  const models = await (await ctx.request.get(`${BASE_URL}/api/ai/models`)).json();
  console.log(`models: ${models.length}`);
  for (const m of models) {
    console.log(`  - id=${m.id} name=${m.modelName} active=${m.isActive} acct=${m.config?.accountId ?? '-'} sim=${m.config?.isSimulation ?? false}`);
  }

  let src = models.find((m) => !m.config?.isSimulation && m.config?.accountId);
  if (!src) {
    // accountId 있는 모델이 없으면 plumbing만이라도 검증 (안전한 reason 400 기대)
    src = models.find((m) => !m.config?.isSimulation);
    console.log('⚠️  accountId 있는 모델 없음 — 엔드포인트 plumbing만 검증 (reason 반환 기대)');
  }
  if (!src) {
    console.log('⚠️  비-시뮬 모델 자체가 없음 — 스킵');
  } else {
    console.log(`\n▶ runSimCycle 트리거: source modelId=${src.id}`);
    const res = await ctx.request.post(`${BASE_URL}/api/auto-trading/simulation/run`, { data: { modelId: src.id } });
    console.log(`  status: ${res.status()}`);
    console.log(`  body: ${await res.text()}`);

    // 시뮬 모델/계좌가 생성됐는지 확인
    const after = await (await ctx.request.get(`${BASE_URL}/api/ai/models`)).json();
    const simModels = after.filter((m) => m.config?.isSimulation);
    console.log(`  생성된 시뮬 모델: ${simModels.length}개 ${simModels.map((m) => `#${m.id}(${m.modelName})`).join(', ')}`);
  }
} finally {
  await browser.close();
}
