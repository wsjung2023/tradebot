// auto-trading-worker.ts — 자동매매 cron 스케줄러. 매 1분마다 AI 모델 순회 및 조건 검색 실행
import * as cron from 'node-cron';
import { storage } from './storage';
import { getKiwoomService, KiwoomService } from './services/kiwoom';
import { AIService } from './services/ai.service';
import { LearningService } from './services/learning.service';
import { TradeExecutorService } from './services/trade-executor.service';
import { AiModel, AutoTradingSettings, ConditionFormula } from '@shared/schema';
import { decrypt } from './utils/crypto';

class AutoTradingWorker {
  private isRunning = false;
  private isLearningRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private learningJob: cron.ScheduledTask | null = null;
  private learningService = new LearningService();
  private executor = new TradeExecutorService();

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

  private async executeTradingCycle() {
    if (this.isRunning) { console.log('⏭️  Skipping cycle - previous cycle still running'); return; }
    this.isRunning = true;
    try {
      if (!this.isMarketHours()) return;
      console.log('🔄 Starting auto trading cycle...');
      const activeModels = await storage.getActiveAiModels();
      if (activeModels.length === 0) { console.log('📭 No active AI models found'); return; }
      console.log(`📊 Found ${activeModels.length} active AI model(s)`);
      for (const model of activeModels) await this.processModel(model);

      try {
        await this.checkPriceAlerts();
      } catch (alertError) {
        console.error('[AutoTrading] 가격 알림 체크 오류:', alertError);
      }

      console.log('✅ Trading cycle completed');
    } catch (error) {
      console.error('❌ Error in trading cycle:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private isMarketHours(): boolean {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return currentMinutes >= 9 * 60 && currentMinutes <= 15 * 60 + 30;
  }

  private async processModel(model: AiModel) {
    console.log(`\n🎯 Processing model: ${model.modelName} (ID: ${model.id})`);
    try {
      const userSettings = await storage.getUserSettings(model.userId);
      if (!userSettings?.kiwoomAppKey || !userSettings?.kiwoomAppSecret) {
        console.log(`⚠️  No Kiwoom API keys for user ${model.userId} - skipping`); return;
      }

      const kiwoomService = new KiwoomService({
        appKey: decrypt(userSettings.kiwoomAppKey),
        appSecret: decrypt(userSettings.kiwoomAppSecret),
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
    } catch (error) {
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
          const conditionList = await kiwoomService.getConditionList();
          const rows = conditionList?.output ?? [];
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
      const results = await kiwoomService.getConditionSearchResults(conditionSeq, condition.id);
      if (!results?.output?.length) {
        console.log(`  ⚠️  No stocks found for ${condition.conditionName}`); return;
      }
      console.log(`  📊 Found ${results.output.length} stocks matching condition`);
      for (const stockData of results.output.slice(0, 10)) {
        await this.executor.evaluateStock(
          model, settings,
          { code: stockData.stock_code, name: stockData.stock_name, price: parseFloat(stockData.current_price), volume: 0 },
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

    const codes = Array.from(new Set(alerts.map((alert) => alert.stockCode)));
    const kiwoom = getKiwoomService();

    let priceMap: Record<string, number> = {};
    try {
      const prices = await kiwoom.getWatchlistInfo(codes);
      for (const price of prices) {
        const current = parseFloat(String(price.currentPrice).replace(/[^0-9.-]/g, ''));
        if (!Number.isNaN(current)) {
          priceMap[price.stockCode] = current;
        }
      }
    } catch (error) {
      console.warn('[AutoTrading] 시세 조회 실패로 알림 체크 스킵:', error);
      return;
    }

    for (const alert of alerts) {
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

  // ─── Learning Cycle (매일 장 마감 후 16:00 실행) ───────────────────────

  private async executeLearningCycleWrapper() {
    if (this.isLearningRunning) { console.log('⏭️  Skipping learning cycle - previous still running'); return; }
    this.isLearningRunning = true;
    try { await this.executeLearningCycle(); }
    finally { this.isLearningRunning = false; }
  }

  private async executeLearningCycle() {
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
