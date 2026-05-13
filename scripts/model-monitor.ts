import { db } from '../server/db';
import { storage } from '../server/storage';
import { getUserKiwoomService } from '../server/services/user-kiwoom.service';
import * as schema from '../shared/schema';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';

const LOG_PATH = path.resolve(process.cwd(), '.tmp-model-monitor.log');
const INTERVAL_MS = Number(process.env.MONITOR_INTERVAL_MS || 60000);
const svc = getUserKiwoomService();

function nowKst() {
  const d = new Date();
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

function log(msg: string, obj?: any) {
  const line = `[${nowKst()}] ${msg}${obj ? ' ' + JSON.stringify(obj) : ''}`;
  console.log(line);
  fs.appendFileSync(LOG_PATH, line + '\n', 'utf8');
}

async function getTargetModel() {
  const activeModels = await storage.getActiveAiModels();
  if (activeModels.length === 0) return null;
  // Prefer exact test model if present, else first active model.
  return activeModels.find((m) => m.modelName === '모의투자 - Test 모델') || activeModels[0];
}

async function recoverCandidates(modelId: number, userId: string, sequences: Array<{ conditionId?: string; name?: string }>) {
  let recovered = 0;
  await storage.clearCandidateStocks(userId, modelId);
  for (const seq of sequences) {
    const condId = String(seq?.conditionId || '').trim();
    if (!condId) continue;
    const rows = await svc.runCondition(userId, condId);
    for (const raw of rows || []) {
      const s = svc.normalizeConditionResult(raw);
      if (!s.stockCode) continue;
      await storage.upsertCandidateStock({
        userId,
        modelId,
        stockCode: s.stockCode,
        stockName: s.stockName || s.stockCode,
        source: seq?.name || condId,
      });
      recovered++;
    }
  }
  return recovered;
}

async function tick() {
  const model = await getTargetModel();
  if (!model) {
    log('WARN no_active_model');
    return;
  }

  const userId = model.userId;
  const modelConfig: any = model.config || {};
  const accountId = Number(modelConfig.accountId || 0);
  const settings = await storage.getAutoTradingSettings(model.id);
  const userSettings = await storage.getUserSettings(userId);

  const account = accountId ? await storage.getKiwoomAccount(accountId) : undefined;
  if (!account) {
    log('ERROR missing_account', { modelId: model.id, accountId });
    return;
  }

  // Hard guard: monitor only runs on mock mode/account
  if (account.accountType !== 'mock' || (userSettings?.tradingMode ?? 'mock') !== 'mock') {
    log('CRIT mock_guard_blocked', {
      modelId: model.id,
      accountType: account.accountType,
      tradingMode: userSettings?.tradingMode ?? 'mock',
    });
    return;
  }

  let candidates = await storage.getCandidateStocks(userId, model.id);
  if (candidates.length === 0) {
    const seqs = ((settings?.conditionSearchSequences as any) ?? []) as Array<{ conditionId?: string; name?: string }>;
    if (seqs.length > 0) {
      try {
        const recovered = await recoverCandidates(model.id, userId, seqs);
        candidates = await storage.getCandidateStocks(userId, model.id);
        log('INFO candidates_recovered', { modelId: model.id, recovered, current: candidates.length });
      } catch (e: any) {
        log('ERROR candidate_recover_failed', { modelId: model.id, error: e?.message || String(e) });
      }
    } else {
      log('WARN no_condition_sequences', { modelId: model.id });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const autoOrdersToday = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.orders)
    .where(and(eq(schema.orders.accountId, account.id), eq(schema.orders.isAutoTrading, true), gte(schema.orders.createdAt, today)));

  const decisionLogs = await db
    .select({ id: schema.candidateDecisionLogs.id, accepted: schema.candidateDecisionLogs.accepted, decidedAt: schema.candidateDecisionLogs.decidedAt })
    .from(schema.candidateDecisionLogs)
    .where(eq(schema.candidateDecisionLogs.modelId, model.id))
    .orderBy(desc(schema.candidateDecisionLogs.decidedAt))
    .limit(5);

  const run = await storage.getAutoTradingRun(userId);

  log('HEALTH', {
    modelId: model.id,
    accountId: account.id,
    accountType: account.accountType,
    tradingMode: userSettings?.tradingMode ?? 'mock',
    autoTradingEnabled: userSettings?.autoTradingEnabled ?? false,
    runState: run?.state ?? null,
    runReason: run?.reason ?? null,
    candidates: candidates.length,
    autoOrdersToday: Number((autoOrdersToday[0] as any)?.c ?? 0),
    recentDecisions: decisionLogs.length,
  });
}

async function main() {
  log('START model_monitor', { intervalMs: INTERVAL_MS, logPath: LOG_PATH });
  while (true) {
    try {
      await tick();
    } catch (e: any) {
      log('ERROR tick_failed', { error: e?.message || String(e) });
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main().catch((e) => {
  log('FATAL monitor_crashed', { error: e?.message || String(e) });
  process.exit(1);
});
