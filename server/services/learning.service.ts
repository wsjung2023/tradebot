// learning.service.ts — AI 자동매매 성과 분석 및 모델 파라미터 자동 최적화 학습 서비스
import { storage } from '../storage';
import { TradingPerformance, AiModel, AutoTradingSettings } from '@shared/schema';
import { getAIService } from './ai.service';

export interface LearningStats {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  avgProfitRate: number;
  avgLossRate: number;
  avgHoldingDays: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface LinePerformance {
  line: number;
  total: number;
  winRate: number;
  avgReturn: number;
  expectancy: number; // avgWin*winRate - avgLoss*(1-winRate)
  profitFactor: number; // sum(wins) / sum(losses)
}

export interface UnitPerformance {
  units: number;
  total: number;
  winRate: number;
  avgReturn: number;
}

export interface LineEfficiencyPerformance {
  line: number;
  total: number;
  avgHoldingDays: number;
  avgReturn: number;
  avgSpeedReturn: number;
  avgCapitalEfficiency: number;
  fastWinRate: number;
  capitalTrapRate: number;
}

export interface TimeCapitalEfficiencyInsights {
  analyzedTrades: number;
  closedTrades: number;
  openTrades: number;
  fastWins: number;
  highVelocityWins: number;
  slowWins: number;
  megaTrendWins: number;
  deepScaleRecoveries: number;
  capitalTraps: number;
  fastWinRate: number;
  capitalTrapRate: number;
  avgHoldingDays: number;
  avgUnitsUsed: number;
  avgSpeedReturn: number;
  avgCapitalEfficiency: number;
  bestFastEntryLines: Array<{ line: number; score: number; fastWinRate: number; avgHoldingDays: number; avgReturn: number; total: number }>;
  dangerEntryLines: Array<{ line: number; score: number; capitalTrapRate: number; avgHoldingDays: number; avgReturn: number; total: number }>;
  lineEfficiency: LineEfficiencyPerformance[];
  episodes: Array<{
    stockCode: string;
    stockName: string;
    category: string;
    returnPct: number;
    holdingDays: number;
    unitsUsed: number;
    capitalDays: number;
    speedReturn: number;
    capitalEfficiency: number;
    qualityScore: number;
    entryLine: number;
    exitLine: number | null;
    isOpen: boolean;
  }>;
}

export interface PatternInsights {
  bestEntryLines: { line: number; winRate: number; avgReturn: number }[];
  bestExitLines: { line: number; winRate: number; avgReturn: number }[];
  linePerformance: LinePerformance[];
  unitPerformance: UnitPerformance[];
  timeCapitalEfficiency: TimeCapitalEfficiencyInsights;
  suggestedLadderPlan: { line: number; units: number }[];
  suggestedStopLossMode: string;
  optimalWeights: {
    theme: number;
    news: number;
    financials: number;
    liquidity: number;
    institutional: number;
  };
  optimalThresholds: {
    minAiConfidence: number;
    requireGoodFinancials: boolean;
    requireHighLiquidity: boolean;
  };
}

export interface OptimizationResult {
  modelId: number;
  stats: LearningStats;
  patterns: PatternInsights;
  recommendations: string[];
  appliedChanges: boolean;
}

export class LearningService {
  /**
   * Analyze trading performance and calculate comprehensive statistics
   */
  async analyzePerformance(modelId: number): Promise<LearningStats> {
    const performances = await storage.getTradingPerformance(modelId);
    
    if (performances.length === 0) {
      return {
        totalTrades: 0,
        winTrades: 0,
        lossTrades: 0,
        winRate: 0,
        avgProfitRate: 0,
        avgLossRate: 0,
        avgHoldingDays: 0,
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
      };
    }

    const completedTrades = performances.filter((p: TradingPerformance) => p.exitPrice !== null);
    const winTrades = completedTrades.filter((p: TradingPerformance) => p.isWin === true);
    const lossTrades = completedTrades.filter((p: TradingPerformance) => p.isWin === false);

    // Win rate
    const winRate = completedTrades.length > 0 
      ? (winTrades.length / completedTrades.length) * 100 
      : 0;

    // Average profit/loss rates (stored as %, convert to decimal)
    const avgProfitRate = winTrades.length > 0
      ? winTrades.reduce((sum: number, t: TradingPerformance) => sum + parseFloat(t.profitLossRate?.toString() || '0'), 0) / winTrades.length
      : 0;

    const avgLossRate = lossTrades.length > 0
      ? lossTrades.reduce((sum: number, t: TradingPerformance) => sum + Math.abs(parseFloat(t.profitLossRate?.toString() || '0')), 0) / lossTrades.length
      : 0;

    // Average holding days
    const tradesWithDays = completedTrades.filter((t: TradingPerformance) => t.holdingDays !== null);
    const avgHoldingDays = tradesWithDays.length > 0
      ? tradesWithDays.reduce((sum: number, t: TradingPerformance) => sum + (t.holdingDays || 0), 0) / tradesWithDays.length
      : 0;

    // Total return (sum of all profit/loss rates in %)
    const totalReturn = completedTrades.reduce((sum: number, t: TradingPerformance) => 
      sum + parseFloat(t.profitLossRate?.toString() || '0'), 0
    );

    // Sharpe ratio (returns / volatility) - using sample std dev
    const returns = completedTrades.map((t: TradingPerformance) => parseFloat(t.profitLossRate?.toString() || '0'));
    const avgReturn = returns.length > 0 ? returns.reduce((a: number, b: number) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 1
      ? returns.reduce((sum: number, r: number) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1) 
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    // Max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(completedTrades);

    return {
      totalTrades: completedTrades.length,
      winTrades: winTrades.length,
      lossTrades: lossTrades.length,
      winRate,
      avgProfitRate,
      avgLossRate,
      avgHoldingDays,
      totalReturn,
      sharpeRatio,
      maxDrawdown,
    };
  }

  /**
   * Find successful patterns in trading data
   */
  async findPatterns(modelId: number, userId?: string): Promise<PatternInsights> {
    const performances = await storage.getTradingPerformance(modelId);
    const completedTrades = performances.filter((p: TradingPerformance) => p.exitPrice !== null);
    const journalEpisodes = userId ? await this.buildJournalPerformanceEpisodes(userId, modelId) : [];
    const timeCapitalEfficiency = this.analyzeTimeCapitalEfficiency(
      journalEpisodes.length > 0 ? journalEpisodes : performances,
    );

    if (completedTrades.length < 10) {
      // Not enough data to find patterns
      return {
        ...this.getDefaultPatterns(),
        timeCapitalEfficiency,
      };
    }

    // Analyze best entry lines (rainbow chart)
    const entryLineStats = new Map<number, { wins: number; total: number; returns: number[] }>();
    
    for (const trade of completedTrades) {
      const line = trade.entryRainbowLine || 50;
      if (!entryLineStats.has(line)) {
        entryLineStats.set(line, { wins: 0, total: 0, returns: [] });
      }
      const stats = entryLineStats.get(line)!;
      stats.total++;
      if (trade.isWin) stats.wins++;
      stats.returns.push(parseFloat(trade.profitLossRate?.toString() || '0'));
    }

    const bestEntryLines = Array.from(entryLineStats.entries())
      .map(([line, stats]) => ({
        line,
        winRate: (stats.wins / stats.total) * 100,
        avgReturn: stats.returns.reduce((a, b) => a + b, 0) / stats.returns.length,
      }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 5);

    // Analyze best exit lines
    const exitLineStats = new Map<number, { wins: number; total: number; returns: number[] }>();
    
    for (const trade of completedTrades) {
      const line = trade.exitRainbowLine || 70;
      if (!exitLineStats.has(line)) {
        exitLineStats.set(line, { wins: 0, total: 0, returns: [] });
      }
      const stats = exitLineStats.get(line)!;
      stats.total++;
      if (trade.isWin) stats.wins++;
      stats.returns.push(parseFloat(trade.profitLossRate?.toString() || '0'));
    }

    const bestExitLines = Array.from(exitLineStats.entries())
      .map(([line, stats]) => ({
        line,
        winRate: (stats.wins / stats.total) * 100,
        avgReturn: stats.returns.reduce((a, b) => a + b, 0) / stats.returns.length,
      }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 5);

    // Optimize weights based on correlation with success
    const optimalWeights = this.optimizeWeights(completedTrades);
    const optimalThresholds = this.optimizeThresholds(completedTrades);
    const linePerformance = this.analyzeLinePerformance(completedTrades);
    const unitPerformance = this.analyzeUnitPerformance(completedTrades);
    const suggestedLadderPlan = this.suggestLadderPlan(linePerformance);
    const suggestedStopLossMode = this.suggestStopLossMode(completedTrades);

    return {
      bestEntryLines,
      bestExitLines,
      linePerformance,
      unitPerformance,
      timeCapitalEfficiency,
      suggestedLadderPlan,
      suggestedStopLossMode,
      optimalWeights,
      optimalThresholds,
    };
  }

  private analyzeLinePerformance(trades: TradingPerformance[]): LinePerformance[] {
    const lineStats = new Map<number, { wins: number; total: number; winReturns: number[]; lossReturns: number[] }>();

    for (const trade of trades) {
      const line = trade.entryRainbowLine || 50;
      if (!lineStats.has(line)) {
        lineStats.set(line, { wins: 0, total: 0, winReturns: [], lossReturns: [] });
      }
      const s = lineStats.get(line)!;
      s.total++;
      const ret = parseFloat(trade.profitLossRate?.toString() || '0');
      if (trade.isWin) { s.wins++; s.winReturns.push(ret); }
      else { s.lossReturns.push(ret); }
    }

    return Array.from(lineStats.entries()).map(([line, s]) => {
      const winRate = s.total > 0 ? s.wins / s.total : 0;
      const avgWin = s.winReturns.length > 0 ? s.winReturns.reduce((a, b) => a + b, 0) / s.winReturns.length : 0;
      const avgLoss = s.lossReturns.length > 0 ? Math.abs(s.lossReturns.reduce((a, b) => a + b, 0) / s.lossReturns.length) : 0;
      const avgReturn = (s.winReturns.concat(s.lossReturns)).reduce((a, b) => a + b, 0) / (s.winReturns.length + s.lossReturns.length || 1);
      const expectancy = avgWin * winRate - avgLoss * (1 - winRate);
      const sumWins = s.winReturns.reduce((a, b) => a + b, 0);
      const sumLossAbs = s.lossReturns.reduce((a, b) => a + Math.abs(b), 0);
      const profitFactor = sumLossAbs > 0 ? sumWins / sumLossAbs : sumWins > 0 ? 999 : 0;
      return { line, total: s.total, winRate: winRate * 100, avgReturn, expectancy, profitFactor };
    }).sort((a, b) => a.line - b.line);
  }

  private analyzeUnitPerformance(trades: TradingPerformance[]): UnitPerformance[] {
    const unitStats = new Map<number, { wins: number; total: number; returns: number[] }>();

    for (const trade of trades) {
      const units = trade.filledUnits ?? 1;
      if (!unitStats.has(units)) unitStats.set(units, { wins: 0, total: 0, returns: [] });
      const s = unitStats.get(units)!;
      s.total++;
      if (trade.isWin) s.wins++;
      s.returns.push(parseFloat(trade.profitLossRate?.toString() || '0'));
    }

    return Array.from(unitStats.entries()).map(([units, s]) => ({
      units,
      total: s.total,
      winRate: s.total > 0 ? (s.wins / s.total) * 100 : 0,
      avgReturn: s.returns.reduce((a, b) => a + b, 0) / (s.returns.length || 1),
    })).sort((a, b) => a.units - b.units);
  }

  private safeNumber(value: unknown, fallback = 0): number {
    const n = Number.parseFloat(String(value ?? ""));
    return Number.isFinite(n) ? n : fallback;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private round(value: number, digits = 2): number {
    const factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
  }

  private getTradeHoldingDays(trade: TradingPerformance, isOpen: boolean): number {
    const entryTime = trade.entryTime ? new Date(trade.entryTime).getTime() : 0;
    const exitTime = trade.exitTime ? new Date(trade.exitTime).getTime() : 0;
    const endTime = isOpen ? Date.now() : exitTime;
    if (entryTime > 0 && endTime > 0 && endTime >= entryTime) {
      return Math.max(0, (endTime - entryTime) / (24 * 60 * 60 * 1000));
    }
    if (trade.holdingDays != null) return Math.max(0, Number(trade.holdingDays) || 0);
    return 0;
  }

  private getUnitsUsed(trade: TradingPerformance): number {
    const filledSteps = Array.isArray(trade.filledEntrySteps)
      ? (trade.filledEntrySteps as unknown[]).filter((v) => Number.isFinite(Number(v))).length
      : 0;
    const candidates = [
      Number(trade.maxUnitsReached ?? 0),
      Number(trade.filledUnits ?? 0),
      filledSteps,
    ].filter((v) => Number.isFinite(v) && v > 0);
    return Math.max(1, Math.round(candidates[0] ?? 1));
  }

  private parseJournalDateTime(entry: any): Date {
    const date = String(entry.tradeDate || "").replace(/\D/g, "");
    const time = String(entry.tradeTime || "00:00:00");
    if (date.length === 8) {
      const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time}+09:00`;
      const parsed = new Date(iso);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return entry.createdAt ? new Date(entry.createdAt) : new Date();
  }

  private async buildJournalPerformanceEpisodes(userId: string, modelId: number): Promise<TradingPerformance[]> {
    const entries = await storage.getTradeJournalEntries(userId, {
      accountStatus: "all",
      activeOnly: false,
      limit: 5000,
    } as any);
    if (!entries.length) return [];

    const sorted = [...entries].sort((a: any, b: any) =>
      this.parseJournalDateTime(a).getTime() - this.parseJournalDateTime(b).getTime()
    );

    type OpenEpisode = {
      accountId: number;
      stockCode: string;
      stockName: string;
      entryTime: Date;
      totalQuantity: number;
      remainingQuantity: number;
      totalCost: number;
      buyCount: number;
      lines: number[];
      firstLine: number | null;
    };

    const openByKey = new Map<string, OpenEpisode>();
    const episodes: TradingPerformance[] = [];

    for (const entry of sorted as any[]) {
      const tradeType = String(entry.tradeType || "");
      const stockCode = String(entry.stockCode || "");
      if (!stockCode) continue;
      const accountId = Number(entry.accountId ?? 0);
      const key = `${accountId}:${stockCode}`;
      const quantity = Math.max(0, Number(entry.quantity || 0));
      const price = this.safeNumber(entry.price, 0);
      const line = entry.rainbowLine == null ? null : Number(entry.rainbowLine);
      const occurredAt = this.parseJournalDateTime(entry);

      if ((tradeType === "buy" || tradeType === "additional_buy") && quantity > 0 && price > 0) {
        let episode = openByKey.get(key);
        if (!episode) {
          episode = {
            accountId,
            stockCode,
            stockName: entry.stockName || stockCode,
            entryTime: occurredAt,
            totalQuantity: 0,
            remainingQuantity: 0,
            totalCost: 0,
            buyCount: 0,
            lines: [],
            firstLine: line,
          };
          openByKey.set(key, episode);
        }
        episode.totalQuantity += quantity;
        episode.remainingQuantity += quantity;
        episode.totalCost += price * quantity;
        episode.buyCount += 1;
        if (line != null && Number.isFinite(line)) episode.lines.push(line);
        if (episode.firstLine == null && line != null && Number.isFinite(line)) episode.firstLine = line;
        continue;
      }

      if ((tradeType === "sell" || tradeType === "exit_sell") && quantity > 0 && price > 0) {
        const episode = openByKey.get(key);
        if (!episode) continue;
        episode.remainingQuantity = Math.max(0, episode.remainingQuantity - quantity);
        const shouldClose = episode.remainingQuantity <= 0 || tradeType === "exit_sell";
        if (!shouldClose) continue;

        const avgEntryPrice = episode.totalQuantity > 0 ? episode.totalCost / episode.totalQuantity : price;
        const journalProfitRate = this.safeNumber(entry.profitRate, NaN);
        const returnPct = Number.isFinite(journalProfitRate)
          ? journalProfitRate
          : avgEntryPrice > 0
            ? ((price - avgEntryPrice) / avgEntryPrice) * 100
            : 0;
        const holdingDays = Math.max(0, (occurredAt.getTime() - episode.entryTime.getTime()) / (24 * 60 * 60 * 1000));
        const uniqueLines = Array.from(new Set<number>(episode.lines.filter((v): v is number => Number.isFinite(v))));

        episodes.push({
          id: -episodes.length - 1,
          modelId,
          orderId: null,
          stockCode: episode.stockCode,
          stockName: episode.stockName,
          entryPrice: avgEntryPrice.toFixed(2) as any,
          exitPrice: price.toFixed(2) as any,
          quantity: episode.totalQuantity,
          profitLoss: entry.profitLoss ?? null,
          profitLossRate: returnPct.toFixed(4) as any,
          holdingDays: Math.round(holdingDays),
          isWin: returnPct > 0,
          entryRainbowLine: episode.firstLine ?? uniqueLines[0] ?? 50,
          entryAiConfidence: null,
          entryConditions: null,
          exitReason: entry.exitReason ?? null,
          exitRainbowLine: line ?? null,
          exitConditions: null,
          themeScore: null,
          newsScore: null,
          financialsScore: null,
          liquidityScore: null,
          institutionalScore: null,
          strategyVersion: "journal-episode-v1",
          entryDecisionSnapshot: null,
          entryScorecard: null,
          entryLadderPlan: null,
          filledEntrySteps: uniqueLines as any,
          filledUnits: Math.max(1, episode.buyCount),
          maxUnitsReached: Math.max(1, episode.buyCount),
          avgEntryLine: uniqueLines.length > 0 ? Math.round(uniqueLines.reduce((a, b) => a + b, 0) / uniqueLines.length) : null,
          holdDecisionSnapshots: null,
          exitDecisionSnapshot: null,
          scaleOutHistory: null,
          plannedExitPolicy: null,
          entryTime: episode.entryTime,
          exitTime: occurredAt,
          createdAt: episode.entryTime,
        } as TradingPerformance);
        openByKey.delete(key);
      }
    }

    for (const episode of Array.from(openByKey.values())) {
      const uniqueLines = Array.from(new Set<number>(episode.lines.filter((v): v is number => Number.isFinite(v))));
      const avgEntryPrice = episode.totalQuantity > 0 ? episode.totalCost / episode.totalQuantity : 0;
      episodes.push({
        id: -episodes.length - 1,
        modelId,
        orderId: null,
        stockCode: episode.stockCode,
        stockName: episode.stockName,
        entryPrice: avgEntryPrice.toFixed(2) as any,
        exitPrice: null,
        quantity: episode.totalQuantity,
        profitLoss: null,
        profitLossRate: "0" as any,
        holdingDays: Math.round(Math.max(0, (Date.now() - episode.entryTime.getTime()) / (24 * 60 * 60 * 1000))),
        isWin: null,
        entryRainbowLine: episode.firstLine ?? uniqueLines[0] ?? 50,
        entryAiConfidence: null,
        entryConditions: null,
        exitReason: null,
        exitRainbowLine: null,
        exitConditions: null,
        themeScore: null,
        newsScore: null,
        financialsScore: null,
        liquidityScore: null,
        institutionalScore: null,
        strategyVersion: "journal-episode-v1",
        entryDecisionSnapshot: null,
        entryScorecard: null,
        entryLadderPlan: null,
        filledEntrySteps: uniqueLines as any,
        filledUnits: Math.max(1, episode.buyCount),
        maxUnitsReached: Math.max(1, episode.buyCount),
        avgEntryLine: uniqueLines.length > 0 ? Math.round(uniqueLines.reduce((a, b) => a + b, 0) / uniqueLines.length) : null,
        holdDecisionSnapshots: null,
        exitDecisionSnapshot: null,
        scaleOutHistory: null,
        plannedExitPolicy: null,
        entryTime: episode.entryTime,
        exitTime: null,
        createdAt: episode.entryTime,
      } as TradingPerformance);
    }

    return episodes;
  }

  private classifyEfficiencyEpisode(params: {
    isOpen: boolean;
    isWin: boolean;
    returnPct: number;
    holdingDays: number;
    unitsUsed: number;
  }): string {
    const { isOpen, isWin, returnPct, holdingDays, unitsUsed } = params;
    if (isOpen && (holdingDays >= 30 || unitsUsed >= 4)) return "CAPITAL_TRAP_OPEN";
    if (isOpen) return "OPEN_MONITOR";
    if (returnPct >= 100) return "MEGA_TREND_WIN";
    if (returnPct >= 20 && holdingDays <= 20) return "HIGH_VELOCITY_WIN";
    if (isWin && holdingDays <= 3) return "FAST_WIN";
    if (isWin && unitsUsed >= 4) return "DEEP_SCALE_RECOVERY";
    if (isWin && holdingDays >= 30) return "SLOW_WIN";
    if (!isWin && holdingDays >= 20) return "FAILED_HOLD";
    if (!isWin) return "LOSS";
    return "NORMAL_WIN";
  }

  private calculateTradeQualityScore(params: {
    returnPct: number;
    holdingDays: number;
    unitsUsed: number;
    speedReturn: number;
    capitalEfficiency: number;
    isOpen: boolean;
  }): number {
    const { returnPct, holdingDays, unitsUsed, speedReturn, capitalEfficiency, isOpen } = params;
    const absoluteReturnScore = this.clamp(returnPct * 1.8, -80, 220);
    const speedScore = Math.sign(speedReturn) * Math.log1p(Math.abs(speedReturn)) * 18;
    const capitalScore = Math.sign(capitalEfficiency) * Math.log1p(Math.abs(capitalEfficiency)) * 18;
    const megaTrendBonus = returnPct >= 100 ? this.clamp(Math.sqrt(returnPct) * 4, 25, 90) : 0;
    const longHoldPenalty = returnPct >= 100
      ? Math.max(0, holdingDays - 120) * 0.04
      : Math.max(0, holdingDays - 20) * 0.35;
    const scalePenalty = Math.max(0, unitsUsed - 2) * (returnPct >= 50 ? 2 : 6);
    const openPenalty = isOpen ? Math.min(60, holdingDays * 0.4 + Math.max(0, unitsUsed - 2) * 8) : 0;
    return this.round(absoluteReturnScore + speedScore + capitalScore + megaTrendBonus - longHoldPenalty - scalePenalty - openPenalty, 2);
  }

  private analyzeTimeCapitalEfficiency(trades: TradingPerformance[]): TimeCapitalEfficiencyInsights {
    if (trades.length === 0) return this.getDefaultTimeCapitalEfficiency();

    const episodes = trades.map((trade) => {
      const isOpen = trade.exitPrice === null;
      const holdingDaysRaw = this.getTradeHoldingDays(trade, isOpen);
      const holdingDaysForMath = Math.max(holdingDaysRaw, 0.25);
      const unitsUsed = this.getUnitsUsed(trade);
      const returnPct = this.safeNumber(trade.profitLossRate, 0);
      const capitalDays = unitsUsed * holdingDaysForMath;
      const speedReturn = returnPct / holdingDaysForMath;
      const capitalEfficiency = returnPct / Math.max(capitalDays, 0.25);
      const entryLine = Number(trade.entryRainbowLine ?? trade.avgEntryLine ?? 50) || 50;
      const exitLine = trade.exitRainbowLine == null ? null : Number(trade.exitRainbowLine);
      const isWin = trade.isWin === true || returnPct > 0;
      const category = this.classifyEfficiencyEpisode({
        isOpen,
        isWin,
        returnPct,
        holdingDays: holdingDaysRaw,
        unitsUsed,
      });

      return {
        stockCode: trade.stockCode,
        stockName: trade.stockName,
        category,
        returnPct: this.round(returnPct, 4),
        holdingDays: this.round(holdingDaysRaw, 2),
        unitsUsed,
        capitalDays: this.round(capitalDays, 2),
        speedReturn: this.round(speedReturn, 4),
        capitalEfficiency: this.round(capitalEfficiency, 4),
        qualityScore: this.calculateTradeQualityScore({
          returnPct,
          holdingDays: holdingDaysRaw,
          unitsUsed,
          speedReturn,
          capitalEfficiency,
          isOpen,
        }),
        entryLine,
        exitLine,
        isOpen,
      };
    });

    const closedEpisodes = episodes.filter((e) => !e.isOpen);
    const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const countBy = (category: string) => episodes.filter((e) => e.category === category).length;
    const fastWins = episodes.filter((e) => e.category === "FAST_WIN" || e.category === "HIGH_VELOCITY_WIN").length;
    const highVelocityWins = countBy("HIGH_VELOCITY_WIN");
    const slowWins = countBy("SLOW_WIN");
    const megaTrendWins = countBy("MEGA_TREND_WIN");
    const deepScaleRecoveries = countBy("DEEP_SCALE_RECOVERY");
    const capitalTraps = episodes.filter((e) => e.category === "CAPITAL_TRAP_OPEN" || e.category === "FAILED_HOLD").length;

    const lineGroups = new Map<number, typeof episodes>();
    for (const episode of episodes) {
      const line = episode.entryLine || 50;
      if (!lineGroups.has(line)) lineGroups.set(line, []);
      lineGroups.get(line)!.push(episode);
    }

    const lineEfficiency = Array.from(lineGroups.entries()).map(([line, group]) => {
      const lineFastWins = group.filter((e) => e.category === "FAST_WIN" || e.category === "HIGH_VELOCITY_WIN").length;
      const lineTraps = group.filter((e) => e.category === "CAPITAL_TRAP_OPEN" || e.category === "FAILED_HOLD").length;
      return {
        line,
        total: group.length,
        avgHoldingDays: this.round(avg(group.map((e) => e.holdingDays)), 2),
        avgReturn: this.round(avg(group.map((e) => e.returnPct)), 4),
        avgSpeedReturn: this.round(avg(group.map((e) => e.speedReturn)), 4),
        avgCapitalEfficiency: this.round(avg(group.map((e) => e.capitalEfficiency)), 4),
        fastWinRate: this.round((lineFastWins / group.length) * 100, 2),
        capitalTrapRate: this.round((lineTraps / group.length) * 100, 2),
      };
    }).sort((a, b) => a.line - b.line);

    const bestFastEntryLines = lineEfficiency
      .filter((line) => line.total >= 2)
      .map((line) => ({
        line: line.line,
        score: this.round(line.avgSpeedReturn + line.avgCapitalEfficiency + line.fastWinRate / 10 - line.capitalTrapRate / 10, 4),
        fastWinRate: line.fastWinRate,
        avgHoldingDays: line.avgHoldingDays,
        avgReturn: line.avgReturn,
        total: line.total,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const dangerEntryLines = lineEfficiency
      .filter((line) => line.total >= 2)
      .map((line) => ({
        line: line.line,
        score: this.round(line.capitalTrapRate + Math.max(0, line.avgHoldingDays - 20) - Math.max(0, line.avgReturn), 4),
        capitalTrapRate: line.capitalTrapRate,
        avgHoldingDays: line.avgHoldingDays,
        avgReturn: line.avgReturn,
        total: line.total,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      analyzedTrades: episodes.length,
      closedTrades: closedEpisodes.length,
      openTrades: episodes.length - closedEpisodes.length,
      fastWins,
      highVelocityWins,
      slowWins,
      megaTrendWins,
      deepScaleRecoveries,
      capitalTraps,
      fastWinRate: episodes.length ? this.round((fastWins / episodes.length) * 100, 2) : 0,
      capitalTrapRate: episodes.length ? this.round((capitalTraps / episodes.length) * 100, 2) : 0,
      avgHoldingDays: this.round(avg(episodes.map((e) => e.holdingDays)), 2),
      avgUnitsUsed: this.round(avg(episodes.map((e) => e.unitsUsed)), 2),
      avgSpeedReturn: this.round(avg(closedEpisodes.map((e) => e.speedReturn)), 4),
      avgCapitalEfficiency: this.round(avg(closedEpisodes.map((e) => e.capitalEfficiency)), 4),
      bestFastEntryLines,
      dangerEntryLines,
      lineEfficiency,
      episodes: episodes
        .sort((a, b) => b.qualityScore - a.qualityScore)
        .slice(0, 30),
    };
  }

  private suggestLadderPlan(linePerf: LinePerformance[]): { line: number; units: number }[] {
    const LADDER_LINES = [50, 40, 30, 20, 10];
    return LADDER_LINES.map(line => {
      const perf = linePerf.find(p => p.line === line);
      if (!perf || perf.total < 5) return { line, units: 1 };
      // Good expectancy at this line → keep 1 unit; negative expectancy → 0 units (skip)
      return { line, units: perf.expectancy > 0 ? 1 : 0 };
    });
  }

  private suggestStopLossMode(trades: TradingPerformance[]): string {
    if (trades.length < 10) return 'soft_ai_first';
    const lossTrades = trades.filter(t => !t.isWin);
    if (lossTrades.length === 0) return 'disabled';
    const avgLoss = lossTrades.reduce((sum, t) => sum + parseFloat(t.profitLossRate?.toString() || '0'), 0) / lossTrades.length;
    // Deep average losses → recommend hard stop
    if (avgLoss < -10) return 'conditional';
    if (avgLoss < -15) return 'hard';
    return 'soft_ai_first';
  }

  /**
   * Optimize AI weights using Information Value: measure win vs loss score gap per indicator.
   * A larger gap means the indicator is more predictive of success.
   */
  private optimizeWeights(trades: TradingPerformance[]): {
    theme: number;
    news: number;
    financials: number;
    liquidity: number;
    institutional: number;
  } {
    const winTrades = trades.filter(t => t.isWin === true);
    const lossTrades = trades.filter(t => t.isWin === false);

    if (winTrades.length < 5 || lossTrades.length < 3) {
      return { theme: 20, news: 15, financials: 25, liquidity: 20, institutional: 20 };
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const getScores = (group: TradingPerformance[], field: string) =>
      group.map(t => parseFloat((t as any)[field]?.toString() || '50'));

    // Information value: how much higher are scores in wins vs losses
    const indicators = ['themeScore', 'newsScore', 'financialsScore', 'liquidityScore', 'institutionalScore'] as const;
    const gaps = indicators.map(field => {
      const winScores = getScores(winTrades, field);
      const lossScores = getScores(lossTrades, field);
      const gap = avg(winScores) - avg(lossScores);
      return Math.max(0.1, gap); // floor at 0.1 so zero-gap indicators still get some weight
    });

    const totalGap = gaps.reduce((a, b) => a + b, 0);
    const weights = gaps.map(g => (g / totalGap) * 100);

    // Clamp: no single weight > 40, no weight < 5
    const clamped = weights.map(w => Math.min(40, Math.max(5, w)));
    const clampedTotal = clamped.reduce((a, b) => a + b, 0);
    const normalized = clamped.map(w => (w / clampedTotal) * 100);

    return {
      theme: Math.round(normalized[0] * 10) / 10,
      news: Math.round(normalized[1] * 10) / 10,
      financials: Math.round(normalized[2] * 10) / 10,
      liquidity: Math.round(normalized[3] * 10) / 10,
      institutional: Math.round(normalized[4] * 10) / 10,
    };
  }

  /**
   * Optimize thresholds by finding the confidence threshold that maximizes expected value.
   */
  private optimizeThresholds(trades: TradingPerformance[]): {
    minAiConfidence: number;
    requireGoodFinancials: boolean;
    requireHighLiquidity: boolean;
  } {
    if (trades.length < 10) {
      return { minAiConfidence: 60, requireGoodFinancials: true, requireHighLiquidity: true };
    }

    // Find threshold that maximizes: winRate * avgProfit - lossRate * avgLoss (expected value)
    let bestThreshold = 55;
    let bestEV = -Infinity;

    for (let threshold = 40; threshold <= 85; threshold += 5) {
      const filtered = trades.filter(t => parseFloat(t.entryAiConfidence?.toString() || '0') >= threshold);
      if (filtered.length < 5) continue;
      const wins = filtered.filter(t => t.isWin);
      const losses = filtered.filter(t => !t.isWin);
      const winRate = wins.length / filtered.length;
      const avgProfit = wins.length > 0 ? wins.reduce((s, t) => s + parseFloat(t.profitLossRate?.toString() || '0'), 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + parseFloat(t.profitLossRate?.toString() || '0'), 0) / losses.length) : 0;
      const ev = winRate * avgProfit - (1 - winRate) * avgLoss;
      if (ev > bestEV) { bestEV = ev; bestThreshold = threshold; }
    }

    // Check if financials/liquidity filters improve EV
    const baseEV = bestEV;
    const withFinancials = trades.filter(t => {
      const cond = t.entryConditions as any;
      return cond?.aiAnalysis?.hasGoodFinancials === true || cond?.hasGoodFinancials === true;
    });
    const requireGoodFinancials = withFinancials.length >= 5 && (() => {
      const wins = withFinancials.filter(t => t.isWin);
      const losses = withFinancials.filter(t => !t.isWin);
      const wr = wins.length / withFinancials.length;
      const ap = wins.length > 0 ? wins.reduce((s, t) => s + parseFloat(t.profitLossRate?.toString() || '0'), 0) / wins.length : 0;
      const al = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + parseFloat(t.profitLossRate?.toString() || '0'), 0) / losses.length) : 0;
      return wr * ap - (1 - wr) * al > baseEV * 0.8;
    })();

    const withLiquidity = trades.filter(t => {
      const cond = t.entryConditions as any;
      return cond?.aiAnalysis?.hasHighLiquidity === true || cond?.hasHighLiquidity === true;
    });
    const requireHighLiquidity = withLiquidity.length >= 5 && (() => {
      const wins = withLiquidity.filter(t => t.isWin);
      const losses = withLiquidity.filter(t => !t.isWin);
      const wr = wins.length / withLiquidity.length;
      const ap = wins.length > 0 ? wins.reduce((s, t) => s + parseFloat(t.profitLossRate?.toString() || '0'), 0) / wins.length : 0;
      const al = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + parseFloat(t.profitLossRate?.toString() || '0'), 0) / losses.length) : 0;
      return wr * ap - (1 - wr) * al > baseEV * 0.8;
    })();

    return { minAiConfidence: bestThreshold, requireGoodFinancials, requireHighLiquidity };
  }

  /**
   * 신뢰도 캘리브레이션: confidence 구간별 실제 승률 vs 예측 승률 비교
   * 결과로 confidence가 과대/과소 평가되는지 진단
   */
  async analyzeConfidenceCalibration(modelId: number): Promise<{
    buckets: Array<{ range: string; predicted: number; actual: number; count: number; gap: number }>;
    overallBias: 'overconfident' | 'underconfident' | 'calibrated';
    recommendation: string;
  }> {
    const performances = await storage.getTradingPerformance(modelId);
    const completed = performances.filter(p => p.exitPrice !== null && p.entryAiConfidence !== null);

    const buckets = [
      { min: 40, max: 55, label: '40-55%' },
      { min: 55, max: 65, label: '55-65%' },
      { min: 65, max: 75, label: '65-75%' },
      { min: 75, max: 100, label: '75%+' },
    ];

    const result = buckets.map(b => {
      const group = completed.filter(t => {
        const conf = parseFloat(t.entryAiConfidence?.toString() || '0');
        return conf >= b.min && conf < b.max;
      });
      const wins = group.filter(t => t.isWin).length;
      const actualWinRate = group.length > 0 ? (wins / group.length) * 100 : 0;
      const midConf = (b.min + b.max) / 2;
      return {
        range: b.label,
        predicted: midConf,
        actual: Math.round(actualWinRate * 10) / 10,
        count: group.length,
        gap: Math.round((actualWinRate - midConf) * 10) / 10,
      };
    });

    const validBuckets = result.filter(b => b.count >= 3);
    const avgGap = validBuckets.length > 0
      ? validBuckets.reduce((s, b) => s + b.gap, 0) / validBuckets.length
      : 0;

    const overallBias = avgGap > 5 ? 'underconfident' : avgGap < -5 ? 'overconfident' : 'calibrated';
    const recommendation =
      overallBias === 'overconfident'
        ? `AI 신뢰도가 실제 승률보다 평균 ${Math.abs(avgGap).toFixed(1)}%p 높습니다. minAiConfidence 기준을 ${Math.round(Math.abs(avgGap) / 5) * 5}%p 높이는 것을 검토하세요.`
        : overallBias === 'underconfident'
        ? `AI 신뢰도가 실제 승률보다 평균 ${avgGap.toFixed(1)}%p 낮습니다. minAiConfidence 기준을 낮춰 더 많은 종목을 검토할 수 있습니다.`
        : '신뢰도 캘리브레이션이 양호합니다.';

    return { buckets: result, overallBias, recommendation };
  }

  /**
   * 거부 이유별 분석: 어떤 필터가 가장 많이 차단하는지 파악
   */
  async analyzeRejectionPatterns(modelId: number, userId: string): Promise<{
    byReason: Array<{ reason: string; count: number; pct: number }>;
    totalEvaluated: number;
    totalAccepted: number;
    acceptRate: number;
    insight: string;
  }> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30일
    const logs = await storage.getCandidateDecisionLogsForUser(userId, {
      modelId,
      from: cutoff,
      limit: 1000,
    });

    const total = logs.length;
    const accepted = logs.filter(l => l.accepted).length;
    const rejected = logs.filter(l => !l.accepted);

    const byReason = new Map<string, number>();
    for (const log of rejected) {
      const reason = log.rejectReason || 'unknown';
      byReason.set(reason, (byReason.get(reason) || 0) + 1);
    }

    const sorted = Array.from(byReason.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({
        reason,
        count,
        pct: Math.round((count / total) * 1000) / 10,
      }));

    const topReason = sorted[0];
    const insight = total === 0
      ? '데이터 없음'
      : topReason?.reason === 'min_ai_confidence_not_met'
      ? `AI 신뢰도 미달이 전체의 ${topReason.pct}%를 차단. minAiConfidence 기준이 너무 높을 수 있습니다.`
      : topReason?.reason === 'decision_cooldown_active'
      ? `쿨다운이 ${topReason.pct}%를 차단 — 정상입니다.`
      : topReason
      ? `'${topReason.reason}' 필터가 가장 많이 차단 (${topReason.pct}%). 설정 검토 권장.`
      : '특이사항 없음';

    return {
      byReason: sorted,
      totalEvaluated: total,
      totalAccepted: accepted,
      acceptRate: total > 0 ? Math.round((accepted / total) * 1000) / 10 : 0,
      insight,
    };
  }

  /**
   * Apply optimized parameters to AI model
   */
  // 학습 정책 기본값 (learningPolicy가 없을 때 사용)
  static readonly DEFAULT_LEARNING_POLICY = {
    minTradesForAnalysis: 20,   // 분석 시작 최소 거래 수
    minTradesForAutoApply: 50,  // 파라미터 자동 적용 최소 거래 수
    autoApplyMinWinRate: 45,    // 자동 적용 최소 승률 (%)
    autoApplyMinReturn: 0,      // 자동 적용 최소 총 수익률 (%)
    autoApplyMaxDrawdown: 30,   // 자동 적용 최대 낙폭 (%)
  };

  async optimizeModel(modelId: number, autoApply: boolean = false, userId?: string, learningPolicy?: Record<string, any>): Promise<OptimizationResult> {
    // 정책 값: 설정값 우선, 없으면 기본값
    const policy = {
      ...LearningService.DEFAULT_LEARNING_POLICY,
      ...(learningPolicy ?? {}),
    };
    const minTradesForAnalysis = Number(policy.minTradesForAnalysis) || LearningService.DEFAULT_LEARNING_POLICY.minTradesForAnalysis;
    const minTradesForAutoApply = Number(policy.minTradesForAutoApply) || LearningService.DEFAULT_LEARNING_POLICY.minTradesForAutoApply;
    const autoApplyMinWinRate = Number(policy.autoApplyMinWinRate) ?? LearningService.DEFAULT_LEARNING_POLICY.autoApplyMinWinRate;
    const autoApplyMinReturn = Number(policy.autoApplyMinReturn) ?? LearningService.DEFAULT_LEARNING_POLICY.autoApplyMinReturn;
    const autoApplyMaxDrawdown = Number(policy.autoApplyMaxDrawdown) || LearningService.DEFAULT_LEARNING_POLICY.autoApplyMaxDrawdown;

    const [stats, patterns] = await Promise.all([
      this.analyzePerformance(modelId),
      this.findPatterns(modelId, userId),
    ]);

    const recommendations: string[] = [];

    // 신뢰도 캘리브레이션 + 거부 패턴 분석 (데이터 있으면 항상 수행)
    const [calibration, rejectionAnalysis] = await Promise.all([
      this.analyzeConfidenceCalibration(modelId),
      userId ? this.analyzeRejectionPatterns(modelId, userId) : Promise.resolve(null),
    ]);

    if (calibration.overallBias !== 'calibrated') {
      recommendations.push(`📊 신뢰도 캘리브레이션: ${calibration.recommendation}`);
    }
    if (rejectionAnalysis && rejectionAnalysis.totalEvaluated > 0) {
      recommendations.push(`🔍 거부 분석 (최근 30일): 수락률 ${rejectionAnalysis.acceptRate}% — ${rejectionAnalysis.insight}`);
    }

    const efficiency = patterns.timeCapitalEfficiency;
    if (efficiency.analyzedTrades > 0) {
      recommendations.push(
        `⏱️ 시간·자본 효율: 빠른수익 ${efficiency.fastWinRate.toFixed(1)}%, 자본묶임 ${efficiency.capitalTrapRate.toFixed(1)}%, 평균보유 ${efficiency.avgHoldingDays.toFixed(1)}일`,
      );
      const bestFastLine = efficiency.bestFastEntryLines[0];
      if (bestFastLine) {
        recommendations.push(
          `⚡ 빠른 수익 우수 라인: ${bestFastLine.line}% (빠른수익률 ${bestFastLine.fastWinRate.toFixed(1)}%, 평균 ${bestFastLine.avgHoldingDays.toFixed(1)}일)`,
        );
      }
      const dangerLine = efficiency.dangerEntryLines[0];
      if (dangerLine && dangerLine.capitalTrapRate >= 30) {
        recommendations.push(
          `🪨 자본 묶임 주의 라인: ${dangerLine.line}% (묶임률 ${dangerLine.capitalTrapRate.toFixed(1)}%, 평균 ${dangerLine.avgHoldingDays.toFixed(1)}일)`,
        );
      }
    }

    // Only optimize if we have enough data
    if (stats.totalTrades < minTradesForAnalysis) {
      recommendations.push(`데이터 부족: ${stats.totalTrades}건 (최소 ${minTradesForAnalysis}건 필요)`);

      await storage.createLearningRecord({
        modelId,
        periodStart: null,
        periodEnd: new Date(),
        totalTrades: stats.totalTrades,
        winRate: stats.winRate.toFixed(2),
        avgReturn: stats.totalReturn.toFixed(4),
        patternInsights: { ...patterns, calibration, rejectionAnalysis } as any,
        appliedChanges: { autoApply, applied: false, reason: 'INSUFFICIENT_DATA', recommendations } as any,
      });

      return {
        modelId,
        stats,
        patterns,
        recommendations,
        appliedChanges: false,
      };
    }

    // Generate recommendations
    const profitFactor = stats.avgProfitRate > 0 && stats.avgLossRate > 0
      ? stats.avgProfitRate / stats.avgLossRate
      : 0;

    if (stats.winRate < 50) {
      recommendations.push(`승률 ${stats.winRate.toFixed(1)}% — 진입 기준 강화 필요 (최고 성과 진입 라인: ${patterns.bestEntryLines[0]?.line || 50}%)`);
    } else if (stats.winRate >= 70) {
      recommendations.push(`승률 ${stats.winRate.toFixed(1)}% — 우수. 현재 전략 유지`);
    }

    if (profitFactor > 0 && profitFactor < 1.5) {
      recommendations.push(`손익비 ${profitFactor.toFixed(2)} — 목표가 상향 조정 권장 (최고 탈출 라인: ${patterns.bestExitLines[0]?.line || 70}%)`);
    } else if (profitFactor >= 2.0) {
      recommendations.push(`손익비 ${profitFactor.toFixed(2)} — 우수`);
    }

    if (stats.sharpeRatio < 1.0) {
      recommendations.push(`샤프지수 ${stats.sharpeRatio.toFixed(2)} — 변동성 대비 수익률 개선 필요`);
    }

    // Auto-apply optimizations if enabled with safety checks
    let appliedChanges = false;
    if (autoApply && stats.totalTrades >= minTradesForAutoApply) {
      const shouldApply = (
        stats.winRate >= autoApplyMinWinRate &&
        stats.totalReturn > autoApplyMinReturn &&
        stats.maxDrawdown < autoApplyMaxDrawdown &&
        stats.totalTrades >= minTradesForAutoApply
      );

      if (shouldApply) {
        try {
          const [settings, model] = await Promise.all([
            storage.getAutoTradingSettings(modelId),
            storage.getAiModel(modelId),
          ]);
          if (settings) {
            // Base weight/threshold updates
            const updates: Partial<typeof settings> = {
              themeWeight: patterns.optimalWeights.theme.toFixed(2),
              newsWeight: patterns.optimalWeights.news.toFixed(2),
              financialsWeight: patterns.optimalWeights.financials.toFixed(2),
              liquidityWeight: patterns.optimalWeights.liquidity.toFixed(2),
              institutionalWeight: patterns.optimalWeights.institutional.toFixed(2),
              minAiConfidence: patterns.optimalThresholds.minAiConfidence.toFixed(2),
              requireGoodFinancials: patterns.optimalThresholds.requireGoodFinancials,
              requireHighLiquidity: patterns.optimalThresholds.requireHighLiquidity,
            };

            // Ladder plan update: only apply if suggested plan has meaningful data
            const activeLadderLines = patterns.suggestedLadderPlan.filter(s => s.units > 0);
            if (activeLadderLines.length >= 2) {
              updates.entryLadderSettings = patterns.suggestedLadderPlan as any;
              recommendations.push(`📊 라더 계획 업데이트: ${activeLadderLines.map(s => `${s.line}%x${s.units}`).join(', ')}`);
            }

            // Candidate threshold update
            const existingThresholds = (settings.candidateThresholds as any) ?? {};
            updates.candidateThresholds = {
              ...existingThresholds,
              minTotalScore: patterns.optimalThresholds.minAiConfidence,
            } as any;

            // Stop loss policy evolution
            const currentStopPolicy = (settings.stopLossPolicy as any) ?? {};
            if (currentStopPolicy.mode !== 'hard') {
              updates.stopLossPolicy = {
                ...currentStopPolicy,
                mode: patterns.suggestedStopLossMode,
              } as any;
              if (patterns.suggestedStopLossMode !== currentStopPolicy.mode) {
                recommendations.push(`🔄 손절 모드 변경 권장: ${currentStopPolicy.mode ?? 'soft_ai_first'} → ${patterns.suggestedStopLossMode}`);
              }
            }

            // AI strategy evolution suggestions (supplement rule-based changes)
            try {
              const modelType = (model?.config as any)?.modelType ?? 'custom';
              const aiModel = (model?.config as any)?.aiModel ?? 'claude-haiku-4-5-20251001';
              const aiEvolution = await getAIService().suggestStrategyEvolution({
                modelType,
                stats: {
                  totalTrades: stats.totalTrades,
                  winRate: stats.winRate,
                  avgReturn: stats.totalTrades > 0 ? stats.totalReturn / stats.totalTrades : 0,
                  maxDrawdown: stats.maxDrawdown,
                },
                linePerformance: patterns.linePerformance,
                unitPerformance: patterns.unitPerformance,
                currentLadder: (settings.entryLadderSettings as any) ?? patterns.suggestedLadderPlan,
                currentStopLossMode: currentStopPolicy.mode ?? 'soft_ai_first',
              }, aiModel, model?.userId ? {
                userId: model.userId,
                accountId: Number((model.config as any)?.accountId ?? 0) || null,
                source: 'learning:strategy-evolution',
              } : undefined);

              // Override ladder plan if AI provides a better suggestion
              if (aiEvolution.suggestedLadder?.length >= 2) {
                const aiActiveLadder = aiEvolution.suggestedLadder.filter((s: any) => s.units > 0);
                if (aiActiveLadder.length >= 1) {
                  updates.entryLadderSettings = aiEvolution.suggestedLadder as any;
                  recommendations.push(`🤖 AI 라더 제안 적용: ${aiActiveLadder.map((s: any) => `${s.line}%x${s.units}`).join(', ')}`);
                }
              }

              // Override stop loss mode if AI suggests different (but never downgrade hard to softer)
              if (aiEvolution.suggestedStopLossMode && currentStopPolicy.mode !== 'hard') {
                updates.stopLossPolicy = {
                  ...(updates.stopLossPolicy as any ?? currentStopPolicy),
                  mode: aiEvolution.suggestedStopLossMode,
                } as any;
                recommendations.push(`🤖 AI 손절 모드 제안: ${aiEvolution.suggestedStopLossMode}`);
              }

              // Apply AI-suggested max units
              if (aiEvolution.suggestedMaxUnits && aiEvolution.suggestedMaxUnits > 0) {
                (updates as any).maxUnitsPerStock = String(aiEvolution.suggestedMaxUnits);
                recommendations.push(`🤖 AI 최대 유닛 제안: ${aiEvolution.suggestedMaxUnits}`);
              }

              // Merge AI-suggested candidate threshold adjustments
              if (aiEvolution.candidateThresholdAdjust) {
                updates.candidateThresholds = {
                  ...(updates.candidateThresholds as any),
                  ...aiEvolution.candidateThresholdAdjust,
                } as any;
              }

              if (aiEvolution.reasoning) {
                recommendations.push(`🤖 AI 근거: ${aiEvolution.reasoning}`);
              }
            } catch (aiErr) {
              console.error('[LearningService] suggestStrategyEvolution failed:', aiErr);
              recommendations.push('⚠️  AI 전략 제안 실패 (규칙 기반 최적화만 적용)');
            }

            await storage.updateAutoTradingSettings(modelId, updates);

            // Update model stats
            await storage.updateAiModel(modelId, {
              totalTrades: stats.totalTrades,
              winRate: stats.winRate.toFixed(2),
              totalReturn: stats.totalReturn.toFixed(4),
            });

            appliedChanges = true;
            recommendations.push('✅ 최적화 파라미터 자동 적용 완료 (가중치, 임계치, 라더, 손절정책)');
          }
        } catch (error) {
          console.error('Failed to apply optimizations:', error);
          recommendations.push('❌ 최적화 적용 실패');
        }
      } else {
        recommendations.push(`⚠️  자동 적용 조건 미충족 (승률≥45%, 수익>0, 낙폭<30%, 거래≥50건)`);
      }
    } else if (autoApply && stats.totalTrades < 50) {
      recommendations.push(`⚠️  자동 적용 최소 거래 수 미달 (현재 ${stats.totalTrades}건, 필요 50건)`);
    }

    await storage.createLearningRecord({
      modelId,
      periodStart: null,
      periodEnd: new Date(),
      totalTrades: stats.totalTrades,
      winRate: stats.winRate.toFixed(2),
      avgReturn: stats.totalReturn.toFixed(4),
      patternInsights: patterns as any,
      appliedChanges: { autoApply, applied: appliedChanges, recommendations } as any,
    });

    return {
      modelId,
      stats,
      patterns,
      recommendations,
      appliedChanges,
    };
  }

  /**
   * Calculate maximum drawdown from cumulative compounded returns
   */
  private calculateMaxDrawdown(trades: TradingPerformance[]): number {
    if (trades.length === 0) return 0;

    // Sort trades by entry time to ensure chronological order
    const sortedTrades = [...trades].sort((a, b) => {
      const timeA = a.entryTime?.getTime() || 0;
      const timeB = b.entryTime?.getTime() || 0;
      return timeA - timeB;
    });

    let equity = 1.0; // Start with 1.0 (100%)
    let peak = 1.0;
    let maxDrawdown = 0;

    for (const trade of sortedTrades) {
      // Apply compounded return (profit/loss rate is stored as %, convert to decimal)
      const returnPct = parseFloat(trade.profitLossRate?.toString() || '0');
      const returnDecimal = returnPct / 100; // Convert percentage to decimal
      equity = equity * (1 + returnDecimal);
      
      // Update peak
      if (equity > peak) {
        peak = equity;
      }
      
      // Calculate drawdown from peak as percentage
      const drawdown = ((peak - equity) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  private getDefaultPatterns(): PatternInsights {
    return {
      bestEntryLines: [
        { line: 50, winRate: 0, avgReturn: 0 },
        { line: 40, winRate: 0, avgReturn: 0 },
        { line: 30, winRate: 0, avgReturn: 0 },
      ],
      bestExitLines: [
        { line: 70, winRate: 0, avgReturn: 0 },
        { line: 80, winRate: 0, avgReturn: 0 },
        { line: 60, winRate: 0, avgReturn: 0 },
      ],
      linePerformance: [],
      unitPerformance: [],
      timeCapitalEfficiency: this.getDefaultTimeCapitalEfficiency(),
      suggestedLadderPlan: [
        { line: 50, units: 1 }, { line: 40, units: 1 }, { line: 30, units: 1 },
        { line: 20, units: 1 }, { line: 10, units: 1 },
      ],
      suggestedStopLossMode: 'soft_ai_first',
      optimalWeights: {
        theme: 20,
        news: 15,
        financials: 25,
        liquidity: 20,
        institutional: 20,
      },
      optimalThresholds: {
        minAiConfidence: 70,
        requireGoodFinancials: true,
        requireHighLiquidity: true,
      },
    };
  }

  private getDefaultTimeCapitalEfficiency(): TimeCapitalEfficiencyInsights {
    return {
      analyzedTrades: 0,
      closedTrades: 0,
      openTrades: 0,
      fastWins: 0,
      highVelocityWins: 0,
      slowWins: 0,
      megaTrendWins: 0,
      deepScaleRecoveries: 0,
      capitalTraps: 0,
      fastWinRate: 0,
      capitalTrapRate: 0,
      avgHoldingDays: 0,
      avgUnitsUsed: 0,
      avgSpeedReturn: 0,
      avgCapitalEfficiency: 0,
      bestFastEntryLines: [],
      dangerEntryLines: [],
      lineEfficiency: [],
      episodes: [],
    };
  }
}
