// trade-executor.service.ts — 레인보우 차트 + GPT 분석 기반 개별 종목 평가 및 매수/매도 주문 실행 서비스
import { storage } from '../storage';
import { KiwoomService } from './kiwoom';
import { AIService } from './ai.service';
import { AiModel, AutoTradingSettings, CandidateStock } from '@shared/schema';
import { RainbowChartAnalyzer } from '../formula/rainbow-chart';
import { normalizeChartDataAsc } from '../utils/chart-normalization';
import { getNewsService } from './news.service';
import { getDartService } from './dart.service';

// 위험 공시 키워드 → 매수 자동 차단
const DART_DANGER_KEYWORDS = [
  '유상증자', '전환사채', '신주인수권부사채', '횡령', '배임', '관리종목', '상장폐지',
  '영업정지', '파산', '회생절차', '불성실공시', '투자경고', '투자위험',
];

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
  dartDangerKeyword: string | null;
  themeScore: number;
  newsScore: number;
  financialsScore: number;
  liquidityScore: number;
  institutionalScore: number;
};

type CandidateDecisionCooldownMode = 'interval_120m' | 'daily_three_slots' | 'daily_once';

// CL선 색 기준: 파랑(blue)=10~20, 초록(green)=30~50, 노랑(yellow)=60~70, 빨강(red)=80~100
function getRainbowColor(line: number): 'blue' | 'green' | 'yellow' | 'red' {
  if (line <= 20) return 'blue';
  if (line <= 50) return 'green';
  if (line <= 70) return 'yellow';
  return 'red';
}

export class TradeExecutorService {
  private normalizeStockCode(code: string | null | undefined): string {
    return String(code ?? "").trim().replace(/^A/i, "");
  }

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

  private getAiWeights(settings: AutoTradingSettings) {
    return {
      theme: parseFloat(settings.themeWeight?.toString() ?? '20'),
      news: parseFloat(settings.newsWeight?.toString() ?? '15'),
      financials: parseFloat(settings.financialsWeight?.toString() ?? '25'),
      liquidity: parseFloat(settings.liquidityWeight?.toString() ?? '20'),
      institutional: parseFloat(settings.institutionalWeight?.toString() ?? '20'),
    };
  }

  private buildConfidenceBreakdown(settings: AutoTradingSettings, analysis: AiAnalysisResult) {
    const weights = this.getAiWeights(settings);
    const weighted = {
      theme: analysis.themeScore * weights.theme,
      news: analysis.newsScore * weights.news,
      financials: analysis.financialsScore * weights.financials,
      liquidity: analysis.liquidityScore * weights.liquidity,
      institutional: analysis.institutionalScore * weights.institutional,
    };
    const denominator = weights.theme + weights.news + weights.financials + weights.liquidity + weights.institutional || 100;
    const weightedSum = weighted.theme + weighted.news + weighted.financials + weighted.liquidity + weighted.institutional;
    const calculatedConfidence = Math.min(100, Math.max(0, weightedSum / denominator));

    return {
      weights,
      scores: {
        theme: analysis.themeScore,
        news: analysis.newsScore,
        financials: analysis.financialsScore,
        liquidity: analysis.liquidityScore,
        institutional: analysis.institutionalScore,
      },
      weighted,
      denominator,
      weightedSum: Number(weightedSum.toFixed(2)),
      calculatedConfidence: Number(calculatedConfidence.toFixed(2)),
      minAiConfidence: parseFloat(settings.minAiConfidence?.toString() ?? '0'),
    };
  }

  private getDecisionCooldownMode(settings: AutoTradingSettings): CandidateDecisionCooldownMode {
    const mode = (settings.aiEntryPolicy as any)?.candidateDecisionCooldownMode;
    if (mode === 'daily_three_slots' || mode === 'daily_once' || mode === 'interval_120m') {
      return mode;
    }
    return 'interval_120m';
  }

  private getKstDayStart(base: Date): Date {
    const kst = new Date(base.getTime() + 9 * 60 * 60 * 1000);
    const year = kst.getUTCFullYear();
    const month = kst.getUTCMonth();
    const day = kst.getUTCDate();
    return new Date(Date.UTC(year, month, day, -9, 0, 0, 0));
  }

  private getKstDate(base: Date, hour: number, minute: number): Date {
    const kst = new Date(base.getTime() + 9 * 60 * 60 * 1000);
    const year = kst.getUTCFullYear();
    const month = kst.getUTCMonth();
    const day = kst.getUTCDate();
    return new Date(Date.UTC(year, month, day, hour - 9, minute, 0, 0));
  }

  private getDecisionCooldownWindow(settings: AutoTradingSettings, now: Date): {
    mode: CandidateDecisionCooldownMode;
    since: Date;
    label: string;
  } {
    const mode = this.getDecisionCooldownMode(settings);
    if (mode === 'daily_once') {
      return {
        mode,
        since: this.getKstDayStart(now),
        label: 'daily_once',
      };
    }

    if (mode === 'daily_three_slots') {
      const slots = [
        { hour: 9, minute: 10, label: '09:10' },
        { hour: 13, minute: 30, label: '13:30' },
        { hour: 15, minute: 10, label: '15:10' },
      ];
      const slotDates = slots.map((slot) => ({ ...slot, at: this.getKstDate(now, slot.hour, slot.minute) }));
      const currentTs = now.getTime();
      const currentSlot = slotDates
        .filter((slot) => slot.at.getTime() <= currentTs)
        .sort((a, b) => b.at.getTime() - a.at.getTime())[0];

      if (currentSlot) {
        return {
          mode,
          since: currentSlot.at,
          label: `daily_three_slots:${currentSlot.label}`,
        };
      }

      return {
        mode,
        since: this.getKstDayStart(now),
        label: 'daily_three_slots:before_09:10',
      };
    }

    return {
      mode: 'interval_120m',
      since: new Date(now.getTime() - 120 * 60 * 1000),
      label: 'interval_120m',
    };
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
          storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${stock.name} — 시장이슈 미등록`, payload: { stockCode: stock.code, stockName: stock.name, skipReason: '시장이슈 미등록' } }).catch(e => console.error('[Notification]', e));
          return;
        }
        console.log(`    ✅ 시장 이슈 확인됨: ${stock.code}`);
      }

      const aiAnalysis = await this.comprehensiveAiAnalysis(stock, settings, kiwoomService, aiService);
      if (aiAnalysis.confidence < parseFloat(settings.minAiConfidence.toString())) {
        const confidenceBreakdown = this.buildConfidenceBreakdown(settings, aiAnalysis);
        console.log(`    ⚠️  AI confidence ${aiAnalysis.confidence}% < threshold ${settings.minAiConfidence}% - skipping`);
        storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${stock.name} — AI신뢰도 미달 (${aiAnalysis.confidence.toFixed(1)}% < ${settings.minAiConfidence}%)`, payload: { stockCode: stock.code, stockName: stock.name, skipReason: 'minAiConf미달', confidence: aiAnalysis.confidence, themeScore: aiAnalysis.themeScore, newsScore: aiAnalysis.newsScore, financialsScore: aiAnalysis.financialsScore, liquidityScore: aiAnalysis.liquidityScore, institutionalScore: aiAnalysis.institutionalScore, confidenceBreakdown } }).catch(e => console.error('[Notification]', e));
        return;
      }
      if (settings.requireGoodFinancials && !aiAnalysis.hasGoodFinancials) {
        console.log(`    ⚠️  Failed financials check (score < 60) - skipping`);
        storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${stock.name} — 재무건전성 미충족 (${aiAnalysis.financialsScore})`, payload: { stockCode: stock.code, stockName: stock.name, skipReason: '재무필터', financialsScore: aiAnalysis.financialsScore } }).catch(e => console.error('[Notification]', e));
        return;
      }
      if (settings.requireHighLiquidity && !aiAnalysis.hasHighLiquidity) {
        console.log(`    ⚠️  Failed liquidity check (score < 40) - skipping`);
        storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${stock.name} — 유동성 미충족 (${aiAnalysis.liquidityScore})`, payload: { stockCode: stock.code, stockName: stock.name, skipReason: '유동성필터', liquidityScore: aiAnalysis.liquidityScore } }).catch(e => console.error('[Notification]', e));
        return;
      }
      // DART 위험 공시 감지 → 무조건 매수 차단 (설정 무관)
      if (aiAnalysis.dartDangerKeyword) {
        console.log(`    🚫 DART 위험공시 감지 [${aiAnalysis.dartDangerKeyword}] - 매수 차단`);
        storage.createEngineNotification({ userId: model.userId, severity: 'warn', type: 'SKIP', message: `[차단] ${stock.name} — DART 위험공시 [${aiAnalysis.dartDangerKeyword}]`, payload: { stockCode: stock.code, stockName: stock.name, skipReason: 'DART위험', dartDangerKeyword: aiAnalysis.dartDangerKeyword } }).catch(e => console.error('[Notification]', e));
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
    kiwoomService: KiwoomService,
    aiService?: AIService
  ): Promise<void> {
    const config = (model.config as any) || {};
    const stopLossConfig = config.stopLossConfig as { color: 'green' | 'blue'; percent: number } | null | undefined;
    const takeProfitPercent = config.takeProfitPercent != null ? parseFloat(String(config.takeProfitPercent)) : null;
    const stopLossPolicy = (settings.stopLossPolicy as any) ?? {};
    const stopLossMode = String(stopLossPolicy.mode ?? 'soft_ai_first');
    const hardCutLossPctRaw = parseFloat(String(stopLossPolicy.hardCutLossPct ?? '0'));
    const hardCutLossPct = Number.isFinite(hardCutLossPctRaw) && hardCutLossPctRaw > 0 ? hardCutLossPctRaw : null;
    const allowAiPartialTakeProfit = settings.allowAiPartialTakeProfit === true;
    const allowAiHoldBeyondTarget = settings.allowAiHoldBeyondTarget === true;

    if (
      !stopLossConfig &&
      !takeProfitPercent &&
      !settings.enableDynamicExit &&
      stopLossMode !== 'hard' &&
      stopLossMode !== 'conditional'
    ) return;

    const accounts = await storage.getKiwoomAccounts(model.userId);
    const targetAccountId = config.accountId;
    if (!targetAccountId) {
      console.log(`  ⛔ accountId 미설정 — checkPositionsForExits 중단`);
      return;
    }
    const activeAccount = accounts.find((a: any) => a.id === targetAccountId);
    if (!activeAccount) return;

    const holdings = await storage.getHoldings(activeAccount.id);
    if (holdings.length === 0) return;

    console.log(`  🔍 Checking ${holdings.length} holding(s) for exits (model: ${model.modelName})`);

    for (const holding of holdings) {
      try {
        const priceData = await kiwoomService.getStockPrice(holding.stockCode);
        const currentPrice = parseFloat(priceData.output?.stck_prpr || '0');
        const avgPrice = parseFloat(holding.averagePrice?.toString() || '0');
        if (!avgPrice || !currentPrice) continue;

        const profitRate = ((currentPrice - avgPrice) / avgPrice) * 100;

        let shouldSell = false;
        let sellRatio = 1;
        let exitReason = '';
        let currentLineForDecision: number | null = null;

        // 익절 체크
        if (takeProfitPercent && profitRate >= takeProfitPercent) {
          if (allowAiHoldBeyondTarget) {
            console.log(`    ℹ️  ${holding.stockCode} 목표 도달(+${takeProfitPercent}%) 했지만 '목표초과 보유 허용' 설정으로 보유 유지`);
          } else if (allowAiPartialTakeProfit && holding.quantity >= 2) {
            shouldSell = true;
            sellRatio = 0.5;
            exitReason = `부분익절: +${profitRate.toFixed(1)}% (기준: +${takeProfitPercent}%, 50% 청산)`;
          } else {
            shouldSell = true;
            exitReason = `익절: +${profitRate.toFixed(1)}% (기준: +${takeProfitPercent}%)`;
          }
        }

        // 손절 체크
        if (!shouldSell && profitRate < 0) {
          const lossAbs = Math.abs(profitRate);

          // 신규 손절 정책: hard 우선
          if ((stopLossMode === 'hard' || stopLossMode === 'conditional') && hardCutLossPct && lossAbs >= hardCutLossPct) {
            shouldSell = true;
            exitReason = `강제손절: ${profitRate.toFixed(1)}% (기준: -${hardCutLossPct}%)`;
          }

          // 레거시 CL 손절: disabled가 아닐 때만 적용
          if (!shouldSell && stopLossMode !== 'disabled' && stopLossConfig && lossAbs >= stopLossConfig.percent) {
            const currentLine = await this.getCurrentRainbowLine(holding.stockCode, currentPrice, kiwoomService);
            currentLineForDecision = currentLine;
            const currentColor = getRainbowColor(currentLine);
            if (currentColor === stopLossConfig.color || stopLossMode === 'conditional') {
              shouldSell = true;
              exitReason = `손절: ${profitRate.toFixed(1)}% (기준: -${stopLossConfig.percent}%, CL=${stopLossConfig.color}, mode=${stopLossMode})`;
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

        if (shouldSell && stopLossMode === 'soft_ai_first' && aiService) {
          try {
            if (currentLineForDecision === null) {
              currentLineForDecision = await this.getCurrentRainbowLine(holding.stockCode, currentPrice, kiwoomService);
            }
            const perfEntry = await storage.getTradingPerformanceByStock(model.id, holding.stockCode);
            const holdingDays = perfEntry?.createdAt
              ? Math.max(0, Math.floor((Date.now() - new Date(perfEntry.createdAt).getTime()) / 86400000))
              : 0;
            const aiDecision = await aiService.decidePositionManagement({
              stock: { code: holding.stockCode, name: holding.stockName || holding.stockCode, price: currentPrice },
              currentLine: currentLineForDecision ?? 50,
              holdingDays,
              modelType: model.modelType,
              performance: {
                entryPrice: avgPrice,
                quantity: holding.quantity,
                filledUnits: perfEntry?.filledUnits ?? null,
                maxUnitsReached: perfEntry?.maxUnitsReached ?? null,
                entryLadderPlan: perfEntry?.entryLadderPlan ?? null,
                filledEntrySteps: perfEntry?.filledEntrySteps ?? null,
                holdDecisionSnapshots: perfEntry?.holdDecisionSnapshots ?? null,
                plannedExitPolicy: perfEntry?.plannedExitPolicy ?? null,
              },
              settings: {
                maxUnitsPerStock: settings.maxUnitsPerStock ?? null,
                stopLossPolicy: settings.stopLossPolicy ?? null,
                aiExitPolicy: settings.aiExitPolicy ?? null,
                allowAiPartialTakeProfit: settings.allowAiPartialTakeProfit ?? null,
                allowAiHoldBeyondTarget: settings.allowAiHoldBeyondTarget ?? null,
              },
            });

            if (aiDecision.action === 'hold' || aiDecision.action === 'scale_in') {
              shouldSell = false;
              exitReason = `AI 보유판단(soft_ai_first): ${aiDecision.reasoning || 'hold'}`;
            } else if (aiDecision.action === 'partial_exit' && holding.quantity >= 2) {
              shouldSell = true;
              sellRatio = 0.5;
              exitReason = `AI 부분청산(soft_ai_first): ${aiDecision.reasoning || 'partial_exit'}`;
            } else if (aiDecision.action === 'full_exit' || aiDecision.action === 'stop_loss') {
              shouldSell = true;
              sellRatio = 1;
              exitReason = `AI 청산(soft_ai_first): ${aiDecision.reasoning || aiDecision.action}`;
            }
          } catch (aiErr) {
            console.warn(`    ⚠️ soft_ai_first 판단 실패 - 기존 청산 로직 유지`, aiErr);
          }
        }

        if (shouldSell) {
          console.log(`    🚨 Exit triggered for ${holding.stockCode}: ${exitReason}`);
          await this.executeExitSell(model, activeAccount, holding, currentPrice, exitReason, kiwoomService, sellRatio);
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
    kiwoomService: KiwoomService,
    sellRatio: number = 1
  ): Promise<void> {
    const quantity = Math.floor(holding.quantity * Math.max(0, Math.min(1, sellRatio)));
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
      storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SELL', message: `[청산] ${holding.stockName || holding.stockCode} ${quantity}주 @ ${currentPrice.toLocaleString()}원 (${profitLoss > 0 ? '+' : ''}${profitLoss.toFixed(0)}원)`, payload: { stockCode: holding.stockCode, stockName: holding.stockName || holding.stockCode, price: currentPrice, quantity, profitLoss, profitLossRate, sellReason: exitReason } }).catch(e => console.error('[Notification]', e));
    } catch (error) {
      console.error(`    ❌ Error executing exit sell for ${holding.stockCode}:`, error);
    }
  }

  // ── GPT + 가중치 기반 종합 분석 (레인보우+모멘텀+뉴스+DART+재무) ──────
  async comprehensiveAiAnalysis(
    stock: { code: string; name: string; price: number },
    settings: AutoTradingSettings,
    kiwoomService: KiwoomService,
    aiService: AIService
  ): Promise<AiAnalysisResult> {
    // ── 1단계: 5개 데이터 병렬 수집 ─────────────────────────────────────
    const [priceResult, chartResult, ratiosResult, newsResult, dartResult] = await Promise.allSettled([
      kiwoomService.getStockPrice(stock.code),
      kiwoomService.getStockChart(stock.code, 'D'),
      kiwoomService.getFinancialRatios(stock.code),
      getNewsService().getStockNews(stock.code, stock.name, 10),
      getDartService().getFilingsByStockCode(stock.code, 30),
    ]);

    // ── 2단계: 가격/거래량 추출 ──────────────────────────────────────────
    const priceOutput = priceResult.status === 'fulfilled' ? priceResult.value.output : null;
    const volume = parseFloat(priceOutput?.acml_vol ?? '0') || 0;

    // ── 3단계: 레인보우 차트 계산 ────────────────────────────────────────
    const chartRaw = chartResult.status === 'fulfilled' ? (chartResult.value.output || chartResult.value) : [];
    const ohlcv = normalizeChartDataAsc(chartRaw);
    const rainbowChart = RainbowChartAnalyzer.analyze(stock.code, ohlcv);

    // ── 4단계: PER/PBR/ROE/EPS/BPS 추출 → GPT 재무 분석 인풋 ───────────
    const ratiosRaw = ratiosResult.status === 'fulfilled' ? ratiosResult.value.output : null;
    const financialRatios = ratiosRaw ? {
      per: ratiosRaw.per || '0',
      pbr: ratiosRaw.pbr || '0',
      eps: ratiosRaw.eps || '0',
      bps: ratiosRaw.bps || '0',
      roe: ratiosRaw.roe || '0',
    } : undefined;

    // ── 5단계: 뉴스 감성 데이터 ──────────────────────────────────────────
    const news = newsResult.status === 'fulfilled' ? newsResult.value : undefined;

    // ── 5-2단계: DART 공시 추출 ──────────────────────────────────────────
    const dartFilings = dartResult.status === 'fulfilled'
      ? dartResult.value.map(f => ({ reportNm: f.reportNm, rceptDt: f.rceptDt }))
      : [];

    // ── 6단계: 가격 이력 (최근 20일) ────────────────────────────────────
    const priceHistory = ohlcv.slice(-20).map(d => ({
      date: d.date,
      price: d.close,
      volume: d.volume,
    }));

    // ── 7단계: GPT 2개 병렬 호출 ─────────────────────────────────────────
    //  · analyzeStock     : 레인보우 차트 + 모멘텀 → themeScore
    //  · integratedAnalysis: 뉴스 + DART + PER/PBR/ROE + 가격이력 → newsScore, financialScore
    const [stockAnalysis, integrated] = await Promise.all([
      aiService.analyzeStock({
        stockCode: stock.code,
        stockName: stock.name,
        currentPrice: stock.price,
        rainbowChart,
      }),
      aiService.integratedAnalysis({
        stockCode: stock.code,
        stockName: stock.name,
        currentPrice: stock.price,
        financialRatios,
        priceHistory,
        news,
        dartFilings,
      }),
    ]);

    // ── 8단계: 거래량 기반 점수 (규칙, GPT 불필요) ──────────────────────
    const liquidityScore =
      volume >= 500_000 ? 80 :
      volume >= 100_000 ? 65 :
      volume >= 50_000  ? 45 : 25;

    const institutionalScore =
      volume >= 1_000_000 ? 75 :
      volume >= 500_000   ? 65 :
      volume >= 100_000   ? 55 :
      volume >= 50_000    ? 45 : 35;

    // ── 9단계: 가중치 곱하기 → 최종 confidence ──────────────────────────
    const weights = {
      theme:         parseFloat(settings.themeWeight?.toString() ?? '20'),
      news:          parseFloat(settings.newsWeight?.toString() ?? '15'),
      financials:    parseFloat(settings.financialsWeight?.toString() ?? '25'),
      liquidity:     parseFloat(settings.liquidityWeight?.toString() ?? '20'),
      institutional: parseFloat(settings.institutionalWeight?.toString() ?? '20'),
    };
    const totalWeight = weights.theme + weights.news + weights.financials + weights.liquidity + weights.institutional;
    const denominator = totalWeight > 0 ? totalWeight : 100;
    const confidence = Math.min(100, Math.max(0, (
      stockAnalysis.themeScore   * weights.theme +
      integrated.newsScore       * weights.news +
      integrated.financialScore  * weights.financials +
      liquidityScore             * weights.liquidity +
      institutionalScore         * weights.institutional
    ) / denominator));

    // ── DART 위험공시 감지 ────────────────────────────────────────────────
    const dartDangerFiling = dartFilings.find(f =>
      DART_DANGER_KEYWORDS.some(kw => f.reportNm.includes(kw))
    );
    const dartDangerKeyword = dartDangerFiling?.reportNm ?? null;

    const hasGoodFinancials = integrated.financialScore >= 60;
    const hasHighLiquidity  = liquidityScore >= 40;

    return {
      confidence,
      hasGoodFinancials,
      hasHighLiquidity,
      dartDangerKeyword,
      themeScore:        stockAnalysis.themeScore,
      newsScore:         integrated.newsScore,
      financialsScore:   integrated.financialScore,
      liquidityScore,
      institutionalScore,
    };
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
    aiAnalysis: AiAnalysisResult | null,
    kiwoomService: KiwoomService
  ): Promise<void> {
    console.log(`    💰 BUY SIGNAL: ${stock.name} at ${rainbow.currentLine}% line`);
    try {
      const accounts = await storage.getKiwoomAccounts(model.userId);
      const config = (model.config as any) || {};
      const targetAccountId = config.accountId;
      if (!targetAccountId) { console.log(`    ⛔ accountId 미설정 — 매수 중단`); return; }
      const activeAccount = accounts.find((a: any) => a.id === targetAccountId);
      if (!activeAccount) { console.log(`    ⚠️  No active account found - skipping`); return; }

      const holdings = await storage.getHoldings(activeAccount.id);
      const targetCode = this.normalizeStockCode(stock.code);
      const alreadyHolding = holdings.find(h => this.normalizeStockCode(h.stockCode) === targetCode);
      if (alreadyHolding) {
        console.log(`    ⏭️  ${stock.code} 이미 보유 중 (${alreadyHolding.quantity}주) — 신규 매수 건너뜀`);
        return;
      }
      const maxPositions = config.maxPositions != null ? parseInt(String(config.maxPositions)) : null;
      if (maxPositions && maxPositions > 0 && holdings.length >= maxPositions) {
        console.log(`    ⚠️  최대 보유 종목 초과 (${holdings.length}/${maxPositions}) - 매수 건너뜀`);
        return;
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

      let quantity: number;
      const hasLineUnits = Object.keys(this.getLineUnitMap(settings, config)).length > 0;
      if (!aiAnalysis || hasLineUnits) {
        // 유닛 기반 수량: lineUnits 설정이 있으면 항상 유닛 우선
        const unitSize = this.getConfiguredUnitSize(settings, config);
        const unitCount = this.getUnitCountForLine(rainbow.currentLine, settings, config);
        quantity = Math.floor((unitSize * unitCount) / stock.price);
        quantity = this.clampQuantityByCapital(quantity, stock.price, settings, unitSize, 0);
        console.log(`    📐 유닛 매수: unitSize=${unitSize}, unitCount=${unitCount}, qty=${quantity}`);
      } else {
        // lineUnits 미설정 시 weight 기반 수량 (레인보우 신호 강도 비례)
        const baseSize = parseFloat(settings.defaultPositionSize.toString());
        const positionSize = Math.min(baseSize * (rainbow.weight / 100), parseFloat(settings.maxPositionSize.toString()));
        quantity = Math.floor(positionSize / stock.price);
        const fallbackUnit = this.getConfiguredUnitSize(settings, config);
        quantity = this.clampQuantityByCapital(quantity, stock.price, settings, fallbackUnit, 0);
      }
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
        entryAiConfidence: aiAnalysis ? aiAnalysis.confidence.toFixed(2) : '0',
        entryConditions: { rainbow, ...(aiAnalysis ? { aiAnalysis } : {}) },
        themeScore: aiAnalysis ? aiAnalysis.themeScore.toFixed(2) : '0',
        newsScore: aiAnalysis ? aiAnalysis.newsScore.toFixed(2) : '0',
        financialsScore: aiAnalysis ? aiAnalysis.financialsScore.toFixed(2) : '0',
        liquidityScore: aiAnalysis ? aiAnalysis.liquidityScore.toFixed(2) : '0',
        institutionalScore: aiAnalysis ? aiAnalysis.institutionalScore.toFixed(2) : '0',
      });

      console.log(`    ✅ BUY order placed: ${quantity} shares @ ${stock.price}`);
      storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'BUY', message: `[매수] ${stock.name} ${quantity}주 @ ${stock.price.toLocaleString()}원`, payload: { stockCode: stock.code, stockName: stock.name, price: stock.price, quantity, rainbowLine: rainbow.currentLine, confidence: aiAnalysis?.confidence ?? 0, themeScore: aiAnalysis?.themeScore ?? 0, newsScore: aiAnalysis?.newsScore ?? 0, financialsScore: aiAnalysis?.financialsScore ?? 0, liquidityScore: aiAnalysis?.liquidityScore ?? 0, institutionalScore: aiAnalysis?.institutionalScore ?? 0 } }).catch(e => console.error('[Notification]', e));
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
    if (!targetAccountId) { console.log(`    ⛔ accountId 미설정 — 매도 중단`); return; }
    const activeAccount = accounts.find((a: any) => a.id === targetAccountId);
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

      const holdingAvgPrice = parseFloat(holding.averagePrice?.toString() || '0');
      let profitLoss = holdingAvgPrice > 0 ? (stock.price - holdingAvgPrice) * sellQuantity : 0;
      let profitLossRate = holdingAvgPrice > 0 ? ((stock.price / holdingAvgPrice) - 1) * 100 : 0;
      const perfEntry = await storage.getTradingPerformanceByStock(model.id, stock.code);
      if (perfEntry) {
        profitLoss = (stock.price - parseFloat(perfEntry.entryPrice.toString())) * sellQuantity;
        profitLossRate = ((stock.price / parseFloat(perfEntry.entryPrice.toString())) - 1) * 100;
        await storage.updateTradingPerformance(perfEntry.id, {
          exitPrice: stock.price.toFixed(2),
          exitRainbowLine: rainbow.currentLine,
          exitReason: 'target',
          profitLoss: profitLoss.toFixed(2),
          profitLossRate: profitLossRate.toFixed(4),
          isWin: profitLoss > 0,
        });
      }
      console.log(`    ✅ SELL order placed: ${sellQuantity} shares @ ${stock.price} (P/L: ${profitLoss.toFixed(0)})`);
      storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SELL', message: `[매도] ${stock.name} ${sellQuantity}주 @ ${stock.price.toLocaleString()}원 (${profitLoss > 0 ? '+' : ''}${profitLoss.toFixed(0)}원)`, payload: { stockCode: stock.code, stockName: stock.name, price: stock.price, quantity: sellQuantity, profitLoss, profitLossRate, sellReason: 'target', exitRainbowLine: rainbow.currentLine } }).catch(e => console.error('[Notification]', e));
    } catch (error) {
      console.error(`    ❌ Error executing sell:`, error);
    }
  }

  async evaluateCandidateStock(
    model: AiModel,
    settings: AutoTradingSettings,
    candidate: CandidateStock,
    kiwoomService: KiwoomService,
    aiService: AIService
  ): Promise<void> {
    const decidedAt = new Date();
    const dailyKey = this.todayKST();
    const cooldown = this.getDecisionCooldownWindow(settings, decidedAt);

    // Cooldown guard: skip re-evaluating the same stock too frequently.
    const recentDecision = await storage.getLatestCandidateDecision(
      model.id,
      candidate.stockCode,
      cooldown.since,
    );
    if (recentDecision) {
      if (candidate.id) {
        await storage.updateCandidateEvaluation(candidate.id, {
          evaluationResult: {
            accepted: false,
            skipReason: 'decision_cooldown_active',
            decidedAt: decidedAt.toISOString(),
            dailyKey,
            cooldownMode: cooldown.mode,
            cooldownWindowLabel: cooldown.label,
            cooldownSince: cooldown.since.toISOString(),
            lastDecisionAt: recentDecision.decidedAt?.toISOString?.() ?? recentDecision.decidedAt ?? null,
            lastDecisionAccepted: recentDecision.accepted,
            lastRejectReason: recentDecision.rejectReason ?? null,
          },
          skipReason: 'decision_cooldown_active',
          evaluatedAt: decidedAt,
        });
      }
      return;
    }

    const modelConfig = (model.config as any) || {};
    const modelSnapshot = {
      id: model.id,
      modelName: model.modelName,
      modelType: model.modelType,
      aiModelId: modelConfig.aiModelId ?? 'gpt-5.1',
      accountId: modelConfig.accountId ?? null,
      config: modelConfig,
    };
    const settingsSnapshot = {
      minAiConfidence: settings.minAiConfidence,
      requireGoodFinancials: settings.requireGoodFinancials,
      requireHighLiquidity: settings.requireHighLiquidity,
      requireMarketIssue: settings.requireMarketIssue,
      aiEntryPolicy: settings.aiEntryPolicy ?? null,
      maxDailyTrades: settings.maxDailyTrades,
      defaultPositionSize: settings.defaultPositionSize,
      rainbowLineSettings: settings.rainbowLineSettings,
    };

    const persistCandidateEvaluation = async (
      accepted: boolean,
      skipReason: string | null,
      details: Record<string, unknown>,
    ) => {
      if (!candidate.id) return;
      await storage.updateCandidateEvaluation(candidate.id, {
        evaluationResult: {
          accepted,
          skipReason,
          decidedAt: decidedAt.toISOString(),
          dailyKey,
          modelSnapshot,
          settingsSnapshot,
          ...details,
        },
        skipReason,
        evaluatedAt: decidedAt,
      });
    };

    const logDecision = async (params: {
      accepted: boolean;
      rejectReason: string | null;
      decisionType: string;
      qualitativeReason: string;
      quantitativeReason?: Record<string, unknown>;
      marketAnalysis?: AiAnalysisResult;
      currentLine?: number;
      unitCount?: number;
    }) => {
      await storage.createCandidateDecisionLog({
        modelId: model.id,
        stockCode: candidate.stockCode,
        stockName: candidate.stockName || candidate.stockCode,
        scorecard: params.marketAnalysis
          ? this.buildCandidateScorecard(params.marketAnalysis)
          : null,
        aiDecision: {
          accepted: params.accepted,
          decisionType: params.decisionType,
          qualitativeReason: params.qualitativeReason,
          quantitativeReason: params.quantitativeReason ?? null,
          dailyKey,
          decidedAt: decidedAt.toISOString(),
          modelSnapshot,
          settingsSnapshot,
          currentLine: params.currentLine ?? null,
          unitCount: params.unitCount ?? null,
          marketAnalysis: params.marketAnalysis ?? null,
          candidateContext: {
            candidateId: candidate.id,
            source: candidate.source,
            scannedLine: candidate.scannedLine,
          },
        },
        ladderPlan: null,
        accepted: params.accepted,
        rejectReason: params.rejectReason ?? null,
        strategyVersion: 'v2',
      });

      await persistCandidateEvaluation(params.accepted, params.rejectReason, {
        decisionType: params.decisionType,
        qualitativeReason: params.qualitativeReason,
        quantitativeReason: params.quantitativeReason ?? null,
      });
    };

    try {
      const priceData = await kiwoomService.getStockPrice(candidate.stockCode);
      const price = parseFloat(priceData.output?.stck_prpr ?? '0');
      if (!price) {
        await logDecision({
          accepted: false,
          rejectReason: 'price_unavailable',
          decisionType: 'precheck_price_unavailable',
          qualitativeReason: '현재가를 확보하지 못해 평가를 중단했습니다.',
        });
        return;
      }
      const stock = { code: candidate.stockCode, name: candidate.stockName, price };

      const config = modelConfig;
      if (!config.accountId) {
        await logDecision({
          accepted: false,
          rejectReason: 'account_not_configured',
          decisionType: 'precheck_account_not_configured',
          qualitativeReason: '모델에 연결된 계좌가 없어 평가를 중단했습니다.',
        });
        return;
      }
      const accounts = await storage.getKiwoomAccounts(model.userId);
      const activeAccount = accounts.find((a: any) => a.id === config.accountId);
      if (!activeAccount) {
        await logDecision({
          accepted: false,
          rejectReason: 'account_not_found',
          decisionType: 'precheck_account_not_found',
          qualitativeReason: '설정된 계좌를 찾을 수 없어 평가를 중단했습니다.',
        });
        return;
      }

      // ── 시장 이슈 종목 필터 ──────────────────────────────────────────────
      if (settings.requireMarketIssue) {
        const today = this.todayKST();
        const issues = await storage.getMarketIssuesByStock(stock.code);
        const hasTodayIssue = issues.some(i => i.issueDate === today);
        if (!hasTodayIssue) {
          console.log(`    ⚠️  시장 이슈 관련 종목 아님 (${stock.code}, ${today}) - 스킵`);
          storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${candidate.stockName} — 시장이슈 미등록`, payload: { stockCode: candidate.stockCode, stockName: candidate.stockName, skipReason: '시장이슈 미등록' } }).catch(e => console.error('[Notification]', e));
          await logDecision({
            accepted: false,
            rejectReason: 'market_issue_required',
            decisionType: 'filter_market_issue',
            qualitativeReason: '당일 장 이슈 종목 조건을 충족하지 못했습니다.',
            quantitativeReason: { issueDate: today, issueCount: issues.length },
          });
          return;
        }
        console.log(`    ✅ 시장 이슈 확인됨: ${stock.code}`);
      }

      // ── GPT + 가중치 기반 종합 분석 ──────────────────────────────────────
      const marketAnalysis = await this.comprehensiveAiAnalysis(stock, settings, kiwoomService, aiService);
      console.log(`    📊 AI분석 신뢰도: ${marketAnalysis.confidence.toFixed(1)}% (테마:${marketAnalysis.themeScore} 뉴스:${marketAnalysis.newsScore} 재무:${marketAnalysis.financialsScore} 유동성:${marketAnalysis.liquidityScore})`);

      // ── 최소 신뢰도 필터 ─────────────────────────────────────────────────
      const minConf = parseFloat(settings.minAiConfidence?.toString() ?? '0');
      if (minConf > 0 && marketAnalysis.confidence < minConf) {
        const confidenceBreakdown = this.buildConfidenceBreakdown(settings, marketAnalysis);
        console.log(`    ⚠️  종합 점수 ${marketAnalysis.confidence.toFixed(1)}% < 최솟값 ${minConf}% - 스킵`);
        storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${candidate.stockName} — AI신뢰도 미달 (${marketAnalysis.confidence.toFixed(1)}% < ${minConf}%)`, payload: { stockCode: candidate.stockCode, stockName: candidate.stockName, skipReason: 'minAiConf미달', confidence: marketAnalysis.confidence, themeScore: marketAnalysis.themeScore, newsScore: marketAnalysis.newsScore, financialsScore: marketAnalysis.financialsScore, liquidityScore: marketAnalysis.liquidityScore, institutionalScore: marketAnalysis.institutionalScore, confidenceBreakdown } }).catch(e => console.error('[Notification]', e));
        await logDecision({
          accepted: false,
          rejectReason: 'min_ai_confidence_not_met',
          decisionType: 'filter_min_ai_confidence',
          qualitativeReason: 'AI 종합 점수가 최소 신뢰도 기준을 충족하지 못했습니다.',
          quantitativeReason: { confidence: marketAnalysis.confidence, minConfidence: minConf },
          marketAnalysis,
        });
        return;
      }

      const allowSpeculativeLeaderTrades = settings.allowSpeculativeLeaderTrades === true;
      const speculativeMinConfidence = Math.max(minConf + 10, 85);
      const canUseSpeculativeOverride =
        allowSpeculativeLeaderTrades && marketAnalysis.confidence >= speculativeMinConfidence;

      // ── 재무건전성 필터 ──────────────────────────────────────────────────
      if (settings.requireGoodFinancials && !marketAnalysis.hasGoodFinancials) {
        if (canUseSpeculativeOverride) {
          console.log(`    ⚠️  재무건전성 미충족이지만 '세력/급등주 투자 허용' + 고신뢰(${marketAnalysis.confidence.toFixed(1)}%)로 진입 평가 계속`);
        } else {
        console.log(`    ⚠️  재무건전성 미충족 (financialsScore=${marketAnalysis.financialsScore} < 60) - 스킵`);
        storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${candidate.stockName} — 재무건전성 미충족 (${marketAnalysis.financialsScore})`, payload: { stockCode: candidate.stockCode, stockName: candidate.stockName, skipReason: '재무필터', financialsScore: marketAnalysis.financialsScore } }).catch(e => console.error('[Notification]', e));
        await logDecision({
          accepted: false,
          rejectReason: 'financials_not_met',
          decisionType: 'filter_financials',
          qualitativeReason: '재무건전성 조건을 충족하지 못했습니다.',
          quantitativeReason: { financialsScore: marketAnalysis.financialsScore, threshold: 60 },
          marketAnalysis,
        });
        return;
        }
      }
      // ── 유동성 필터 ─────────────────────────────────────────────────────
      if (settings.requireHighLiquidity && !marketAnalysis.hasHighLiquidity) {
        if (canUseSpeculativeOverride) {
          console.log(`    ⚠️  유동성 미충족이지만 '세력/급등주 투자 허용' + 고신뢰(${marketAnalysis.confidence.toFixed(1)}%)로 진입 평가 계속`);
        } else {
        console.log(`    ⚠️  유동성 미충족 (liquidityScore=${marketAnalysis.liquidityScore} < 40) - 스킵`);
        storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'SKIP', message: `[스킵] ${candidate.stockName} — 유동성 미충족 (${marketAnalysis.liquidityScore})`, payload: { stockCode: candidate.stockCode, stockName: candidate.stockName, skipReason: '유동성필터', liquidityScore: marketAnalysis.liquidityScore } }).catch(e => console.error('[Notification]', e));
        await logDecision({
          accepted: false,
          rejectReason: 'liquidity_not_met',
          decisionType: 'filter_liquidity',
          qualitativeReason: '유동성 조건을 충족하지 못했습니다.',
          quantitativeReason: { liquidityScore: marketAnalysis.liquidityScore, threshold: 40 },
          marketAnalysis,
        });
        return;
        }
      }
      // ── DART 위험공시 — 설정 무관하게 무조건 차단 ────────────────────────
      if (marketAnalysis.dartDangerKeyword) {
        console.log(`    🚫 DART 위험공시 감지 [${marketAnalysis.dartDangerKeyword}] - 매수 차단`);
        storage.createEngineNotification({ userId: model.userId, severity: 'warn', type: 'SKIP', message: `[차단] ${candidate.stockName} — DART 위험공시 [${marketAnalysis.dartDangerKeyword}]`, payload: { stockCode: candidate.stockCode, stockName: candidate.stockName, skipReason: 'DART위험', dartDangerKeyword: marketAnalysis.dartDangerKeyword } }).catch(e => console.error('[Notification]', e));
        await logDecision({
          accepted: false,
          rejectReason: 'dart_danger_disclosure',
          decisionType: 'filter_dart_danger',
          qualitativeReason: 'DART 위험 공시가 감지되어 매수를 차단했습니다.',
          quantitativeReason: { dartDangerKeyword: marketAnalysis.dartDangerKeyword },
          marketAnalysis,
        });
        return;
      }

      const holdings = await storage.getHoldings(activeAccount.id);
      const targetCode = this.normalizeStockCode(stock.code);
      const existingHolding = holdings.find(h => this.normalizeStockCode(h.stockCode) === targetCode);

      const rainbowEval = await this.evaluate10LineRainbow(stock, settings, kiwoomService);
      const { currentLine } = rainbowEval;
      console.log(`    🌈 ${stock.name}(${stock.code}): currentLine=${currentLine}`);

      if (!existingHolding) {
        const unitCount = this.getUnitCountForLine(currentLine, settings, config);
        if (unitCount > 0 && currentLine <= 50) {
          await logDecision({
            accepted: true,
            rejectReason: null,
            decisionType: 'entry_selected',
            qualitativeReason: '진입 조건을 충족해 매수 대상으로 선정되었습니다.',
            quantitativeReason: { currentLine, unitCount, confidence: marketAnalysis.confidence },
            marketAnalysis,
            currentLine,
            unitCount,
          });
          await this.executeBuy(model, settings, stock, rainbowEval, marketAnalysis, kiwoomService);
        } else {
          await logDecision({
            accepted: false,
            rejectReason: 'line_or_unit_not_met',
            decisionType: 'filter_entry_line_or_unit',
            qualitativeReason: '진입 라인/유닛 조건을 충족하지 못했습니다.',
            quantitativeReason: { currentLine, unitCount },
            marketAnalysis,
            currentLine,
            unitCount,
          });
        }
      } else {
        const perfEntry = await storage.getTradingPerformanceByStock(model.id, stock.code);
        const entryLine = perfEntry?.entryRainbowLine ?? candidate.scannedLine ?? 50;
        if (entryLine <= 10) {
          console.log(`    ⏭️  ${stock.code} entryLine=${entryLine} — 최하위 라인, 추가매수 불가`);
          await logDecision({
            accepted: false,
            rejectReason: 'already_holding_lowest_line',
            decisionType: 'holding_no_additional_buy',
            qualitativeReason: '이미 보유 중이며 최하위 라인이라 추가매수 대상이 아닙니다.',
            quantitativeReason: { entryLine, currentLine },
            marketAnalysis,
            currentLine,
          });
        } else {
          const nextLowerLine = entryLine - 10;
          if (currentLine <= nextLowerLine && currentLine >= 10) {
            await logDecision({
              accepted: true,
              rejectReason: null,
              decisionType: 'holding_additional_buy',
              qualitativeReason: '보유 종목 추가매수 조건을 충족했습니다.',
              quantitativeReason: { entryLine, nextLowerLine, currentLine },
              marketAnalysis,
              currentLine,
            });
            await this.executeAdditionalBuy(model, settings, stock, existingHolding, rainbowEval, kiwoomService);
          } else {
            await logDecision({
              accepted: false,
              rejectReason: 'already_holding_waiting_line',
              decisionType: 'holding_waiting_for_next_line',
              qualitativeReason: '보유 종목이며 다음 하단 라인 도달 전이라 추가매수를 보류합니다.',
              quantitativeReason: { entryLine, nextLowerLine, currentLine },
              marketAnalysis,
              currentLine,
            });
          }
        }
      }
    } catch (err) {
      console.error(`    ❌ evaluateCandidateStock ${candidate.stockCode}:`, err);
      await logDecision({
        accepted: false,
        rejectReason: 'evaluation_exception',
        decisionType: 'evaluation_exception',
        qualitativeReason: '평가 중 예외가 발생했습니다.',
        quantitativeReason: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  async manageOpenPositions(
    model: AiModel,
    settings: AutoTradingSettings,
    _activeAccount: any,
    kiwoomService: KiwoomService,
    aiService: AIService
  ): Promise<void> {
    // Keep a single exit-management path for now.
    await this.checkPositionsForExits(model, settings, kiwoomService, aiService);
  }

  private buildCandidateScorecard(analysis: AiAnalysisResult): Record<string, number> {
    return {
      themeScore: analysis.themeScore,
      newsScore: analysis.newsScore,
      financialsScore: analysis.financialsScore,
      liquidityScore: analysis.liquidityScore,
      institutionalScore: analysis.institutionalScore,
      totalScore: analysis.confidence,
    };
  }

  private parsePositiveNumber(value: unknown, fallback: number): number {
    const parsed = Number.parseFloat(String(value ?? ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private getConfiguredUnitSize(settings: AutoTradingSettings, config: any): number {
    const fallbackUnit = this.parsePositiveNumber(settings.defaultPositionSize, 1_000_000);
    const baseUnitSize = this.parsePositiveNumber(settings.baseUnitSize, 0);
    const legacyUnitSize = this.parsePositiveNumber(config?.unitSize, 0);
    return baseUnitSize > 0 ? baseUnitSize : legacyUnitSize > 0 ? legacyUnitSize : fallbackUnit;
  }

  private getLineUnitMap(settings: AutoTradingSettings, config: any): Record<number, number> {
    const map: Record<number, number> = {};
    const ladder = settings.entryLadderSettings as Array<{ line?: number; units?: number }> | null | undefined;
    if (Array.isArray(ladder)) {
      for (const step of ladder) {
        const line = Number.parseInt(String(step?.line ?? ""), 10);
        const units = Number.parseInt(String(step?.units ?? ""), 10);
        if (!Number.isFinite(line) || !Number.isFinite(units)) continue;
        map[line] = Math.max(0, Math.min(5, units));
      }
    }

    if (Object.keys(map).length > 0) return map;

    const legacyMap = (config?.lineUnits ?? {}) as Record<number, number>;
    for (const [lineRaw, unitsRaw] of Object.entries(legacyMap)) {
      const line = Number.parseInt(String(lineRaw), 10);
      const units = Number.parseInt(String(unitsRaw), 10);
      if (!Number.isFinite(line) || !Number.isFinite(units)) continue;
      map[line] = Math.max(0, Math.min(5, units));
    }
    return map;
  }

  private getUnitCountForLine(currentLine: number, settings: AutoTradingSettings, config: any): number {
    const lineUnits = this.getLineUnitMap(settings, config);
    if (Object.keys(lineUnits).length === 0) return 1;
    return lineUnits[currentLine] ?? 0;
  }

  private clampQuantityByCapital(
    quantity: number,
    price: number,
    settings: AutoTradingSettings,
    unitSize: number,
    existingHoldingCapital: number = 0
  ): number {
    let capped = quantity;

    const maxUnits = Number.parseInt(String(settings.maxUnitsPerStock ?? ""), 10);
    if (Number.isFinite(maxUnits) && maxUnits > 0) {
      const maxCapitalByUnits = unitSize * maxUnits;
      const remainingByUnits = Math.max(0, maxCapitalByUnits - existingHoldingCapital);
      capped = Math.min(capped, Math.floor(remainingByUnits / price));
    }

    const hardMaxCapital = this.parsePositiveNumber(settings.hardMaxCapitalPerStock, 0);
    if (hardMaxCapital > 0) {
      const remainingByHardCap = Math.max(0, hardMaxCapital - existingHoldingCapital);
      capped = Math.min(capped, Math.floor(remainingByHardCap / price));
    }

    return Math.max(0, capped);
  }

  async executeAdditionalBuy(
    model: AiModel,
    settings: AutoTradingSettings,
    stock: { code: string; name: string; price: number },
    holding: any,
    rainbow: RainbowEval,
    kiwoomService: KiwoomService
  ): Promise<void> {
    console.log(`    ➕ 추가매수 검토: ${stock.name}(${stock.code}) @ ${rainbow.currentLine}% 라인`);
    try {
      const config = (model.config as any) || {};
      if (!config.accountId) return;
      const accounts = await storage.getKiwoomAccounts(model.userId);
      const activeAccount = accounts.find((a: any) => a.id === config.accountId);
      if (!activeAccount) return;

      const maxDailyTrades = parseInt(settings.maxDailyTrades?.toString() || '0');
      if (maxDailyTrades > 0) {
        const todayCount = await this.countTodayAutoTrades(activeAccount.id);
        if (todayCount >= maxDailyTrades) {
          console.log(`    ⚠️  일일 최대 거래 횟수 초과 — 추가매수 건너뜀`);
          return;
        }
      }

      const unitSize = this.getConfiguredUnitSize(settings, config);
      const baseUnitCount = this.getUnitCountForLine(rainbow.currentLine, settings, config);
      const allowAiDoubleDown = settings.allowAiDoubleDown === true;
      const adjustedUnitCount =
        allowAiDoubleDown && rainbow.currentLine <= 30
          ? Math.min(baseUnitCount + 1, 2)
          : baseUnitCount;
      const currentCapital = (holding.quantity || 0) * stock.price;
      let quantity = Math.floor((unitSize * adjustedUnitCount) / stock.price);
      quantity = this.clampQuantityByCapital(quantity, stock.price, settings, unitSize, currentCapital);
      if (quantity === 0) {
        console.log(`    ⚠️  추가매수 수량 0 — 건너뜀`);
        return;
      }
      if (adjustedUnitCount !== baseUnitCount) {
        console.log(`    🤖 AI 추가매수 허용 적용: baseUnit=${baseUnitCount} → adjustedUnit=${adjustedUnitCount}`);
      }

      await storage.createOrder({
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

      const perfEntry = await storage.getTradingPerformanceByStock(model.id, stock.code);
      if (perfEntry) {
        await storage.updateTradingPerformance(perfEntry.id, {
          entryRainbowLine: rainbow.currentLine,
          quantity: (perfEntry.quantity || 0) + quantity,
        });
      }

      console.log(`    ✅ 추가매수 완료: ${stock.name} ${quantity}주 @ ${stock.price}원 (${rainbow.currentLine}% 라인, ${adjustedUnitCount}유닛)`);
      storage.createEngineNotification({ userId: model.userId, severity: 'info', type: 'BUY', message: `[추가매수] ${stock.name} ${quantity}주 @ ${stock.price.toLocaleString()}원 (${rainbow.currentLine}% 라인, ${adjustedUnitCount}유닛)`, payload: { stockCode: stock.code, stockName: stock.name, price: stock.price, quantity, rainbowLine: rainbow.currentLine, unitCount: adjustedUnitCount } }).catch(e => console.error('[Notification]', e));
    } catch (err) {
      console.error(`    ❌ 추가매수 실패 ${stock.code}:`, err);
    }
  }

  async createDefaultSettings(modelId: number, _modelType?: string): Promise<void> {
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
