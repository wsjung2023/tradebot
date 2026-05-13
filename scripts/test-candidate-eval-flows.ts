import { TradeExecutorService } from "../server/services/trade-executor.service";
import { storage } from "../server/storage";

type AnyObj = Record<string, any>;

function makeBaseSettings(): AnyObj {
  return {
    defaultPositionSize: "1000000",
    maxPositionSize: "10000000",
    maxDailyTrades: 5,
    enableDynamicExit: true,
    stalePeriodDays: 5,
    surgeThreshold: "10",
    volumeSpikeMultiplier: "3",
    rainbowLineSettings: [],
    minAiConfidence: "70",
    themeWeight: "20",
    newsWeight: "15",
    financialsWeight: "25",
    liquidityWeight: "20",
    institutionalWeight: "20",
    requireGoodFinancials: true,
    requireHighLiquidity: true,
    requireMarketIssue: false,
    baseUnitSize: "500000",
    maxUnitsPerStock: 5,
    entryLadderSettings: [
      { line: 50, units: 1 },
      { line: 40, units: 1 },
      { line: 30, units: 1 },
      { line: 20, units: 1 },
      { line: 10, units: 1 },
    ],
    stopLossPolicy: { mode: "disabled", hardCutLossPct: 10 },
    allowAiDoubleDown: false,
    allowAiPartialTakeProfit: false,
    allowAiHoldBeyondTarget: false,
    allowSpeculativeLeaderTrades: false,
    aiEntryPolicy: {
      candidateDecisionCooldownMode: "interval_120m",
      disableReevaluationForBoughtToday: false,
    },
  };
}

async function run() {
  const svc = new TradeExecutorService() as any;
  const baseSettings = makeBaseSettings();
  const model = {
    id: 7,
    userId: "u1",
    modelName: "m7",
    modelType: "custom",
    config: { accountId: 20 },
  };
  const candidate = {
    id: 1,
    modelId: 7,
    stockCode: "246690",
    stockName: "TS인베스트먼트",
    source: "test",
    scannedLine: 50,
  };
  const kiwoomService = {
    getStockPrice: async () => ({ output: { stck_prpr: "1800" } }),
  };
  const aiService = {};

  const original = {
    getLatestCandidateDecisionByCooldownKey: (storage as any).getLatestCandidateDecisionByCooldownKey,
    updateCandidateEvaluation: (storage as any).updateCandidateEvaluation,
    createCandidateDecisionLog: (storage as any).createCandidateDecisionLog,
    getKiwoomAccounts: (storage as any).getKiwoomAccounts,
    getHoldings: (storage as any).getHoldings,
    getTradingPerformanceByStock: (storage as any).getTradingPerformanceByStock,
    getOrders: (storage as any).getOrders,
    getMarketIssuesByStock: (storage as any).getMarketIssuesByStock,
    createEngineNotification: (storage as any).createEngineNotification,
  };

  const decisions: Array<{ decisionType?: string; rejectReason?: string | null; accepted?: boolean; cooldownKey?: string | null; cooldownMode?: string | null }> = [];
  const restore = () => {
    (storage as any).getLatestCandidateDecisionByCooldownKey = original.getLatestCandidateDecisionByCooldownKey;
    (storage as any).updateCandidateEvaluation = original.updateCandidateEvaluation;
    (storage as any).createCandidateDecisionLog = original.createCandidateDecisionLog;
    (storage as any).getKiwoomAccounts = original.getKiwoomAccounts;
    (storage as any).getHoldings = original.getHoldings;
    (storage as any).getTradingPerformanceByStock = original.getTradingPerformanceByStock;
    (storage as any).getOrders = original.getOrders;
    (storage as any).getMarketIssuesByStock = original.getMarketIssuesByStock;
    (storage as any).createEngineNotification = original.createEngineNotification;
  };

  try {
    (storage as any).getLatestCandidateDecisionByCooldownKey = async () => undefined;
    (storage as any).updateCandidateEvaluation = async () => ({});
    (storage as any).createCandidateDecisionLog = async (d: any) => {
      decisions.push({
        decisionType: d?.aiDecision?.decisionType,
        rejectReason: d?.rejectReason,
        accepted: d?.accepted,
        cooldownKey: d?.aiDecision?.cooldownKey ?? null,
        cooldownMode: d?.aiDecision?.cooldownMode ?? null,
      });
      return d;
    };
    (storage as any).getKiwoomAccounts = async () => [{ id: 20 }];
    (storage as any).getHoldings = async () => [];
    (storage as any).getTradingPerformanceByStock = async () => undefined;
    (storage as any).getOrders = async () => [];
    (storage as any).getMarketIssuesByStock = async () => [];
    (storage as any).createEngineNotification = async () => ({});

    let aiCalls = 0;
    let buyCalls = 0;
    svc.evaluate10LineRainbow = async () => ({ currentLine: 60, action: "hold", weight: 0, confidence: 0 });
    svc.comprehensiveAiAnalysis = async () => {
      aiCalls += 1;
      return {
        confidence: 99,
        hasGoodFinancials: true,
        hasHighLiquidity: true,
        dartDangerKeyword: null,
        themeScore: 80,
        newsScore: 80,
        financialsScore: 80,
        liquidityScore: 80,
        institutionalScore: 80,
      };
    };
    svc.executeBuy = async () => { buyCalls += 1; };
    svc.executeAdditionalBuy = async () => { buyCalls += 1; };

    // CASE 1: precheck fail(line 60) => no AI call
    decisions.length = 0;
    aiCalls = 0;
    await svc.evaluateCandidateStock(model, baseSettings, candidate, kiwoomService, aiService, "gpt-5-mini");
    const c1 = decisions[0]?.decisionType === "filter_entry_line_or_unit" && aiCalls === 0;

    // CASE 2: precheck pass + bought today disabled => skip before AI
    decisions.length = 0;
    aiCalls = 0;
    svc.evaluate10LineRainbow = async () => ({ currentLine: 50, action: "buy", weight: 80, confidence: 80 });
    (storage as any).getOrders = async () => [
      { isAutoTrading: true, orderType: "buy", stockCode: "246690", createdAt: new Date() },
    ];
    const settingsCase2 = {
      ...baseSettings,
      aiEntryPolicy: {
        ...baseSettings.aiEntryPolicy,
        disableReevaluationForBoughtToday: true,
      },
    };
    await svc.evaluateCandidateStock(model, settingsCase2, candidate, kiwoomService, aiService, "gpt-5-mini");
    const c2 = decisions[0]?.decisionType === "filter_bought_today_recheck_disabled" && aiCalls === 0;

    // CASE 3: precheck pass + no bought today => AI called and entry selected
    decisions.length = 0;
    aiCalls = 0;
    buyCalls = 0;
    (storage as any).getOrders = async () => [];
    await svc.evaluateCandidateStock(model, baseSettings, candidate, kiwoomService, aiService, "gpt-5-mini");
    const c3 = decisions[0]?.decisionType === "entry_selected" && aiCalls === 1 && buyCalls === 1;
    const c4 = !!decisions[0]?.cooldownKey && decisions[0]?.cooldownMode === "interval_120m";

    const results = [
      { name: "precheck_line_before_ai", ok: c1 },
      { name: "bought_today_toggle_blocks_before_ai", ok: c2 },
      { name: "eligible_path_calls_ai_and_executes_buy", ok: c3 },
      { name: "decision_log_includes_cooldown_key", ok: c4 },
    ];

    for (const r of results) {
      console.log(`${r.ok ? "PASS" : "FAIL"} - ${r.name}`);
    }
    const failed = results.filter((r) => !r.ok);
    console.log(`SUMMARY total=${results.length} passed=${results.length - failed.length} failed=${failed.length}`);
    if (failed.length > 0) process.exit(1);
  } finally {
    restore();
  }
}

run().catch((err) => {
  console.error("test-candidate-eval-flows failed:", err);
  process.exit(1);
});
