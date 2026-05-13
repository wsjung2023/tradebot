import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../server/db";
import * as schema from "../shared/schema";

type DecisionRow = {
  id: number;
  stockCode: string;
  stockName: string;
  accepted: boolean;
  rejectReason: string | null;
  decidedAt: Date;
  aiDecision: any;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const result: { modelId: number; date: string } = {
    modelId: 7,
    date: getKstDateString(new Date(Date.now() - 24 * 60 * 60 * 1000)),
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--model" && args[i + 1]) {
      result.modelId = Number(args[++i]);
    } else if (a === "--date" && args[i + 1]) {
      result.date = String(args[++i]);
    }
  }
  return result;
}

function getKstDateString(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function kstWindow(date: string) {
  const start = new Date(`${date}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function fmtKst(d: Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
}

function pushCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1);
}

async function main() {
  const { modelId, date } = parseArgs();
  const { start, end } = kstWindow(date);

  const model = await db.select().from(schema.aiModels).where(eq(schema.aiModels.id, modelId)).limit(1);
  if (!model[0]) {
    console.error(`MODEL_NOT_FOUND modelId=${modelId}`);
    process.exit(1);
  }
  const m = model[0];

  const settings = await db
    .select()
    .from(schema.autoTradingSettings)
    .where(eq(schema.autoTradingSettings.modelId, modelId))
    .limit(1);
  const policy = (settings[0]?.aiEntryPolicy as any) || {};

  const decisions = (await db
    .select({
      id: schema.candidateDecisionLogs.id,
      stockCode: schema.candidateDecisionLogs.stockCode,
      stockName: schema.candidateDecisionLogs.stockName,
      accepted: schema.candidateDecisionLogs.accepted,
      rejectReason: schema.candidateDecisionLogs.rejectReason,
      decidedAt: schema.candidateDecisionLogs.decidedAt,
      aiDecision: schema.candidateDecisionLogs.aiDecision,
    })
    .from(schema.candidateDecisionLogs)
    .where(
      and(
        eq(schema.candidateDecisionLogs.modelId, modelId),
        gte(schema.candidateDecisionLogs.decidedAt, start),
        lt(schema.candidateDecisionLogs.decidedAt, end),
      ),
    )
    .orderBy(desc(schema.candidateDecisionLogs.decidedAt))) as DecisionRow[];

  const orders = await db
    .select({
      id: schema.orders.id,
      orderType: schema.orders.orderType,
      stockCode: schema.orders.stockCode,
      stockName: schema.orders.stockName,
      orderQuantity: schema.orders.orderQuantity,
      orderPrice: schema.orders.orderPrice,
      createdAt: schema.orders.createdAt,
    })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.aiModelId, modelId),
        eq(schema.orders.isAutoTrading, true),
        gte(schema.orders.createdAt, start),
        lt(schema.orders.createdAt, end),
      ),
    )
    .orderBy(desc(schema.orders.createdAt));

  const evalRows = await db
    .select({
      stockCode: schema.candidateStocks.stockCode,
      stockName: schema.candidateStocks.stockName,
      skipReason: schema.candidateStocks.skipReason,
      evaluatedAt: schema.candidateStocks.evaluatedAt,
    })
    .from(schema.candidateStocks)
    .where(
      and(
        eq(schema.candidateStocks.userId, m.userId),
        eq(schema.candidateStocks.modelId, modelId),
        gte(schema.candidateStocks.evaluatedAt, start),
        lt(schema.candidateStocks.evaluatedAt, end),
      ),
    );

  const usageRows = await db
    .select()
    .from(schema.aiUsageDaily)
    .where(and(eq(schema.aiUsageDaily.userId, m.userId), eq(schema.aiUsageDaily.usageDate, date)));

  const accepted = decisions.filter((d) => d.accepted).length;
  const rejected = decisions.length - accepted;

  const byDecisionType = new Map<string, number>();
  const byRejectReason = new Map<string, number>();
  const byStock = new Map<string, number>();
  const cooldownDup = new Map<string, number>();
  const byCooldownKey = new Map<string, number>();
  const stockCooldownMap = new Map<string, Map<string, number>>();
  const exceptionErrors = new Map<string, number>();
  let missingCooldownKeyCount = 0;

  for (const d of decisions) {
    const ai = d.aiDecision || {};
    const decisionType = String(ai.decisionType || "unknown");
    const cooldownKey = String(ai.cooldownKey || "");
    pushCount(byDecisionType, decisionType);
    pushCount(byStock, `${d.stockCode}:${d.stockName || d.stockCode}`);
    if (!d.accepted) pushCount(byRejectReason, String(d.rejectReason || "unknown"));
    if (decisionType === "evaluation_exception") {
      const err = String(ai?.quantitativeReason?.error || "unknown");
      pushCount(exceptionErrors, err);
    }
    if (cooldownKey) {
      const k = `${d.stockCode}|${cooldownKey}`;
      pushCount(cooldownDup, k);
      pushCount(byCooldownKey, cooldownKey);
      if (!stockCooldownMap.has(d.stockCode)) stockCooldownMap.set(d.stockCode, new Map<string, number>());
      pushCount(stockCooldownMap.get(d.stockCode)!, cooldownKey);
    } else {
      missingCooldownKeyCount += 1;
    }
  }

  const cooldownViolationCount = [...cooldownDup.values()].filter((v) => v > 1).length;
  const cooldownBlockedCurrentState = evalRows.filter((r) => r.skipReason === "decision_cooldown_active").length;

  const usageReq = usageRows.reduce((s, r) => s + Number(r.requestCount || 0), 0);
  const usageTokens = usageRows.reduce((s, r) => s + Number(r.totalTokens || 0), 0);
  const usageCost = usageRows.reduce((s, r) => s + Number(r.costUsd || 0), 0);

  const sortMap = (m: Map<string, number>, top = 10) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);

  const dailyMode = String(policy.candidateDecisionCooldownMode || "interval_120m");
  const disableReeval = policy.disableReevaluationForBoughtToday === true;

  console.log("=== DAILY DRYRUN REPORT ===");
  console.log(`date(KST): ${date}`);
  console.log(`modelId: ${modelId}`);
  console.log(`modelName: ${m.modelName}`);
  console.log(`modelType: ${m.modelType}`);
  console.log(`windowUTC: ${start.toISOString()} ~ ${end.toISOString()}`);
  console.log(`cooldownMode: ${dailyMode}`);
  console.log(`disableReevaluationForBoughtToday: ${disableReeval}`);
  console.log("");

  console.log("[1] Candidate decisions");
  console.log(`- total: ${decisions.length}`);
  console.log(`- accepted: ${accepted}`);
  console.log(`- rejected: ${rejected}`);
  console.log(`- first(KST): ${fmtKst(decisions[decisions.length - 1]?.decidedAt)}`);
  console.log(`- last(KST): ${fmtKst(decisions[0]?.decidedAt)}`);
  console.log(`- unique stocks: ${new Set(decisions.map((d) => d.stockCode)).size}`);
  console.log("");
  console.log("- by decisionType");
  for (const [k, v] of sortMap(byDecisionType, 20)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("");
  console.log("- by rejectReason");
  for (const [k, v] of sortMap(byRejectReason, 20)) {
    console.log(`  ${k}: ${v}`);
  }
  if (exceptionErrors.size > 0) {
    console.log("");
    console.log("- evaluation_exception detail");
    for (const [k, v] of sortMap(exceptionErrors, 10)) {
      console.log(`  ${v} | ${k}`);
    }
  }
  console.log("");
  console.log("- top stocks");
  for (const [k, v] of sortMap(byStock, 10)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("");

  console.log("[2] Cooldown integrity");
  console.log(`- duplicate same stock+cooldownKey groups (>1): ${cooldownViolationCount}`);
  console.log(`- distinct cooldownKey count: ${byCooldownKey.size}`);
  console.log(`- rows missing cooldownKey: ${missingCooldownKeyCount}`);
  console.log(`- candidate rows currently marked decision_cooldown_active in window: ${cooldownBlockedCurrentState}`);
  const topStockCode = sortMap(byStock, 1)[0]?.[0]?.split(":")[0];
  if (topStockCode && stockCooldownMap.has(topStockCode)) {
    const topStockCooldowns = [...stockCooldownMap.get(topStockCode)!.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    console.log(`- sample top stock(${topStockCode}) cooldown keys:`);
    for (const [k, v] of topStockCooldowns) {
      console.log(`  ${k}: ${v}`);
    }
  }
  console.log("");

  const buyOrders = orders.filter((o) => o.orderType === "buy");
  const sellOrders = orders.filter((o) => o.orderType === "sell");
  console.log("[3] Auto orders");
  console.log(`- total: ${orders.length}`);
  console.log(`- buy: ${buyOrders.length}`);
  console.log(`- sell: ${sellOrders.length}`);
  console.log(`- first(KST): ${fmtKst(orders[orders.length - 1]?.createdAt)}`);
  console.log(`- last(KST): ${fmtKst(orders[0]?.createdAt)}`);
  console.log("");

  console.log("[4] AI usage daily");
  console.log(`- rows: ${usageRows.length}`);
  console.log(`- requestCount: ${usageReq}`);
  console.log(`- totalTokens: ${usageTokens}`);
  console.log(`- costUsd: ${usageCost.toFixed(8)}`);
  for (const r of usageRows) {
    console.log(
      `  ${r.scopeType}:${r.scopeKey} req=${r.requestCount} tok=${r.totalTokens} cost=$${Number(r.costUsd || 0).toFixed(8)}`,
    );
  }

  const decisionGap = decisions.length === 0 ? null : (end.getTime() - decisions[0].decidedAt.getTime()) / (60 * 1000);
  if (decisionGap !== null && decisionGap > 120) {
    console.log("");
    console.log("[5] Note");
    console.log(`- 마지막 결정 이후 ${Math.round(decisionGap)}분 경과. (후보 고갈/장종료/상위 조건 미충족 가능성)`);
  }

  const guardRows = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(schema.candidateDecisionLogs)
    .where(and(eq(schema.candidateDecisionLogs.modelId, modelId), gte(schema.candidateDecisionLogs.decidedAt, start), lt(schema.candidateDecisionLogs.decidedAt, end)));

  if (Number(guardRows[0]?.count || 0) !== decisions.length) {
    console.log("");
    console.log("WARN: decision count mismatch detected.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("report-daily-dryrun failed:", err);
    process.exit(1);
  });
