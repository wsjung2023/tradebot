// auto-trading-worker.ts — 자동매매 cron 스케줄러. 매 1분마다 AI 모델 순회 및 조건 검색 실행
import * as cron from 'node-cron';
import { createHash } from 'crypto';
import { storage } from './storage';
import { KiwoomService } from './services/kiwoom';
import { getUserKiwoomService } from './services/user-kiwoom.service';
import { AIService } from './services/ai.service';
import { LearningService } from './services/learning.service';
import { TradeExecutorService } from './services/trade-executor.service';
import { AgentTimeoutError } from './services/agent-proxy.service';
import { AiModel, AutoTradingSettings, ConditionFormula } from '@shared/schema';
import { decrypt } from './utils/crypto';
import { getFeatureFlags } from './config/feature-flags';
import { isKoreanMarketOpen } from './utils/market-hours';

class AutoTradingWorker {
  private isRunning = false;
  private readonly featureFlags = getFeatureFlags();
  private isLearningRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private learningJob: cron.ScheduledTask | null = null;
  private learningService = new LearningService();
  private executor = new TradeExecutorService();
  private userKiwoomService = getUserKiwoomService();
  private readonly agentTimeoutWindowMs = 10 * 60 * 1000;
  private readonly agentTimeoutThreshold = 3;
  private readonly agentTimeoutCooldownMs = 5 * 60 * 1000;
  private agentTimeoutCounters = new Map<string, { count: number; firstAt: number }>();

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
    this.startTradingJob('* * * * *');
    this.startLearningJob('0 16 * * *');
  }

  stop() {
    this.stopTradingJob();
    this.stopLearningJob();
  }

  startTradingJob(schedule: string) {
    if (this.cronJob) this.cronJob.stop();
    this.cronJob = cron.schedule(schedule, async () => {
      await this.executeTradingCycle();
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

  startLearningJob(schedule: string) {
    if (this.learningJob) this.learningJob.stop();
    this.learningJob = cron.schedule(schedule, async () => {
      await this.executeLearningCycleWrapper();
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

  isTradingJobRunning(): boolean { return this.cronJob !== null; }
  isLearningJobRunning(): boolean { return this.learningJob !== null; }
  async runTradingNow(): Promise<void> { await this.executeTradingCycle(); }
  async runLearningNow(): Promise<void> { await this.executeLearningCycleWrapper(); }

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
    } catch (error) {
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
      if (!userSettings?.kiwoomAppKey || !userSettings?.kiwoomAppSecret) {
        await this.setRunState(model.userId, 'paused', model.id, 'missing_kiwoom_credentials', undefined, {
          cycleId,
          durationMs: Date.now() - startedAt,
        });
        await this.notifyEngineEvent(
          model.userId,
          'warn',
          'token_failed',
          '키움 API 키/시크릿이 없어 자동매매를 일시중지했습니다.',
          { modelId: model.id },
        );
        console.log(`⚠️  No Kiwoom API keys for user ${model.userId} - skipping`); return;
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

      const kiwoomService = new KiwoomService({
        appKey: decrypt(userSettings.kiwoomAppKey),
        appSecret: decrypt(userSettings.kiwoomAppSecret),
        accountType: userSettings.tradingMode === 'real' ? 'real' : 'mock',
      });
      const aiService = new AIService(process.env.OPENAI_API_KEY || '');

      const settings = await storage.getAutoTradingSettings(model.id);
      if (!settings) {
        console.log(`⚠️  No trading settings for model ${model.id} - creating defaults`);
        await this.executor.createDefaultSettings(model.id);
        return;
      }

      const conditions = await storage.getConditionFormulas(model.userId);
      const activeConditions = conditions.filter((c: ConditionFormula) => c.isActive);
      if (activeConditions.length === 0) { console.log('📭 No active condition formulas - skipping'); return; }

      for (const condition of activeConditions) {
        await this.processCondition(model, settings, condition, kiwoomService, aiService);
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

  private async processCondition(
    model: AiModel,
    settings: AutoTradingSettings,
    condition: ConditionFormula,
    kiwoomService: KiwoomService,
    aiService: AIService
  ) {
    console.log(`  🔍 Running condition: ${condition.conditionName}`);
    try {
      let conditionSeq = String((condition as any).kiwoomSeq ?? "").trim();
      if (!conditionSeq) {
        try {
          const rows = await this.userKiwoomService.getConditionList(model.userId);
          const matched = rows.find((row: any) => row.condition_name === condition.conditionName);
          if (matched) {
            conditionSeq = String(matched.condition_index);
          }
        } catch (seqResolveError) {
          console.warn('[AutoTrading] Kiwoom 조건식 seq 자동해결 실패:', seqResolveError);
        }
      }
      if (!conditionSeq) {
        conditionSeq = String(condition.id);
      }
      const results = await this.userKiwoomService.runCondition(model.userId, conditionSeq);
      if (!results?.length) {
        console.log(`  ⚠️  No stocks found for ${condition.conditionName}`); return;
      }
      console.log(`  📊 Found ${results.length} stocks matching condition`);
      for (const rawResult of results.slice(0, 10)) {
        const stockData = this.userKiwoomService.normalizeConditionResult(rawResult);
        await this.executor.evaluateStock(
          model, settings,
          { code: stockData.stockCode, name: stockData.stockName, price: parseFloat(stockData.currentPrice), volume: 0 },
          kiwoomService, aiService
        );
      }
    } catch (error) {
      console.error(`  ❌ Error in condition ${condition.conditionName}:`, error);
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
    if (this.isLearningRunning) { console.log('⏭️  Skipping learning cycle - previous still running'); return; }
    this.isLearningRunning = true;
    try { await this.executeLearningCycle(); }
    finally { this.isLearningRunning = false; }
  }

  private async executeLearningCycle() {
    if (!this.featureFlags.enableAdvancedLearning) {
      console.log('\n🎓 Advanced learning disabled by feature flag (ENABLE_ADVANCED_LEARNING)');
      return;
    }

    console.log('\n🎓 Starting learning optimization cycle...');
    try {
      const activeModels = await storage.getActiveAiModels();
      if (activeModels.length === 0) { console.log('📭 No active AI models found'); return; }
      console.log(`📊 Analyzing ${activeModels.length} active model(s)...`);
      for (const model of activeModels) await this.optimizeModel(model);
      console.log('✅ Learning optimization cycle completed\n');
    } catch (error) {
      console.error('❌ Error in learning cycle:', error);
    }
  }

  private async optimizeModel(model: AiModel) {
    console.log(`\n🧠 Learning from model: ${model.modelName} (ID: ${model.id})`);
    try {
      const result = await this.learningService.optimizeModel(model.id, true);
      const s = result.stats;
      console.log(`  📈 Stats: ${s.totalTrades} trades | winRate ${s.winRate.toFixed(1)}% | return ${s.totalReturn.toFixed(2)}%`);
      if (result.appliedChanges) console.log(`  ✅ Optimized parameters applied automatically`);
      result.recommendations.forEach((rec: string) => console.log(`  💡 ${rec}`));
    } catch (error) {
      console.error(`  ❌ Error optimizing model ${model.id}:`, error);
    }
  }
}

export const autoTradingWorker = new AutoTradingWorker();
