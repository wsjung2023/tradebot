// 변종 시합 스모크 (Track 1) — 세션 재사용으로 race/run + race/settle 검증. 실주문 0건 확인.
import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://app.wsj-aitradebot.live';
const SESSION_FILE = '.playwright-session.json';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: SESSION_FILE, userAgent: UA });
try {
  const models = await (await ctx.request.get(`${BASE_URL}/api/ai/models`)).json();
  const src = models.find((m) => !m.config?.isSimulation && m.config?.accountId) || models.find((m) => !m.config?.isSimulation);
  if (!src) { console.log('⚠️ 비-시뮬 모델 없음 — 스킵'); }
  else {
    console.log(`▶ race/run: source #${src.id}`);
    const run = await ctx.request.post(`${BASE_URL}/api/auto-trading/simulation/race/run`, { data: { modelId: src.id, count: 5 } });
    console.log(`  run status=${run.status()} body=${(await run.text()).slice(0, 500)}`);

    const after = await (await ctx.request.get(`${BASE_URL}/api/ai/models`)).json();
    const sims = after.filter((m) => m.config?.isSimulation && m.config?.sourceModelId === src.id);
    console.log(`  변종 sim 모델: ${sims.length}개 ${sims.map((m) => `v${m.config?.variantId}`).join(',')}`);

    console.log(`▶ race/settle: source #${src.id}`);
    const settle = await ctx.request.post(`${BASE_URL}/api/auto-trading/simulation/race/settle`, { data: { modelId: src.id, minTrades: 1 } });
    console.log(`  settle status=${settle.status()} body=${(await settle.text()).slice(0, 500)}`);
  }
} finally {
  await browser.close();
}
