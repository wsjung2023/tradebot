// trade-executor.service.ts — 레인보우 차트 + AI 분석 기반 개별 종목 평가 및 매수/매도 주문 실행 서비스
import { storage } from '../storage';
import { KiwoomService } from './kiwoom';
import { AIService } from './ai.service';
import { AiModel, AutoTradingSettings } from '@shared/schema';
import { RainbowChartAnalyzer } from '../formula/rainbow-chart';
import { normalizeChartDataAsc } from '../utils/chart-normalization';

export type RainbowEval = {
  currentLine: number;
  action: 'buy' | 'sell' | 'hold';
  weight: number;
  confidence: number;
};

export type AiAnalysisResult = {
  confidence: number;
  hasGoodFinancials: boolean;
  hasHighLiquidity: boolean;
  themeScore: number;
  newsScore: number;
  financialsScore: number;
  liquidityScore: number;
  institutionalScore: number;
};

// CL선 색 기준: 파랑(blue)=10~20, 초록(green)=30~50, 노랑(yellow)=60~70, 빨강(red)=80~100
function getRainbowColor(line: number): 'blue' | 'green' | 'yellow' | 'red' {
  if (line <= 20) return 'blue';
  if (line <= 50) return 'green';
  if (line <= 70) return 'yellow';
  return 'red';
}

export class TradeExecutorService {

  // ── 오늘 KST 기준 자동매매 매수 주문 횟수 조회 ──
  private async countTodayAutoTrades(accountId: number): Promise<number> {
    const orders = await storage.getOrders(accountId, 200);
    // KST 오늘 자정(UTC)
    const nowUtc = Date.now();
    const kstMidnightUtc = Math.floor((nowUtc + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000;
    return orders.filter(o => {
      if (!o.isAutoTrading || o.orderType !== 'buy') return false;
      const ts = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      return ts >= kstMidnightUtc;
    }).length;
  }

  // ── 오늘 날짜 YYYYMMDD (KST) ──
  private todayKST(): string {
    const d = new Date(Date.now() + 9 * 3600000);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }

  // ── 신규 진입: 최대 보유 종목 체크 + AI/레인보우 평가 ──
  async evaluateStock(
    model: AiModel,
    settings: AutoTradingSettings,
    stock: { code: string; name: string; price: number; volume: number },
    kiwoomService: KiwoomService,
    aiService: AIService
  ): Promise<void> {
    console.log(`    📈 Evaluating: ${stock.name} (${stock.code})`);
    try {
      // ── 시장 이슈 관련 종목 필터 ──
      if (settings.requireMarketIssue) {
        const today = this.todayKST();
        const issues = await storage.getMarketIssuesByStock(stock.code);
        const hasTodayIssue = issues.some(i => i.issueDate === today);
        if (!hasTodayIssue) {
          console.log(`    ⚠️  시장 이슈 관련 종목 아님 (${stock.code}, ${today}) - 스킵`);
          return;
        }
        console.log(`    ✅ 시장 이슈 확인됨: ${stock.code}`);
      }

      const aiAnalysis = await this.comprehensiveAiAnalysis(stock, settings, kiwoomService, aiService);
      if (aiAnalysis.confidence < parseFloat(settings.minAiConfidence.toString())) {
        console.log(`    ⚠️  AI confidence ${aiAnalysis.confidence}% < threshold ${settings.minAiConfidence}% - skipping`);
        return;
      }
      if (settings.requireGoodFinancials && !aiAnalysis.hasGoodFinancials) {
        console.log(`    ⚠️  Failed financials check - skipping`);
        return;
      }
      if (settings.requireHighLiquidity && !aiAnalysis.hasHighLiquidity) {
        console.log(`    ⚠️  Failed liquidity check - skipping`);
        return;
      }
      const rainbowEval = await this.evaluate10LineRainbow(stock, settings, kiwoomService);
      console.log(`    🌈 Rainbow eval: ${rainbowEval.action} at ${rainbowEval.currentLine}% line (weight: ${rainbowEval.weight})`);
      if (rainbowEval.action === 'buy' && rainbowEval.weight > 0) {
        await this.executeBuy(model, settings, stock, rainbowEval, aiAnalysis, kiwoomService);
      } else if (rainbowEval.action === 'sell' && rainbowEval.weight > 0) {
        await this.executeSell(model, settings, stock, rainbowEval, kiwoomService);
      }
    } catch (error) {
      console.error(`    ❌ Error evaluating ${stock.code}:`, error);
    }
  }

  // ── 보유 포지션 손절/익절/동적청산 체크 (매 사이클 초입에 호출) ──
  async checkPositionsForExits(
    model: AiModel,
    settings: AutoTradingSettings,
    kiwoomService: KiwoomService
  ): Promise<void> {
    const config = (model.config as any) || {};
    const stopLossConfig = config.stopLossConfig as { color: 'green' | 'blue'; percent: number } | null | undefined;
    const takeProfitPercent = config.takeProfitPercent != null ? parseFloat(String(config.takeProfitPercent)) : null;

    if (!stopLossConfig && !takeProfitPercent && !settings.enableDynamicExit) return;

    const accounts = await storage.getKiwoomAccounts(model.userId);
    const targetAccountId = config.accountId;
    const activeAccount = targetAccountId
      ? accounts.find((a: any) => a.id === targetAccountId)
      : accounts.find((a: any) => a.isActive);
    if (!activeAccount) return;

    const holdings = await storage.getHoldings(activeAccount.id);
    if (holdings.length === 0) return;

    console.log(`  🔍 Checking ${holdings.length} holding(s) for exits (model: ${model.modelName})`);

    for (const holding of holdings) {
      try {
        const priceData = await kiwoomService.getStockPrice(holding.stockCode);
        const currentPrice = parseFloat(priceData.output?.stck_prpr || '0');
        const avgPrice = parseFloat((holding.averagePrice ?? holding as any).toString?.() || '0');
        if (!avgPrice || !currentPrice) continue;

        const profitRate = ((currentPrice - avgPrice) / avgPrice) * 100;

        let shouldSell = false;
        let exitReason = '';

        // 익절 체크
        if (takeProfitPercent && profitRate >= takeProfitPercent) {
          shouldSell = true;
          exitReason = `익절: +${profitRate.toFixed(1)}% (기준: +${takeProfitPercent}%)`;
        }

        // 손절 체크 (CL선 색 기준)
        if (!shouldSell && stopLossConfig && profitRate < 0) {
          const lossAbs = Math.abs(profitRate);
          if (lossAbs >= stopLossConfig.percent) {
            const currentLine = await this.getCurrentRainbowLine(holding.stockCode, currentPrice, kiwoomService);
            const currentColor = getRainbowColor(currentLine);
            if (currentColor === stopLossConfig.color) {
              shouldSell = true;
              exitReason = `손절: ${profitRate.toFixed(1)}% (기준: -${stopLossConfig.percent}%, CL=${stopLossConfig.color})`;
            } else {
              console.log(`    ℹ️  ${holding.stockCode} 손절 조건 미충족 (현재 CL색: ${currentColor}, 설정: ${stopLossConfig.color})`);
            }
          }
        }

        // ── 동적 청산 체크 ──
        if (!shouldSell && settings.enableDynamicExit) {
          const surgeThreshold = parseFloat(settings.surgeThreshold?.toString() || '0');
          const stalePeriodDays = parseInt(settings.stalePeriodDays?.toString() || '0');
          const volMultiplier = parseFloat(settings.volumeSpikeMultiplier?.toString() || '0');

          // 1) 급등 청산: profitRate >= surgeThreshold → 익절 유사 청산
          if (!shouldSell && surgeThreshold > 0 && profitRate >= surgeThreshold) {
            shouldSell = true;
            exitReason = `급등 청산: +${profitRate.toFixed(1)}% (기준: +${surgeThreshold}%)`;
          }

          // 2) 장기 보유 청산: stalePeriodDays 초과 + 손실 → 청산
          if (!shouldSell && stalePeriodDays > 0) {
            try {
              const perfEntry = await storage.getTradingPerformanceByStock(model.id, holding.stockCode);
              if (perfEntry?.createdAt) {
                const entryMs = new Date(perfEntry.createdAt).getTime();
                const daysSince = (Date.now() - entryMs) / 86400000;
                if (daysSince >= stalePeriodDays && profitRate < 0) {
                  shouldSell = true;
                  exitReason = `장기보유 청산: ${daysSince.toFixed(0)}일 보유, ${profitRate.toFixed(1)}% (기준: ${stalePeriodDays}일)`;
                }
              }
            } catch { /* 무시 */ }
          }

          // 3) 거래량 급증 청산: 당일 거래량 > 평균 × multiplier
          if (!shouldSell && volMultiplier > 0) {
            try {
              const chartData = await kiwoomService.getStockChart(holding.stockCode, 'D', 30);
              const ohlcv = normalizeChartDataAsc(chartData.output || chartData);
              if (ohlcv.length >= 5) {
                const avgVol = ohlcv.slice(0, -1).reduce((s: number, c: any) => s + (c.volume || 0), 0) / (ohlcv.length - 1);
                const todayVol = ohlcv[ohlcv.length - 1]?.volume || 0;
                if (avgVol > 0 && todayVol > avgVol * volMultiplier) {
                  shouldSell = true;
                  exitReason = `거래량급증 청산: ${(todayVol / avgVol).toFixed(1)}배 (기준: ${volMultiplier}배)`;
                }
              }
            } catch { /* 무시 */ }
          }
        }

        if (shouldSell) {
          console.log(`    🚨 Exit triggered for ${holding.stockCode}: ${exitReason}`);
          await this.executeExitSell(model, activeAccount, holding, currentPrice, exitReason, kiwoomService);
        }
      } catch (err) {
        console.error(`    ❌ Error checking exit for ${holding.stockCode}:`, err);
      }
    }
  }

  private async getCurrentRainbowLine(
    stockCode: string,
    currentPrice: number,
    kiwoomService: KiwoomService
  ): Promise<number> {
    try {
      const chartData = await kiwoomService.getStockChart(stockCode, 'D', 250);
      const ohlcv = normalizeChartDataAsc(chartData.output || chartData);
      const result = RainbowChartAnalyzer.analyze(stockCode, ohlcv, 240);
      const range = result.highest - result.lowest;
      const currentPercent = range > 0 ? ((currentPrice - result.lowest) / range) * 100 : 50;
      return Math.min(100, Math.max(10, Math.round(currentPercent / 10) * 10));
    } catch {
      return 50;
    }
  }

  private async executeExitSell(
    model: AiModel,
    activeAccount: any,
    holding: any,
    currentPrice: number,
    exitReason: string,
    kiwoomService: KiwoomService
  ): Promise<void> {
    const quantity = holding.quantity;
    if (!quantity || quantity <= 0) return;

    try {
      const order = await storage.createOrder({
        accountId: activeAccount.id,
        stockCode: holding.stockCode,
        stockName: holding.stockName || holding.stockCode,
        orderType: 'sell',
        orderMethod: 'market',
        orderPrice: currentPrice.toFixed(2),
        orderQuantity: quantity,
        isAutoTrading: true,
        aiModelId: model.id,
      });

      await kiwoomService.placeOrder({
        accountNumber: activeAccount.accountNumber,
        stockCode: holding.stockCode,
        orderType: 'sell',
        orderQuantity: quantity,
        orderPrice: currentPrice,
        orderMethod: 'market',
      });

      const avgPrice = parseFloat(holding.averagePrice?.toString() || '0');
      const profitLoss = (currentPrice - avgPrice) * quantity;
      const profitLossRate = avgPrice > 0 ? ((currentPrice / avgPrice) - 1) * 100 : 0;

      const perfEntry = await storage.getTradingPerformanceByStock(model.id, holding.stockCode);
      if (perfEntry) {
        await storage.updateTradingPerformance(perfEntry.id, {
          exitPrice: currentPrice.toFixed(2),
          exitRainbowLine: 0,
          exitReason,
          profitLoss: profitLoss.toFixed(2),
          profitLossRate: profitLossRate.toFixed(4),
          isWin: profitLoss > 0,
        });
      }
      console.log(`    ✅ Exit sell placed: ${quantity}주 @ ${currentPrice} (${exitReason})`);
    } catch (error) {
      console.error(`    ❌ Error executing exit sell for ${holding.stockCode}:`, error);
    }
  }

  async comprehensiveAiAnalysis(
    stock: { code: string; name: string; price: number },
    settings: AutoTradingSettings,
    kiwoomService: KiwoomService,
    aiService: AIService
  ): Promise<AiAnalysisResult> {
    const financials = await kiwoomService.getFinancialStatements(stock.code);
    const hasGoodFinancials = financials.output && financials.output.length >= 3;

    const priceData = await kiwoomService.getStockPrice(stock.code);
    const volume = parseFloat(priceData.output.acml_vol);
    const hasHighLiquidity = volume > 100000;

    const chartData = await kiwoomService.getStockChart(stock.code, 'D');
    const ohlcv = normalizeChartDataAsc(chartData.output || chartData);
    const rainbowChart = RainbowChartAnalyzer.analyze(stock.code, ohlcv);

    const analysis = await aiService.analyzeStock({
      stockCode: stock.code,
      stockName: stock.name,
      currentPrice: stock.price,
      rainbowChart,
    });

    const weights = {
      theme: parseFloat(settings.themeWeight.toString()),
      news: parseFloat(settings.newsWeight.toString()),
      financials: parseFloat(settings.financialsWeight.toString()),
      liquidity: parseFloat(settings.liquidityWeight.toString()),
      institutional: parseFloat(settings.institutionalWeight.toString()),
    };

    // ── 기관 점수: 거래량 기반 5단계 그레이딩 (하드코딩 50 제거) ──
    const institutionalScore =
      volume >= 1_000_000 ? 75 :
      volume >= 500_000  ? 65 :
      volume >= 100_000  ? 55 :
      volume >= 50_000   ? 45 : 35;

    const scores = {
      themeScore: analysis.themeScore,   // AI가 독립 산출한 테마/섹터 모멘텀 점수
      newsScore: analysis.newsScore,     // AI가 독립 산출한 뉴스 감성 점수
      financialsScore: hasGoodFinancials ? 80 : 30,
      liquidityScore: hasHighLiquidity ? 80 : 30,
      institutionalScore,
    };

    // ── 가중치 합계로 정규화 (합이 100 초과해도 신뢰도 0~100 보장) ──
    const totalWeight = weights.theme + weights.news + weights.financials + weights.liquidity + weights.institutional;
    const denominator = totalWeight > 0 ? totalWeight : 100;
    const confidence = Math.min(100, Math.max(0, (
      scores.themeScore * weights.theme +
      scores.newsScore * weights.news +
      scores.financialsScore * weights.financials +
      scores.liquidityScore * weights.liquidity +
      scores.institutionalScore * weights.institutional
    ) / denominator));

    return { confidence, hasGoodFinancials, hasHighLiquidity, ...scores };
  }

  async evaluate10LineRainbow(
    stock: { code: string; price: number },
    settings: AutoTradingSettings,
    kiwoomService: KiwoomService
  ): Promise<RainbowEval> {
    const chartData = await kiwoomService.getStockChart(stock.code, 'D', 250);
    const ohlcv = normalizeChartDataAsc(chartData.output || chartData);
    const result = RainbowChartAnalyzer.analyze(stock.code, ohlcv, 240);
    const signalStrength = RainbowChartAnalyzer.getSignalStrength(result);

    const range = result.highest - result.lowest;
    const currentPercent = range > 0 ? ((stock.price - result.lowest) / range) * 100 : 50;
    const currentLine = Math.min(100, Math.max(10, Math.round(currentPercent / 10) * 10));

    const rainbowSettings = (settings.rainbowLineSettings as { line: number; buyWeight: number; sellWeight: number }[] | null | undefined);
    let buyWeight = 0;
    let sellWeight = 0;

    if (rainbowSettings && Array.isArray(rainbowSettings) && rainbowSettings.length > 0) {
      const matched = rainbowSettings.reduce((prev, curr) =>
        Math.abs(curr.line - currentLine) < Math.abs(prev.line - currentLine) ? curr : prev
      );
      buyWeight = matched.buyWeight ?? 0;
      sellWeight = matched.sellWeight ?? 0;
    } else {
      if (result.recommendation === 'strong-buy') buyWeight = 100;
      else if (result.recommendation === 'buy') buyWeight = 70;
      else if (result.recommendation === 'sell') sellWeight = 70;
      else if (result.recommendation === 'strong-sell') sellWeight = 100;
    }

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let weight = 0;
    if (buyWeight > 0 && buyWeight >= sellWeight) {
      action = 'buy';
      weight = buyWeight;
    } else if (sellWeight > 0 && sellWeight > buyWeight) {
      action = 'sell';
      weight = sellWeight;
    }

    return { currentLine, action, weight, confidence: signalStrength };
  }

  async executeBuy(
    model: AiModel,
    settings: AutoTradingSettings,
    stock: { code: string; name: string; price: number },
    rainbow: RainbowEval,
    aiAnalysis: AiAnalysisResult,
    kiwoomService: KiwoomService
  ): Promise<void> {
    console.log(`    💰 BUY SIGNAL: ${stock.name} at ${rainbow.currentLine}% line`);
    try {
      const accounts = await storage.getKiwoomAccounts(model.userId);
      const config = (model.config as any) || {};
      const targetAccountId = config.accountId;
      const activeAccount = targetAccountId
        ? accounts.find((a: any) => a.id === targetAccountId)
        : accounts.find((a: any) => a.isActive);
      if (!activeAccount) { console.log(`    ⚠️  No active account found - skipping`); return; }

      // ── 최대 보유 종목 체크 ──
      const maxPositions = config.maxPositions != null ? parseInt(String(config.maxPositions)) : null;
      if (maxPositions && maxPositions > 0) {
        const holdings = await storage.getHoldings(activeAccount.id);
        if (holdings.length >= maxPositions) {
          console.log(`    ⚠️  최대 보유 종목 초과 (${holdings.length}/${maxPositions}) - 매수 건너뜀`);
          return;
        }
      }

      // ── 일일 최대 거래 횟수 체크 ──
      const maxDailyTrades = parseInt(settings.maxDailyTrades?.toString() || '0');
      if (maxDailyTrades > 0) {
        const todayCount = await this.countTodayAutoTrades(activeAccount.id);
        if (todayCount >= maxDailyTrades) {
          console.log(`    ⚠️  일일 최대 거래 횟수 초과 (${todayCount}/${maxDailyTrades}) - 매수 건너뜀`);
          return;
        }
        console.log(`    ℹ️  오늘 자동매매 횟수: ${todayCount}/${maxDailyTrades}`);
      }

      const baseSize = parseFloat(settings.defaultPositionSize.toString());
      const positionSize = Math.min(baseSize * (rainbow.weight / 100), parseFloat(settings.maxPositionSize.toString()));
      const quantity = Math.floor(positionSize / stock.price);
      if (quantity === 0) { console.log(`    ⚠️  Calculated quantity is 0 - skipping`); return; }

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

      await kiwoomService.placeOrder({
        accountNumber: activeAccount.accountNumber,
        stockCode: stock.code,
        orderType: 'buy',
        orderQuantity: quantity,
        orderPrice: stock.price,
        orderMethod: 'market',
      });

      await storage.createTradingPerformance({
        modelId: model.id,
        orderId: order.id,
        stockCode: stock.code,
        stockName: stock.name,
        entryPrice: stock.price.toFixed(2),
        quantity,
        entryRainbowLine: rainbow.currentLine,
        entryAiConfidence: aiAnalysis.confidence.toFixed(2),
        entryConditions: { rainbow, aiAnalysis },
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

  async executeSell(
    model: AiModel,
    settings: AutoTradingSettings,
    stock: { code: string; name: string; price: number },
    rainbow: RainbowEval,
    kiwoomService: KiwoomService
  ): Promise<void> {
    console.log(`    💵 SELL SIGNAL: ${stock.name} at ${rainbow.currentLine}% line`);
    const accounts = await storage.getKiwoomAccounts(model.userId);
    const targetAccountId = (model.config as any)?.accountId;
    const activeAccount = targetAccountId
      ? accounts.find((a: any) => a.id === targetAccountId)
      : accounts.find((a: any) => a.isActive);
    if (!activeAccount) return;

    const holdings = await storage.getHoldings(activeAccount.id);
    const holding = holdings.find((h: any) => h.stockCode === stock.code);
    if (!holding) { console.log(`    ⚠️  No holdings found for ${stock.code} - skipping`); return; }

    try {
      const sellQuantity = Math.floor(holding.quantity * (rainbow.weight / 100));
      if (sellQuantity === 0) { console.log(`    ⚠️  Calculated sell quantity is 0 - skipping`); return; }

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

      await kiwoomService.placeOrder({
        accountNumber: activeAccount.accountNumber,
        stockCode: stock.code,
        orderType: 'sell',
        orderQuantity: sellQuantity,
        orderPrice: stock.price,
        orderMethod: 'market',
      });

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

  async createDefaultSettings(modelId: number): Promise<void> {
    const defaultRainbowSettings = [
      { line: 10, buyWeight: 100, sellWeight: 0 },
      { line: 20, buyWeight: 90,  sellWeight: 0 },
      { line: 30, buyWeight: 80,  sellWeight: 0 },
      { line: 40, buyWeight: 70,  sellWeight: 0 },
      { line: 50, buyWeight: 100, sellWeight: 0 },
      { line: 60, buyWeight: 0,   sellWeight: 30 },
      { line: 70, buyWeight: 0,   sellWeight: 50 },
      { line: 80, buyWeight: 0,   sellWeight: 70 },
      { line: 90, buyWeight: 0,   sellWeight: 90 },
      { line: 100, buyWeight: 0,  sellWeight: 100 },
    ];
    await storage.createAutoTradingSettings({ modelId, rainbowLineSettings: defaultRainbowSettings });
  }
}
