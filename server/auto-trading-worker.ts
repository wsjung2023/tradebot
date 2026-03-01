import * as cron from 'node-cron';
import { storage } from './storage';
import { KiwoomService } from './services/kiwoom';
import { AIService } from './services/ai.service';
import { LearningService } from './services/learning.service';
import { AiModel, AutoTradingSettings, ConditionFormula } from '@shared/schema';
import { decrypt } from './utils/crypto';
import { RainbowChartAnalyzer } from './formula/rainbow-chart';

class AutoTradingWorker {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private learningJob: cron.ScheduledTask | null = null;
  private learningService = new LearningService();

  async start() {
    console.log('🤖 Auto Trading Worker starting...');
    
    // Run trading every 1 minute
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.executeTradingCycle();
    });

    // Run learning optimization at 16:00 daily (after market close)
    this.learningJob = cron.schedule('0 16 * * *', async () => {
      await this.executeLearningCycle();
    });

    console.log('✅ Auto Trading Worker started (runs every 1 minute)');
    console.log('🎓 Learning System started (runs daily at 16:00)');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('⏹️  Auto Trading Worker stopped');
    }
    if (this.learningJob) {
      this.learningJob.stop();
      console.log('⏹️  Learning System stopped');
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

      const aiKey = process.env.OPENAI_API_KEY || '';
      const aiService = new AIService(aiKey);

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
      // Note: Using formula id as conditionIndex since schema doesn't store separate index
      const results = await kiwoomService.getConditionSearchResults(
        condition.conditionName,
        condition.id
      );

      if (!results || !results.output || results.output.length === 0) {
        console.log(`  ⚠️  No stocks found for ${condition.conditionName}`);
        return;
      }

      console.log(`  📊 Found ${results.output.length} stocks matching condition`);

      // 2. Process each candidate stock
      for (const stockData of results.output.slice(0, 10)) { // Limit to top 10 per cycle
        const stock = {
          code: stockData.stock_code,
          name: stockData.stock_name,
          price: parseFloat(stockData.current_price),
          volume: 0, // Volume not provided in condition search response
        };
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
    const financials = await kiwoomService.getFinancialStatements(stock.code);
    const hasGoodFinancials = financials.output && financials.output.length >= 3;

    // Get market price data
    const priceData = await kiwoomService.getStockPrice(stock.code);
    const volume = parseFloat(priceData.output.acml_vol);
    const hasHighLiquidity = volume > 100000;

    // Get 2 years chart data for rainbow chart
    const chartData = await kiwoomService.getStockChart(stock.code, 'D');
    // Mock OHLCV data since real API stub doesn't provide it
    const ohlcv = chartData.output || [];
    const rainbowChart = RainbowChartAnalyzer.analyze(stock.code, ohlcv);

    // AI analysis via GPT-4 with full context
    const analysis = await aiService.analyzeStock({
      stockCode: stock.code,
      stockName: stock.name,
      currentPrice: stock.price,
      rainbowChart,
    });

    // Calculate weighted confidence
    const weights = {
      theme: parseFloat(settings.themeWeight.toString()),
      news: parseFloat(settings.newsWeight.toString()),
      financials: parseFloat(settings.financialsWeight.toString()),
      liquidity: parseFloat(settings.liquidityWeight.toString()),
      institutional: parseFloat(settings.institutionalWeight.toString()),
    };

    const scores = {
      themeScore: analysis.confidence, // Use AI confidence as theme score
      newsScore: analysis.confidence, // Use AI confidence as news score
      financialsScore: hasGoodFinancials ? 80 : 30,
      liquidityScore: hasHighLiquidity ? 80 : 30,
      institutionalScore: 50, // Default value (institutional data not available)
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
  ): Promise<{ currentLine: number; action: 'buy' | 'sell' | 'hold'; weight: number; confidence: number }> {
    // Get 240-day chart data
    const chartData = await kiwoomService.getStockChart(stock.code, 'D', 250);
    const ohlcv = chartData.output || [];
    
    // Use RainbowChartAnalyzer
    const result = RainbowChartAnalyzer.analyze(stock.code, ohlcv, 240);
    const signalStrength = RainbowChartAnalyzer.getSignalStrength(result);
    
    // Find current line number (0-9) with zero-range guard
    const range = result.highest - result.lowest;
    const currentPercent = range > 0 ? ((stock.price - result.lowest) / range) * 100 : 50;
    const currentLine = Math.round((currentPercent / 100) * 9);
    
    // Map recommendation to action
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let weight = 0;
    
    if (result.recommendation === 'strong-buy') {
      action = 'buy';
      weight = 100;
    } else if (result.recommendation === 'buy') {
      action = 'buy';
      weight = 70;
    } else if (result.recommendation === 'sell') {
      action = 'sell';
      weight = 70;
    } else if (result.recommendation === 'strong-sell') {
      action = 'sell';
      weight = 100;
    }

    return {
      currentLine,
      action,
      weight,
      confidence: signalStrength,
    };
  }

  private async executeBuy(
    model: AiModel,
    settings: AutoTradingSettings,
    stock: { code: string; name: string; price: number },
    rainbow: { currentLine: number; action: 'buy' | 'sell' | 'hold'; weight: number; confidence: number },
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
    rainbow: { currentLine: number; action: 'buy' | 'sell' | 'hold'; weight: number; confidence: number },
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

  /**
   * Learning cycle: analyze performance and optimize parameters
   * Runs daily at 16:00 after market close
   */
  private async executeLearningCycle() {
    console.log('\n🎓 Starting learning optimization cycle...');

    try {
      // Get all active AI models
      const activeModels = await storage.getActiveAiModels();
      
      if (activeModels.length === 0) {
        console.log('📭 No active AI models found');
        return;
      }

      console.log(`📊 Analyzing ${activeModels.length} active model(s)...`);

      for (const model of activeModels) {
        await this.optimizeModel(model);
      }

      console.log('✅ Learning optimization cycle completed\n');
    } catch (error) {
      console.error('❌ Error in learning cycle:', error);
    }
  }

  private async optimizeModel(model: AiModel) {
    console.log(`\n🧠 Learning from model: ${model.modelName} (ID: ${model.id})`);

    try {
      // Auto-apply optimizations if there are 30+ trades
      const result = await this.learningService.optimizeModel(model.id, true);

      console.log(`  📈 Statistics:`);
      console.log(`    - Total trades: ${result.stats.totalTrades}`);
      console.log(`    - Win rate: ${result.stats.winRate.toFixed(1)}%`);
      console.log(`    - Win trades: ${result.stats.winTrades}`);
      console.log(`    - Loss trades: ${result.stats.lossTrades}`);
      console.log(`    - Avg profit: ${result.stats.avgProfitRate.toFixed(2)}%`);
      console.log(`    - Avg loss: ${result.stats.avgLossRate.toFixed(2)}%`);
      console.log(`    - Total return: ${result.stats.totalReturn.toFixed(2)}%`);
      console.log(`    - Sharpe ratio: ${result.stats.sharpeRatio.toFixed(2)}`);
      console.log(`    - Max drawdown: ${result.stats.maxDrawdown.toFixed(2)}%`);

      if (result.stats.totalTrades >= 10) {
        console.log(`  🎯 Best entry lines:`);
        result.patterns.bestEntryLines.slice(0, 3).forEach(line => {
          console.log(`    - Line ${line.line}%: ${line.winRate.toFixed(1)}% win rate, ${line.avgReturn.toFixed(2)}% avg return`);
        });

        console.log(`  📤 Best exit lines:`);
        result.patterns.bestExitLines.slice(0, 3).forEach(line => {
          console.log(`    - Line ${line.line}%: ${line.winRate.toFixed(1)}% win rate, ${line.avgReturn.toFixed(2)}% avg return`);
        });
      }

      console.log(`  💡 Recommendations:`);
      result.recommendations.forEach(rec => {
        console.log(`    - ${rec}`);
      });

      if (result.appliedChanges) {
        console.log(`  ✅ Optimized parameters applied automatically`);
        console.log(`    - Theme: ${result.patterns.optimalWeights.theme.toFixed(1)}%`);
        console.log(`    - News: ${result.patterns.optimalWeights.news.toFixed(1)}%`);
        console.log(`    - Financials: ${result.patterns.optimalWeights.financials.toFixed(1)}%`);
        console.log(`    - Liquidity: ${result.patterns.optimalWeights.liquidity.toFixed(1)}%`);
        console.log(`    - Institutional: ${result.patterns.optimalWeights.institutional.toFixed(1)}%`);
        console.log(`    - Min AI confidence: ${result.patterns.optimalThresholds.minAiConfidence}%`);
      }

    } catch (error) {
      console.error(`  ❌ Error optimizing model ${model.id}:`, error);
    }
  }
}

export const autoTradingWorker = new AutoTradingWorker();

