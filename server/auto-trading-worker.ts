import * as cron from 'node-cron';
import { storage } from './storage';
import { KiwoomService } from './services/kiwoom.service';
import { AIService } from './services/ai.service';
import { AiModel, AutoTradingSettings, ConditionFormula } from '@shared/schema';
import { decrypt } from './utils/crypto';

interface RainbowLineEvaluation {
  currentLine: number; // Which line (10-100%) is current price at?
  action: 'buy' | 'sell' | 'hold';
  weight: number; // Position weight 0-100
  confidence: number;
}

class AutoTradingWorker {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;

  async start() {
    console.log('🤖 Auto Trading Worker starting...');
    
    // Run every 1 minute
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.executeTradingCycle();
    });

    console.log('✅ Auto Trading Worker started (runs every 1 minute)');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('⏹️  Auto Trading Worker stopped');
    }
  }

  private async executeTradingCycle() {
    if (this.isRunning) {
      console.log('⏭️  Skipping cycle - previous cycle still running');
      return;
    }

    this.isRunning = true;

    try {
      // Check market hours (09:00 - 15:30 KST)
      if (!this.isMarketHours()) {
        console.log('⏰ Outside market hours - skipping');
        return;
      }

      console.log('🔄 Starting auto trading cycle...');

      // Get all active AI models
      const activeModels = await storage.getActiveAiModels();
      
      if (activeModels.length === 0) {
        console.log('📭 No active AI models found');
        return;
      }

      console.log(`📊 Found ${activeModels.length} active AI model(s)`);

      // Process each active model
      for (const model of activeModels) {
        await this.processModel(model);
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
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Market hours: 09:00 - 15:30 KST
    const currentMinutes = hour * 60 + minute;
    const marketOpen = 9 * 60; // 09:00
    const marketClose = 15 * 60 + 30; // 15:30

    return currentMinutes >= marketOpen && currentMinutes <= marketClose;
  }

  private async processModel(model: AiModel) {
    console.log(`\n🎯 Processing model: ${model.modelName} (ID: ${model.id})`);

    try {
      // 1. Get user settings to get Kiwoom API keys
      const userSettings = await storage.getUserSettings(model.userId);
      if (!userSettings?.kiwoomAppKey || !userSettings?.kiwoomAppSecret) {
        console.log(`⚠️  No Kiwoom API keys found for user ${model.userId} - skipping`);
        return;
      }

      // Initialize services with user's API keys
      const kiwoomService = new KiwoomService({
        appKey: decrypt(userSettings.kiwoomAppKey),
        appSecret: decrypt(userSettings.kiwoomAppSecret),
      });

      const aiService = new AIService();

      // 2. Get model settings
      const settings = await storage.getAutoTradingSettings(model.id);
      if (!settings) {
        console.log(`⚠️  No trading settings found for model ${model.id} - creating defaults`);
        await this.createDefaultSettings(model.id);
        return;
      }

      // 3. Get user's condition formulas
      const conditions = await storage.getConditionFormulas(model.userId);
      const activeConditions = conditions.filter((c: ConditionFormula) => c.isActive);
      
      if (activeConditions.length === 0) {
        console.log('📭 No active condition formulas - skipping');
        return;
      }

      // 4. Run condition search for each formula
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
      // 1. Execute condition search via Kiwoom API
      const results = await kiwoomService.getConditionSearchResults(
        condition.conditionName,
        condition.marketType as any
      );

      console.log(`  📊 Found ${results.length} stocks matching condition`);

      // 2. Process each candidate stock
      for (const stock of results.slice(0, 10)) { // Limit to top 10 per cycle
        await this.evaluateStock(model, settings, stock, kiwoomService, aiService);
      }

    } catch (error) {
      console.error(`  ❌ Error in condition ${condition.conditionName}:`, error);
    }
  }

  private async evaluateStock(
    model: AiModel,
    settings: AutoTradingSettings,
    stock: { code: string; name: string; price: number; volume: number },
    kiwoomService: KiwoomService,
    aiService: AIService
  ) {
    console.log(`    📈 Evaluating: ${stock.name} (${stock.code})`);

    try {
      // 1. AI Comprehensive Analysis
      const aiAnalysis = await this.comprehensiveAiAnalysis(stock, settings, kiwoomService, aiService);
      
      if (aiAnalysis.confidence < parseFloat(settings.minAiConfidence.toString())) {
        console.log(`    ⚠️  AI confidence ${aiAnalysis.confidence}% < threshold ${settings.minAiConfidence}% - skipping`);
        return;
      }

      // 2. Check filter requirements
      if (settings.requireGoodFinancials && !aiAnalysis.hasGoodFinancials) {
        console.log(`    ⚠️  Failed financials check - skipping`);
        return;
      }

      if (settings.requireHighLiquidity && !aiAnalysis.hasHighLiquidity) {
        console.log(`    ⚠️  Failed liquidity check - skipping`);
        return;
      }

      // 3. Evaluate 10-line rainbow chart
      const rainbowEval = await this.evaluate10LineRainbow(stock, settings, kiwoomService);
      
      console.log(`    🌈 Rainbow eval: ${rainbowEval.action} at ${rainbowEval.currentLine}% line (weight: ${rainbowEval.weight})`);

      // 4. Execute trade if signal is strong
      if (rainbowEval.action === 'buy' && rainbowEval.weight > 0) {
        await this.executeBuy(model, settings, stock, rainbowEval, aiAnalysis, kiwoomService);
      } else if (rainbowEval.action === 'sell' && rainbowEval.weight > 0) {
        await this.executeSell(model, settings, stock, rainbowEval, kiwoomService);
      }

    } catch (error) {
      console.error(`    ❌ Error evaluating ${stock.code}:`, error);
    }
  }

  private async comprehensiveAiAnalysis(
    stock: { code: string; name: string; price: number },
    settings: AutoTradingSettings,
    kiwoomService: KiwoomService,
    aiService: AIService
  ): Promise<{
    confidence: number;
    hasGoodFinancials: boolean;
    hasHighLiquidity: boolean;
    themeScore: number;
    newsScore: number;
    financialsScore: number;
    liquidityScore: number;
    institutionalScore: number;
  }> {
    // Get financial data
    const financials = await kiwoomService.getFinancialStatements(stock.code, 3);
    const hasGoodFinancials = financials.length >= 3 && financials.every((f: any) => f.isHealthy);

    // Get market data
    const marketData = await kiwoomService.getStockInfo(stock.code);
    const hasHighLiquidity = marketData.volume > 100000; // Simple check

    // AI analysis via GPT-4
    const analysis = await aiService.analyzeStock(stock.code);

    // Calculate weighted confidence
    const weights = {
      theme: parseFloat(settings.themeWeight.toString()),
      news: parseFloat(settings.newsWeight.toString()),
      financials: parseFloat(settings.financialsWeight.toString()),
      liquidity: parseFloat(settings.liquidityWeight.toString()),
      institutional: parseFloat(settings.institutionalWeight.toString()),
    };

    const scores = {
      themeScore: analysis.themeRelevance || 50,
      newsScore: analysis.newsImpact || 50,
      financialsScore: hasGoodFinancials ? 80 : 30,
      liquidityScore: hasHighLiquidity ? 80 : 30,
      institutionalScore: marketData.institutionalOwnership || 50,
    };

    const confidence = (
      scores.themeScore * weights.theme +
      scores.newsScore * weights.news +
      scores.financialsScore * weights.financials +
      scores.liquidityScore * weights.liquidity +
      scores.institutionalScore * weights.institutional
    ) / 100;

    return {
      confidence,
      hasGoodFinancials,
      hasHighLiquidity,
      ...scores,
    };
  }

  private async evaluate10LineRainbow(
    stock: { code: string; price: number },
    settings: AutoTradingSettings,
    kiwoomService: KiwoomService
  ): Promise<RainbowLineEvaluation> {
    // Get historical data to find peak
    const ohlcv = await kiwoomService.getOHLCV(stock.code, 500);
    
    // Find peak price in lookback period (2 years)
    const peak = Math.max(...ohlcv.map((d: any) => d.high));
    
    // Calculate current position (10% - 100%)
    const currentPercentage = (stock.price / peak) * 100;
    
    // Round to nearest 10% line
    const currentLine = Math.round(currentPercentage / 10) * 10;
    
    // Get settings for this line
    const rainbowSettings = settings.rainbowLineSettings as any[];
    const lineSetting = rainbowSettings.find(s => s.line === currentLine) || {
      line: currentLine,
      buyWeight: 0,
      sellWeight: 0,
    };

    // Determine action
    let action: 'buy' | 'sell' | 'hold';
    let weight = 0;

    if (currentLine <= settings.centerBuyLine) {
      // Below or at 50% = buy zone
      action = 'buy';
      weight = lineSetting.buyWeight || (100 - currentLine); // Lower = heavier buy
    } else {
      // Above 50% = sell zone
      action = 'sell';
      weight = lineSetting.sellWeight || (currentLine - 50); // Higher = heavier sell
    }

    return {
      currentLine,
      action,
      weight,
      confidence: Math.abs(currentLine - settings.centerBuyLine) * 2, // Distance from center
    };
  }

  private async executeBuy(
    model: AiModel,
    settings: AutoTradingSettings,
    stock: { code: string; name: string; price: number },
    rainbow: RainbowLineEvaluation,
    aiAnalysis: any,
    kiwoomService: KiwoomService
  ) {
    console.log(`    💰 BUY SIGNAL: ${stock.name} at ${rainbow.currentLine}% line`);

    try {
      // Calculate position size
      const baseSize = parseFloat(settings.defaultPositionSize.toString());
      const positionSize = Math.min(
        baseSize * (rainbow.weight / 100),
        parseFloat(settings.maxPositionSize.toString())
      );

      const quantity = Math.floor(positionSize / stock.price);

      if (quantity === 0) {
        console.log(`    ⚠️  Calculated quantity is 0 - skipping`);
        return;
      }

      // Get user's account
      const accounts = await storage.getKiwoomAccounts(model.userId);
      const activeAccount = accounts.find((a: any) => a.isActive);
      
      if (!activeAccount) {
        console.log(`    ⚠️  No active account found - skipping`);
        return;
      }

      // Place buy order
      const order = await storage.createOrder({
        accountId: activeAccount.id,
        stockCode: stock.code,
        stockName: stock.name,
        orderType: 'buy',
        orderMethod: 'market',
        orderPrice: stock.price.toFixed(2),
        orderQuantity: quantity,
        isAutoTrading: true,
        aiModelId: model.id,
      });

      // Execute via Kiwoom API
      await kiwoomService.placeOrder({
        accountNumber: activeAccount.accountNumber,
        stockCode: stock.code,
        orderType: 'buy',
        orderQuantity: quantity,
        orderPrice: stock.price,
        orderMethod: 'market',
      });

      // Save performance entry
      await storage.createTradingPerformance({
        modelId: model.id,
        orderId: order.id,
        stockCode: stock.code,
        stockName: stock.name,
        entryPrice: stock.price.toFixed(2),
        quantity,
        entryRainbowLine: rainbow.currentLine,
        entryAiConfidence: aiAnalysis.confidence.toFixed(2),
        entryConditions: {
          rainbow,
          aiAnalysis,
        },
        themeScore: aiAnalysis.themeScore.toFixed(2),
        newsScore: aiAnalysis.newsScore.toFixed(2),
        financialsScore: aiAnalysis.financialsScore.toFixed(2),
        liquidityScore: aiAnalysis.liquidityScore.toFixed(2),
        institutionalScore: aiAnalysis.institutionalScore.toFixed(2),
      });

      console.log(`    ✅ BUY order placed: ${quantity} shares @ ${stock.price}`);

    } catch (error) {
      console.error(`    ❌ Error executing buy:`, error);
    }
  }

  private async executeSell(
    model: AiModel,
    settings: AutoTradingSettings,
    stock: { code: string; name: string; price: number },
    rainbow: RainbowLineEvaluation,
    kiwoomService: KiwoomService
  ) {
    console.log(`    💵 SELL SIGNAL: ${stock.name} at ${rainbow.currentLine}% line`);

    // Check if we have holdings for this stock
    const accounts = await storage.getKiwoomAccounts(model.userId);
    const activeAccount = accounts.find((a: any) => a.isActive);
    
    if (!activeAccount) {
      return;
    }

    const holdings = await storage.getHoldings(activeAccount.id);
    const holding = holdings.find((h: any) => h.stockCode === stock.code);

    if (!holding) {
      console.log(`    ⚠️  No holdings found for ${stock.code} - skipping`);
      return;
    }

    try {
      // Calculate sell quantity (partial or full)
      const sellQuantity = Math.floor(holding.quantity * (rainbow.weight / 100));

      if (sellQuantity === 0) {
        console.log(`    ⚠️  Calculated sell quantity is 0 - skipping`);
        return;
      }

      // Place sell order
      const order = await storage.createOrder({
        accountId: activeAccount.id,
        stockCode: stock.code,
        stockName: stock.name,
        orderType: 'sell',
        orderMethod: 'market',
        orderPrice: stock.price.toFixed(2),
        orderQuantity: sellQuantity,
        isAutoTrading: true,
        aiModelId: model.id,
      });

      // Execute via Kiwoom API
      await kiwoomService.placeOrder({
        accountNumber: activeAccount.accountNumber,
        stockCode: stock.code,
        orderType: 'sell',
        orderQuantity: sellQuantity,
        orderPrice: stock.price,
        orderMethod: 'market',
      });

      // Update performance entry
      const perfEntry = await storage.getTradingPerformanceByStock(model.id, stock.code);
      if (perfEntry) {
        const profitLoss = (stock.price - parseFloat(perfEntry.entryPrice.toString())) * sellQuantity;
        const profitLossRate = ((stock.price / parseFloat(perfEntry.entryPrice.toString())) - 1) * 100;

        await storage.updateTradingPerformance(perfEntry.id, {
          exitPrice: stock.price.toFixed(2),
          exitRainbowLine: rainbow.currentLine,
          exitReason: 'target',
          profitLoss: profitLoss.toFixed(2),
          profitLossRate: profitLossRate.toFixed(4),
          isWin: profitLoss > 0,
        });

        console.log(`    ✅ SELL order placed: ${sellQuantity} shares @ ${stock.price} (P/L: ${profitLoss.toFixed(0)})`);
      }

    } catch (error) {
      console.error(`    ❌ Error executing sell:`, error);
    }
  }

  private async createDefaultSettings(modelId: number) {
    const defaultRainbowSettings = [
      { line: 10, buyWeight: 100, sellWeight: 0 },
      { line: 20, buyWeight: 90, sellWeight: 0 },
      { line: 30, buyWeight: 80, sellWeight: 0 },
      { line: 40, buyWeight: 70, sellWeight: 0 },
      { line: 50, buyWeight: 100, sellWeight: 0 }, // Center buy
      { line: 60, buyWeight: 0, sellWeight: 30 },
      { line: 70, buyWeight: 0, sellWeight: 50 },
      { line: 80, buyWeight: 0, sellWeight: 70 },
      { line: 90, buyWeight: 0, sellWeight: 90 },
      { line: 100, buyWeight: 0, sellWeight: 100 },
    ];

    await storage.createAutoTradingSettings({
      modelId,
      rainbowLineSettings: defaultRainbowSettings,
    });
  }
}

export const autoTradingWorker = new AutoTradingWorker();
