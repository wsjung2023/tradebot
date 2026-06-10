// auto-trading-worker.ts — 자동매매 cron 스케줄러. 매 1분마다 AI 모델 순회 및 조건 검색 실행
import * as cron from 'node-cron';
import { createHash } from 'crypto';
import { storage } from './storage';
import { KiwoomService } from './services/kiwoom';
import { getUserKiwoomService } from './services/user-kiwoom.service';
import { LearningService } from './services/learning.service';
import { TradeExecutorService } from './services/trade-executor.service';
import { getAIService } from './services/ai.service';
import { getOrderSyncService } from './services/order-sync.service';
import { AgentTimeoutError } from './services/agent-proxy.service';
import { getDartService } from './services/dart.service';
import { AiModel, AutoTradingSettings } from '@shared/schema';
import { getFeatureFlags } from './config/feature-flags';
import { isKoreanMarketOpen } from './utils/market-hours';
import { decrypt, isEncrypted } from './utils/crypto';

const DART_DANGER_KEYWORDS = [
  '유상증자', '전환사채', '신주인수권부사채', '횡령', '배임', '관리종목', '상장폐지',
  '영업정지', '파산', '회생절차', '불성실공시', '투자경고', '투자위험',
];

type LearningCycleOutcome = 'executed' | 'skipped' | 'error' | null;

export interface LearningRuntimeStatus {
  featureEnabled: boolean;
  lastTriggeredAt: Date | null;
  lastCompletedAt: Date | null;
  lastOutcome: LearningCycleOutcome;
  lastReason: string | null;
  lastError: string | null;
  lastActiveModelCount: number | null;
  lastOptimizedModelCount: number | null;
}

class AutoTradingWorker {
  private isRunning = false;
  private readonly featureFlags = getFeatureFlags();
  private isLearningRunning = false;
  private isExitPlanBatchRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private scanJob: cron.ScheduledTask | null = null;
  private learningJob: cron.ScheduledTask | null = null;
  private exitPlanJob: cron.ScheduledTask | null = null;
  private isScanRunning = false;
  private tradingErrorCount = 0;
  private lastTradingError: string | null = null;
  private scanErrorCount = 0;
  private lastScanError: string | null = null;
  private learningErrorCount = 0;
  private lastLearningError: string | null = null;
  private learningService = new LearningService();
  private executor = new TradeExecutorService();
  private aiService = getAIService();
  private userKiwoomService = getUserKiwoomService();
  private readonly agentTimeoutWindowMs = 10 * 60 * 1000;
  private readonly agentTimeoutThreshold = 3;
  private readonly agentTimeoutCooldownMs = 5 * 60 * 1000;
  private agentTimeoutCounters = new Map<string, { count: number; firstAt: number }>();
  private learningRuntime: LearningRuntimeStatus = {
    featureEnabled: this.featureFlags.enableAdvancedLearning,
    lastTriggeredAt: null,
    lastCompletedAt: null,
    lastOutcome: null,
    lastReason: null,
    lastError: null,
    lastActiveModelCount: null,
    lastOptimizedModelCount: null,
  };

  private clearAgentTimeoutCounter(userId: string) {
    this.agentTimeoutCounters.delete(userId);
  }

  private recordAgentTimeout(userId: string) {
    const now = Date.now();
    const prev = this.agentTimeoutCounters.get(userId);
    if (!prev || now - prev.firstAt > this.agentTimeoutWindowMs) {
      const next = { count: 1, firstAt: now };
      this.agentTimeoutCounters.set(userId, next);
      return next;
    }
    const next = { count: prev.count + 1, firstAt: prev.firstAt };
    this.agentTimeoutCounters.set(userId, next);
    return next;
  }

  async start() {
    this.startScanJob('*/30 * * * *');
    this.startTradingJob('* * * * *');
    this.startLearningJob('0 16 * * *');
    this.startExitPlanBatchJob('50 23 * * *'); // 08:50 KST
  }

  stop() {
    this.stopScanJob();
    this.stopTradingJob();
    this.stopLearningJob();
    this.stopExitPlanBatchJob();
  }

  private onJobRun?: (jobId: string) => void;
  private onJobError?: (jobId: string, message: string) => void;

  setJobCallbacks(onRun: (jobId: string) => void, onError: (jobId: string, message: string) => void) {
    this.onJobRun = onRun;
    this.onJobError = onError;
  }

  startTradingJob(schedule: string) {
    if (this.cronJob) this.cronJob.stop();
    this.cronJob = cron.schedule(schedule, async () => {
      const errorsBefore = this.tradingErrorCount;
      await this.executeTradingCycle();
      if (this.tradingErrorCount > errorsBefore) {
        this.onJobError?.('auto-trading', this.lastTradingError || 'cycle error');
      } else {
        this.onJobRun?.('auto-trading');
      }
    });
    console.log(`✅ Auto Trading Worker started (schedule: ${schedule})`);
  }

  stopTradingJob() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('⏹️  Auto Trading Worker stopped');
    }
  }

  startScanJob(schedule: string) {
    if (this.scanJob) this.scanJob.stop();
    this.scanJob = cron.schedule(schedule, async () => {
      const errorsBefore = this.scanErrorCount;
      await this.runScanCycle();
      if (this.scanErrorCount > errorsBefore) {
        this.onJobError?.('scan', this.lastScanError || 'scan error');
      } else {
        this.onJobRun?.('scan');
      }
    });
    console.log(`✅ Scan Job started (schedule: ${schedule})`);
  }

  stopScanJob() {
    if (this.scanJob) {
      this.scanJob.stop();
      this.scanJob = null;
      console.log('⏹️  Scan Job stopped');
    }
  }

  isScanJobRunning(): boolean { return this.scanJob !== null; }

  async runScanNow() {
    await this.runScanCycle();
  }

  private async runScanCycle() {
    if (!isKoreanMarketOpen()) return;
    if (this.isScanRunning) {
      console.log('[ScanJob] ⏭️  이전 스캔 사이클 실행 중 — 건너뜀');
      return;
    }
    this.isScanRunning = true;
    try {
      console.log('[ScanJob] 🔍 30분 스캔 시작...');
      const models = await storage.getActiveAiModels();
      for (const model of models) {
        const config = (model.config as any) || {};
        if (!config.accountId) {
          console.log(`[ScanJob] ⛔ 모델 ${model.id} 계좌 미설정 — 스킵`);
          continue;
        }
        try {
          const settings = await storage.getAutoTradingSettings(model.id);
          const conditionSequences: { conditionId: string; name?: string }[] =
            (settings?.conditionSearchSequences as any) ?? [];
          if (conditionSequences.length === 0) {
            console.log(`[ScanJob] ⛔ 모델 ${model.id} 조건검색식 미설정 — 스킵 (설정 탭에서 conditionSearchSequences 구성 필요)`);
            continue;
          }

          await storage.clearCandidateStocks(model.userId, model.id);
          let totalSaved = 0;
          for (const seq of conditionSequences) {
            const results = await this.userKiwoomService.runCondition(model.userId, seq.conditionId);
            if (!results?.length) {
              console.log(`[ScanJob] 모델 ${model.id} 조건[${seq.conditionId}] 결과 0건`);
              continue;
            }
            for (const raw of results) {
              const stock = this.userKiwoomService.normalizeConditionResult(raw);
              const isDangerous = await this.checkDartDanger(stock.stockCode);
              // 히스토리 로그 기록 (DART 차단 여부 포함)
              storage.createConditionScanLog({
                modelId: model.id,
                userId: model.userId,
                conditionSeq: seq.conditionId,
                conditionName: seq.name ?? seq.conditionId,
                stockCode: stock.stockCode,
                stockName: stock.stockName,
                dartBlocked: isDangerous,
              }).catch(e => console.error('[ScanJob] 히스토리 로그 실패:', e));
              if (isDangerous) {
                console.log(`[ScanJob] 🚫 DART 위험공시: ${stock.stockCode} — 제외`);
                continue;
              }
              await storage.upsertCandidateStock({
                userId: model.userId,
                modelId: model.id,
                stockCode: stock.stockCode,
                stockName: stock.stockName,
                source: seq.name ?? seq.conditionId,
              });
              totalSaved++;
            }
          }
          console.log(`[ScanJob] ✅ 모델 ${model.id}: ${totalSaved}종목 저장 (${conditionSequences.length}개 조건검색)`);
        } catch (err) {
          console.error(`[ScanJob] ❌ 모델 ${model.id} 스캔 오류:`, err);
        }
      }
      console.log('[ScanJob] ✅ 30분 스캔 완료');
    } catch (err: any) {
      this.scanErrorCount++;
      this.lastScanError = err?.message || 'unknown scan error';
      console.error('[ScanJob] ❌ 스캔 사이클 오류:', err);
    } finally {
      this.isScanRunning = false;
    }
  }

  private async checkDartDanger(stockCode: string): Promise<boolean> {
    try {
      const dartService = getDartService();
      const filings = await dartService.getFilingsByStockCode(stockCode, 30);
      return filings.some(f =>
        DART_DANGER_KEYWORDS.some(kw => f.reportNm.includes(kw))
      );
    } catch {
      return false;
    }
  }

  startLearningJob(schedule: string) {
    if (this.learningJob) this.learningJob.stop();
    this.learningJob = cron.schedule(schedule, async () => {
      const errorsBefore = this.learningErrorCount;
      await this.executeLearningCycleWrapper();
      if (this.learningErrorCount > errorsBefore) {
        this.onJobError?.('learning', this.lastLearningError || 'learning error');
      } else {
        this.onJobRun?.('learning');
      }
    });
    console.log(`✅ Learning System started (schedule: ${schedule})`);
  }

  stopLearningJob() {
    if (this.learningJob) {
      this.learningJob.stop();
      this.learningJob = null;
      console.log('⏹️  Learning System stopped');
    }
  }

  startExitPlanBatchJob(schedule: string) {
    if (this.exitPlanJob) this.exitPlanJob.stop();
    this.exitPlanJob = cron.schedule(schedule, async () => {
      await this.runExitPlanBatch();
    });
    console.log(`✅ ExitPlan Batch started (schedule: ${schedule})`);
  }

  stopExitPlanBatchJob() {
    if (this.exitPlanJob) {
      this.exitPlanJob.stop();
      this.exitPlanJob = null;
      console.log('⏹️  ExitPlan Batch stopped');
    }
  }

  async runExitPlanBatch(): Promise<void> {
    if (this.isExitPlanBatchRunning) {
      console.log('⏭️  Skipping exit plan batch — previous still running');
      return;
    }
    this.isExitPlanBatchRunning = true;
    console.log('[ExitPlanBatch] 08:50 KST 종목별 매도 계획 생성 시작');
    try {
      const models = await storage.getActiveAiModels();
      for (const model of models) {
        const config = (model.config as any) || {};
        const accountId = config.accountId;
        if (!accountId) continue;
        const accounts = await storage.getKiwoomAccounts(model.userId);
        const account = accounts.find((a: any) => a.id === accountId);
        if (!account) continue;

        const holdings = await storage.getHoldings(accountId);
        if (!holdings.length) continue;

        const userSettings = await storage.getUserSettings(model.userId);
        const selectedAiModel = userSettings?.aiModel || 'gpt-5-mini';

        for (const holding of holdings) {
          try {
            const stockCode = holding.stockCode.replace(/^A/, '');
            const avgPrice = parseFloat(holding.averagePrice?.toString() || '0');
            if (!avgPrice) continue;

            const currentPrice = parseFloat(holding.currentPrice?.toString() || '0') || avgPrice;
            const profitRatePct = ((currentPrice - avgPrice) / avgPrice) * 100;

            // rainbow line: getPrice 사용해 현재가 기반 CL 추정 (chart 계산 생략)
            let currentRainbowLine = 50;

            const perf = await storage.getTradingPerformanceByStock(model.id, stockCode);
            const filledEntrySteps = Array.isArray(perf?.filledEntrySteps)
              ? (perf!.filledEntrySteps as number[]).filter((n: number) => Number.isFinite(n))
              : [];
            const holdingDays = perf?.createdAt
              ? Math.floor((Date.now() - new Date(perf.createdAt).getTime()) / 86400000)
              : 0;

            const result = await this.aiService.generateHoldingExitPlan({
              stockCode,
              stockName: holding.stockName || stockCode,
              averagePrice: avgPrice,
              currentPrice,
              profitRatePct,
              currentRainbowLine,
              quantity: holding.quantity,
              filledEntrySteps,
              holdingDays,
            }, selectedAiModel, { userId: model.userId, accountId, source: 'exit-plan-batch' });

            await storage.upsertHoldingExitPlan({
              modelId: model.id,
              stockCode,
              exitStages: result.exitStages,
              aiReasoning: result.reasoning,
              source: 'ai_batch',
              generatedAt: new Date(),
            });
            console.log(`[ExitPlanBatch] ${stockCode} (${holding.stockName}) — ${result.exitStages.length}단계 계획 생성`);

            await new Promise(r => setTimeout(r, 2000));
          } catch (e: any) {
            console.error(`[ExitPlanBatch] ${holding.stockCode} 실패:`, e?.message || e);
          }
        }
      }
    } catch (e: any) {
      console.error('[ExitPlanBatch] 배치 실패:', e?.message || e);
    } finally {
      this.isExitPlanBatchRunning = false;
      console.log('[ExitPlanBatch] 완료');
    }
  }

  isTradingJobRunning(): boolean { return this.cronJob !== null; }
  isLearningJobRunning(): boolean { return this.learningJob !== null; }
  isExitPlanJobRunning(): boolean { return this.exitPlanJob !== null; }
  async runTradingNow(): Promise<void> { await this.executeTradingCycle(); }
  async runLearningNow(): Promise<void> { await this.executeLearningCycleWrapper(); }
  async runExitPlanBatchNow(): Promise<void> { await this.runExitPlanBatch(); }
  getLearningRuntimeStatus(): LearningRuntimeStatus {
    return { ...this.learningRuntime };
  }

  async createDefaultSettingsForModel(modelId: number): Promise<void> {
    await this.executor.createDefaultSettings(modelId);
  }

  private async setRunState(
    userId: string,
    state: 'stopped' | 'running' | 'paused' | 'error',
    modelId?: number,
    reason?: string,
    lastError?: string,
    metadata?: Record<string, unknown>,
  ) {
    try {
      const current = await storage.getAutoTradingRun(userId);
      const existingMeta = (current?.metadata as Record<string, any> | null) ?? {};
      const modelStates = { ...(existingMeta.modelStates || {}) };
      if (modelId !== undefined) {
        modelStates[String(modelId)] = {
          state,
          reason: reason ?? null,
          lastError: lastError ?? null,
          updatedAt: new Date().toISOString(),
          ...(metadata || {}),
        };
      }
      await storage.upsertAutoTradingRun(userId, {
        state,
        reason,
        lastError,
        lastCycleAt: new Date(),
        metadata: {
          ...existingMeta,
          ...metadata,
          modelStates,
        },
      });
    } catch (e) {
      console.warn(`[AutoTrading] run state update failed user=${userId}:`, e);
    }
  }

  private async notifyEngineEvent(
    userId: string,
    severity: 'info' | 'warn' | 'crit',
    type: string,
    message: string,
    payload?: Record<string, unknown>
  ) {
    try {
      await storage.createEngineNotification({ userId, severity, type, message, payload: payload ?? {} });
    } catch (e) {
      console.warn(`[AutoTrading] notification write failed user=${userId}:`, e);
    }
  }

  private async executeTradingCycle() {
    const cycleId = `trading-${Date.now()}`;

    if (this.isRunning) {
      console.log(`[AutoTrading][${cycleId}] ⏭️  Skipping cycle - previous cycle still running`);
      return;
    }

    this.isRunning = true;
    try {
      if (!this.isMarketHours()) {
        console.log(`[AutoTrading][${cycleId}] 🕒 Outside market hours - skipping`);
        return;
      }
      console.log(`[AutoTrading][${cycleId}] 🔄 Starting auto trading cycle...`);
      const activeModels = await storage.getActiveAiModels();
      if (activeModels.length === 0) {
        console.log(`[AutoTrading][${cycleId}] 📭 No active AI models found`);
        return;
      }
      console.log(`[AutoTrading][${cycleId}] 📊 Found ${activeModels.length} active AI model(s)`);
      for (const model of activeModels) await this.processModel(model);

      if (this.featureFlags.enablePriceAlertsInTradingCycle) {
        try {
          await this.checkPriceAlerts();
        } catch (alertError) {
          console.error(`[AutoTrading][${cycleId}] 가격 알림 체크 오류:`, alertError);
        }
      } else {
        console.log(`[AutoTrading][${cycleId}] ℹ️ Price alert checks disabled by feature flag`);
      }

      console.log(`[AutoTrading][${cycleId}] ✅ Trading cycle completed`);
    } catch (error: any) {
      this.tradingErrorCount++;
      this.lastTradingError = error?.message || 'unknown trading error';
      console.error(`[AutoTrading][${cycleId}] ❌ Error in trading cycle:`, error);
    } finally {
      this.isRunning = false;
    }
  }

  private isMarketHours(): boolean {
    return isKoreanMarketOpen();
  }

  private async processModel(model: AiModel) {
    console.log(`\n🎯 Processing model: ${model.modelName} (ID: ${model.id})`);
    const startedAt = Date.now();
    const cycleId = `model-${model.id}-${startedAt}`;
    try {
      const userSettings = await storage.getUserSettings(model.userId);
      if (!userSettings?.autoTradingEnabled) {
        await this.setRunState(model.userId, 'stopped', model.id, 'auto_trading_disabled', undefined, {
          cycleId,
          durationMs: Date.now() - startedAt,
        });
        console.log(`ℹ️  Auto trading disabled for user ${model.userId} - skipping`);
        return;
      }
      const existingRun = await storage.getAutoTradingRun(model.userId);
      const cooldownUntil = (existingRun?.metadata as any)?.agentCooldownUntil
        ? new Date((existingRun?.metadata as any).agentCooldownUntil as string).getTime()
        : null;
      if (cooldownUntil && Number.isFinite(cooldownUntil) && cooldownUntil > Date.now()) {
        const cooldownRemainingSec = Math.max(0, Math.round((cooldownUntil - Date.now()) / 1000));
        await this.setRunState(model.userId, 'paused', model.id, 'agent_timeout_cooldown', existingRun?.lastError ?? undefined, {
          cycleId,
          durationMs: Date.now() - startedAt,
          agentCooldownUntil: new Date(cooldownUntil).toISOString(),
          cooldownRemainingSec,
        });
        console.log(`⏸️  Agent timeout cooldown active for user ${model.userId} (${cooldownRemainingSec}s remaining)`);
        return;
      }

      await this.setRunState(model.userId, 'running', model.id, 'cycle_started', undefined, {
        cycleId,
        agentCooldownUntil: null,
      });

      const accounts = await storage.getKiwoomAccounts(model.userId);
      const targetAccountId = (model.config as any)?.accountId;
      if (!targetAccountId) {
        await this.setRunState(model.userId, 'paused', model.id, 'no_account_configured', undefined, {
          cycleId, durationMs: Date.now() - startedAt,
        });
        console.log(`⛔ AI 모델 ${model.id}(${model.modelName})에 계좌 미설정 — 중단`);
        return;
      }
      const targetAccount = accounts.find((a: any) => a.id === targetAccountId);

      if (!targetAccount) {
        await this.setRunState(model.userId, 'paused', model.id, 'no_target_account', undefined, {
          cycleId,
          durationMs: Date.now() - startedAt,
        });
        console.log(`⚠️  No target account for user ${model.userId} - skipping`);
        return;
      }

      // ── 거래 모드 안전장치: trading_mode='mock'이면 실계좌 거래 차단 ──
      const tradingMode = userSettings?.tradingMode ?? 'mock';
      if (tradingMode === 'mock' && targetAccount.accountType === 'real') {
        await this.setRunState(model.userId, 'paused', model.id, 'trading_mode_mismatch', undefined, {
          cycleId,
          durationMs: Date.now() - startedAt,
          tradingMode,
          accountType: targetAccount.accountType,
        });
        console.log(`🛡️  거래 모드 불일치 — 설정: 모의투자, 계좌: 실계좌 → 실계좌 거래 차단`);
        await this.notifyEngineEvent(
          model.userId,
          'warn',
          'trading_mode_blocked',
          `[안전장치] 거래 모드가 "모의투자"로 설정되어 실계좌(${targetAccount.accountNumber}) 자동매매가 차단되었습니다. 실전투자로 전환 후 이용하세요.`,
          { modelId: model.id, accountId: targetAccount.id, accountNumber: targetAccount.accountNumber },
        );
        return;
      }

      const safeDecrypt = (val: string | null | undefined) =>
        val ? (isEncrypted(val) ? decrypt(val) : val) : null;
      const appKey = safeDecrypt(targetAccount.kiwoomAppKey);
      const appSecret = safeDecrypt(targetAccount.kiwoomAppSecret);

      if (!appKey || !appSecret) {
        await this.setRunState(model.userId, 'paused', model.id, 'missing_kiwoom_credentials', undefined, {
          cycleId,
          durationMs: Date.now() - startedAt,
        });
        console.log(`⚠️  계좌 ${targetAccount.accountNumber} API 키 미등록 — 계좌 설정에서 API 키를 등록하세요`);
        return;
      }

      const kiwoomService = new KiwoomService({
        appKey,
        appSecret,
        accountType: targetAccount.accountType === 'real' ? 'real' : 'mock',
      });

      const settings = await storage.getAutoTradingSettings(model.id);
      if (!settings) {
        console.log(`⚠️  No trading settings for model ${model.id} - creating defaults`);
        await this.executor.createDefaultSettings(model.id, (model.config as any)?.modelType);
        return;
      }
      const selectedAiModel = userSettings?.aiModel || 'gpt-5-mini';

      // ── 주문 상태 동기화: 오래된 pending 만료 + 오늘 체결 상태 업데이트 ──
      try {
        const orderSync = getOrderSyncService();
        await orderSync.expireOldPendingOrders(targetAccount.id);
        await orderSync.syncTodayOrders(
          targetAccount.id,
          targetAccount.accountNumber,
          kiwoomService
        );
      } catch (syncErr) {
        console.warn(`⚠️  주문 동기화 오류 (무시):`, syncErr);
      }

      const modelConfig = (model.config as any) || {};
      const buyPaused = modelConfig.buyPaused === true;

      // ── 0. 보유 종목 독립 추가매수 사이클 (스캔 독립 — 뒷차기 핵심 로직) ──
      // 보유 종목이 조건검색에서 탈락해도 레인보우 라인 하락 시 추가매수를 판단한다.
      // 중복매수 방지: filledEntrySteps 영구추적 + 새 하단 라인 판별 + 24h 쿨다운
      if (buyPaused) {
        console.log(`  ⏸ 매수 일시정지 ON — 추가매수 사이클 건너뜀 (model ${model.id})`);
      } else {
        try {
          await this.executor.checkHoldingsForScaleIn(model, settings, kiwoomService, this.aiService, selectedAiModel);
        } catch (scaleInErr) {
          console.error(`⚠️  checkHoldingsForScaleIn 오류 (무시):`, scaleInErr);
        }
      }

      // ── 1. 포지션 청산 관리: 기존 경로 유지 ──
      try {
        await this.executor.checkPositionsForExits(model, settings, kiwoomService, this.aiService, selectedAiModel);
      } catch (posErr) {
        console.error(`⚠️  checkPositionsForExits 오류 (무시):`, posErr);
      }

      // ── 2. 신규 진입 후보 평가 ──
      const rawCandidates = buyPaused ? [] : await storage.getCandidateStocks(model.userId, model.id);
      const candidateFreshnessMs = 60 * 60 * 1000;
      const nowMs = Date.now();
      const candidates = rawCandidates.filter((candidate: any) => {
        const scannedAt = candidate.scannedAt ? new Date(candidate.scannedAt).getTime() : 0;
        return Number.isFinite(scannedAt) && nowMs - scannedAt <= candidateFreshnessMs;
      });
      if (!buyPaused && rawCandidates.length !== candidates.length) {
        console.log(`  ⏱️ 오래된 후보 ${rawCandidates.length - candidates.length}건 스킵 — 1시간 이내 스캔 후보만 매수 평가`);
      }
      if (buyPaused) {
        console.log(`  ⏸ 매수 일시정지 ON — 후보 신규매수 평가 건너뜀 (model ${model.id})`);
      } else if (!candidates.length) {
        console.log(`  📭 후보 종목 없음 — 30분 스캔 대기 중`);
      } else {
        console.log(`  📊 후보 종목 ${candidates.length}개 진입 평가 시작`);
        for (let i = 0; i < candidates.length; i++) {
          if (i > 0) await new Promise(r => setTimeout(r, 3000));
          await this.executor.evaluateCandidateStock(model, settings, candidates[i], kiwoomService, this.aiService, selectedAiModel);
        }
      }

      this.clearAgentTimeoutCounter(model.userId);
      await this.setRunState(model.userId, 'running', model.id, 'cycle_completed', undefined, {
        cycleId,
        durationMs: Date.now() - startedAt,
        agentCooldownUntil: null,
        timeoutCountInWindow: 0,
      });
    } catch (error) {
      const errorMessage = (error as Error)?.message || String(error);
      const errorHash = createHash('sha1').update(errorMessage).digest('hex').slice(0, 12);
      if (error instanceof AgentTimeoutError) {
        const timeoutTracker = this.recordAgentTimeout(model.userId);
        const timeoutEscalated = timeoutTracker.count >= this.agentTimeoutThreshold;
        const agentCooldownUntil = timeoutEscalated
          ? new Date(Date.now() + this.agentTimeoutCooldownMs).toISOString()
          : null;
        await this.setRunState(model.userId, 'paused', model.id, 'agent_timeout', errorMessage, {
          cycleId,
          durationMs: Date.now() - startedAt,
          errorHash,
          timeoutCountInWindow: timeoutTracker.count,
          timeoutWindowSec: Math.round(this.agentTimeoutWindowMs / 1000),
          timeoutEscalated,
          agentCooldownUntil,
        });
        await this.notifyEngineEvent(
          model.userId,
          timeoutEscalated ? 'crit' : 'warn',
          timeoutEscalated ? 'agent_offline_repeated' : 'agent_offline',
          timeoutEscalated
            ? `에이전트 응답 지연이 ${timeoutTracker.count}회 누적되어 자동매매를 일시중지했습니다(쿨다운 ${Math.round(this.agentTimeoutCooldownMs / 1000)}초): ${error.message}`
            : `에이전트 응답 지연으로 자동매매를 일시중지했습니다: ${error.message}`,
          {
            modelId: model.id,
            timeoutCountInWindow: timeoutTracker.count,
            timeoutWindowSec: Math.round(this.agentTimeoutWindowMs / 1000),
            timeoutCooldownSec: timeoutEscalated ? Math.round(this.agentTimeoutCooldownMs / 1000) : 0,
          },
        );
      } else {
        this.clearAgentTimeoutCounter(model.userId);
        await this.setRunState(model.userId, 'error', model.id, 'cycle_error', errorMessage, {
          cycleId,
          durationMs: Date.now() - startedAt,
          errorHash,
          agentCooldownUntil: null,
        });
        await this.notifyEngineEvent(
          model.userId,
          'crit',
          'engine_error',
          `자동매매 사이클 오류: ${errorMessage}`,
          { modelId: model.id },
        );
      }
      console.error(`❌ Error processing model ${model.id}:`, error);
    }
  }

  private async checkPriceAlerts(): Promise<void> {
    const alerts = await storage.getAllActiveAlerts();
    if (alerts.length === 0) return;

    const alertsByUser = new Map<string, typeof alerts>();
    for (const alert of alerts) {
      const bucket = alertsByUser.get(alert.userId) || [];
      bucket.push(alert);
      alertsByUser.set(alert.userId, bucket);
    }

    for (const [userId, userAlerts] of Array.from(alertsByUser.entries())) {
      const codes: string[] = Array.from(new Set(userAlerts.map((alert: any) => String(alert.stockCode))));
      const priceMap: Record<string, number> = {};

      try {
        const prices = await this.userKiwoomService.getWatchlist(userId, codes);
        for (const price of prices) {
          const current = parseFloat(String((price as any).currentPrice ?? (price as any).price ?? 0).replace(/[^0-9.-]/g, ''));
          if (!Number.isNaN(current)) {
            priceMap[(price as any).stockCode] = current;
          }
        }
      } catch (error) {
        console.warn(`[AutoTrading] 사용자 ${userId} 시세 조회 실패로 알림 체크 스킵:`, error);
        continue;
      }

      for (const alert of userAlerts) {
        const currentPrice = priceMap[alert.stockCode];
        if (currentPrice === undefined) continue;

        const target = parseFloat(String(alert.targetValue ?? '0'));
        let triggered = false;

        if (alert.alertType === 'price_above' && currentPrice >= target) triggered = true;
        if (alert.alertType === 'price_below' && currentPrice <= target) triggered = true;

        if (triggered) {
          await storage.updateAlert(alert.id, { isTriggered: true, triggeredAt: new Date() });
          console.log(`[Alert] 🔔 발동! ${alert.stockCode} | 현재가: ${currentPrice} | 조건: ${alert.alertType} ${target} | 사용자: ${alert.userId}`);
        }
      }
    }
  }

  // ─── Learning Cycle (매일 장 마감 후 16:00 실행) ───────────────────────

  private async executeLearningCycleWrapper() {
    this.learningRuntime.lastTriggeredAt = new Date();
    this.learningRuntime.featureEnabled = this.featureFlags.enableAdvancedLearning;
    if (this.isLearningRunning) {
      console.log('⏭️  Skipping learning cycle - previous still running');
      this.learningRuntime.lastCompletedAt = new Date();
      this.learningRuntime.lastOutcome = 'skipped';
      this.learningRuntime.lastReason = 'previous_cycle_still_running';
      this.learningRuntime.lastError = null;
      this.learningRuntime.lastActiveModelCount = null;
      this.learningRuntime.lastOptimizedModelCount = null;
      return;
    }
    this.isLearningRunning = true;
    try {
      const result = await this.executeLearningCycle();
      this.learningRuntime.lastCompletedAt = new Date();
      this.learningRuntime.lastOutcome = result.outcome;
      this.learningRuntime.lastReason = result.reason ?? null;
      this.learningRuntime.lastError = result.errorMessage ?? null;
      this.learningRuntime.lastActiveModelCount = result.activeModelCount;
      this.learningRuntime.lastOptimizedModelCount = result.optimizedModelCount;
    } finally {
      this.isLearningRunning = false;
    }
  }

  private async executeLearningCycle() {
    if (!this.featureFlags.enableAdvancedLearning) {
      console.log('\n🎓 Advanced learning disabled by feature flag (ENABLE_ADVANCED_LEARNING)');
      return {
        outcome: 'skipped' as const,
        reason: 'feature_flag_disabled',
        activeModelCount: 0,
        optimizedModelCount: 0,
      };
    }

    console.log('\n🎓 Starting learning optimization cycle...');
    try {
      const activeModels = await storage.getActiveAiModels();
      if (activeModels.length === 0) {
        console.log('📭 No active AI models found');
        return {
          outcome: 'skipped' as const,
          reason: 'no_active_models',
          activeModelCount: 0,
          optimizedModelCount: 0,
        };
      }
      console.log(`📊 Analyzing ${activeModels.length} active model(s)...`);
      let optimizedModelCount = 0;
      for (const model of activeModels) {
        const ok = await this.optimizeModel(model);
        if (ok) optimizedModelCount += 1;
      }
      console.log('✅ Learning optimization cycle completed\n');
      return {
        outcome: 'executed' as const,
        reason: null,
        activeModelCount: activeModels.length,
        optimizedModelCount,
      };
    } catch (error: any) {
      this.learningErrorCount++;
      this.lastLearningError = error?.message || 'unknown learning error';
      console.error('❌ Error in learning cycle:', error);
      return {
        outcome: 'error' as const,
        reason: 'learning_cycle_exception',
        errorMessage: this.lastLearningError,
        activeModelCount: 0,
        optimizedModelCount: 0,
      };
    }
  }

  private async optimizeModel(model: AiModel): Promise<boolean> {
    console.log(`\n🧠 Learning from model: ${model.modelName} (ID: ${model.id})`);
    try {
      const settings = await storage.getAutoTradingSettings(model.id);
      const learningPolicy = (settings?.learningPolicy as Record<string, any> | null) ?? undefined;
      // autoApply: learningPolicy.autoApply가 true일 때만 자동 적용, 기본은 pending 제안 저장
      const autoApply = learningPolicy?.autoApply === true;
      const result = await this.learningService.optimizeModel(model.id, autoApply, model.userId, learningPolicy);
      const s = result.stats;
      console.log(`  📈 Stats: ${s.totalTrades} trades | winRate ${s.winRate.toFixed(1)}% | return ${s.totalReturn.toFixed(2)}%`);
      if (result.appliedChanges) console.log(`  ✅ Optimized parameters applied automatically`);
      result.recommendations.forEach((rec: string) => console.log(`  💡 ${rec}`));
      return true;
    } catch (error) {
      console.error(`  ❌ Error optimizing model ${model.id}:`, error);
      return false;
    }
  }
}

export const autoTradingWorker = new AutoTradingWorker();
