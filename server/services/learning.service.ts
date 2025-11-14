import { storage } from '../storage';
import { TradingPerformance, AiModel, AutoTradingSettings } from '@shared/schema';

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

export interface PatternInsights {
  bestEntryLines: { line: number; winRate: number; avgReturn: number }[];
  bestExitLines: { line: number; winRate: number; avgReturn: number }[];
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

    // Average profit/loss rates
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

    // Total return
    const totalReturn = completedTrades.reduce((sum: number, t: TradingPerformance) => 
      sum + parseFloat(t.profitLossRate?.toString() || '0'), 0
    );

    // Sharpe ratio (simplified: returns / volatility)
    const returns = completedTrades.map((t: TradingPerformance) => parseFloat(t.profitLossRate?.toString() || '0'));
    const avgReturn = returns.length > 0 ? returns.reduce((a: number, b: number) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 0 
      ? returns.reduce((sum: number, r: number) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length 
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
  async findPatterns(modelId: number): Promise<PatternInsights> {
    const performances = await storage.getTradingPerformance(modelId);
    const completedTrades = performances.filter((p: TradingPerformance) => p.exitPrice !== null);

    if (completedTrades.length < 10) {
      // Not enough data to find patterns
      return this.getDefaultPatterns();
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

    return {
      bestEntryLines,
      bestExitLines,
      optimalWeights,
      optimalThresholds,
    };
  }

  /**
   * Optimize AI weights based on successful trades
   */
  private optimizeWeights(trades: TradingPerformance[]): {
    theme: number;
    news: number;
    financials: number;
    liquidity: number;
    institutional: number;
  } {
    const winTrades = trades.filter(t => t.isWin === true);

    if (winTrades.length < 5) {
      return { theme: 20, news: 15, financials: 25, liquidity: 20, institutional: 20 };
    }

    // Calculate correlation of each score with success
    const avgScores = {
      theme: winTrades.reduce((sum, t) => sum + parseFloat(t.themeScore?.toString() || '0'), 0) / winTrades.length,
      news: winTrades.reduce((sum, t) => sum + parseFloat(t.newsScore?.toString() || '0'), 0) / winTrades.length,
      financials: winTrades.reduce((sum, t) => sum + parseFloat(t.financialsScore?.toString() || '0'), 0) / winTrades.length,
      liquidity: winTrades.reduce((sum, t) => sum + parseFloat(t.liquidityScore?.toString() || '0'), 0) / winTrades.length,
      institutional: winTrades.reduce((sum, t) => sum + parseFloat(t.institutionalScore?.toString() || '0'), 0) / winTrades.length,
    };

    // Normalize to 100%
    const total = Object.values(avgScores).reduce((a, b) => a + b, 0);
    return {
      theme: (avgScores.theme / total) * 100,
      news: (avgScores.news / total) * 100,
      financials: (avgScores.financials / total) * 100,
      liquidity: (avgScores.liquidity / total) * 100,
      institutional: (avgScores.institutional / total) * 100,
    };
  }

  /**
   * Optimize thresholds based on successful trades
   */
  private optimizeThresholds(trades: TradingPerformance[]): {
    minAiConfidence: number;
    requireGoodFinancials: boolean;
    requireHighLiquidity: boolean;
  } {
    const winTrades = trades.filter(t => t.isWin === true);

    if (winTrades.length < 5) {
      return {
        minAiConfidence: 70,
        requireGoodFinancials: true,
        requireHighLiquidity: true,
      };
    }

    // Find optimal confidence threshold
    const avgWinConfidence = winTrades.reduce((sum, t) => 
      sum + parseFloat(t.entryAiConfidence?.toString() || '70'), 0
    ) / winTrades.length;

    // Check if good financials correlate with wins
    const withGoodFinancials = winTrades.filter(t => {
      const cond = t.entryConditions as any;
      return cond?.hasGoodFinancials === true;
    });
    const requireGoodFinancials = withGoodFinancials.length / winTrades.length > 0.7;

    // Check if high liquidity correlates with wins
    const withHighLiquidity = winTrades.filter(t => {
      const cond = t.entryConditions as any;
      return cond?.hasHighLiquidity === true;
    });
    const requireHighLiquidity = withHighLiquidity.length / winTrades.length > 0.7;

    return {
      minAiConfidence: Math.round(avgWinConfidence),
      requireGoodFinancials,
      requireHighLiquidity,
    };
  }

  /**
   * Apply optimized parameters to AI model
   */
  async optimizeModel(modelId: number, autoApply: boolean = false): Promise<OptimizationResult> {
    const stats = await this.analyzePerformance(modelId);
    const patterns = await this.findPatterns(modelId);

    const recommendations: string[] = [];

    // Only optimize if we have enough data
    if (stats.totalTrades < 20) {
      recommendations.push(`데이터 부족: ${stats.totalTrades}건 (최소 20건 필요)`);
      return {
        modelId,
        stats,
        patterns,
        recommendations,
        appliedChanges: false,
      };
    }

    // Generate recommendations
    if (stats.winRate < 50) {
      recommendations.push(`승률 ${stats.winRate.toFixed(1)}% - 진입 기준 강화 필요`);
      recommendations.push(`최고 성과 진입 라인: ${patterns.bestEntryLines[0]?.line || 50}%`);
    } else if (stats.winRate >= 70) {
      recommendations.push(`승률 ${stats.winRate.toFixed(1)}% - 우수! 현재 전략 유지`);
    }

    if (stats.avgProfitRate < stats.avgLossRate * 1.5) {
      recommendations.push(`손익비 부족 - 목표가 상향 조정 권장`);
      recommendations.push(`최고 성과 탈출 라인: ${patterns.bestExitLines[0]?.line || 70}%`);
    }

    if (stats.sharpeRatio < 1.0) {
      recommendations.push(`샤프지수 ${stats.sharpeRatio.toFixed(2)} - 변동성 대비 수익률 개선 필요`);
    }

    // Auto-apply optimizations if enabled
    let appliedChanges = false;
    if (autoApply && stats.totalTrades >= 30) {
      try {
        const settings = await storage.getAutoTradingSettings(modelId);
        if (settings) {
          await storage.updateAutoTradingSettings(modelId, {
            themeWeight: patterns.optimalWeights.theme.toFixed(2),
            newsWeight: patterns.optimalWeights.news.toFixed(2),
            financialsWeight: patterns.optimalWeights.financials.toFixed(2),
            liquidityWeight: patterns.optimalWeights.liquidity.toFixed(2),
            institutionalWeight: patterns.optimalWeights.institutional.toFixed(2),
            minAiConfidence: patterns.optimalThresholds.minAiConfidence.toFixed(2),
            requireGoodFinancials: patterns.optimalThresholds.requireGoodFinancials,
            requireHighLiquidity: patterns.optimalThresholds.requireHighLiquidity,
          });

          // Update model stats
          await storage.updateAiModel(modelId, {
            totalTrades: stats.totalTrades,
            winRate: stats.winRate.toFixed(2),
            totalReturn: stats.totalReturn.toFixed(4),
          });

          appliedChanges = true;
          recommendations.push('✅ 최적화 파라미터 자동 적용 완료');
        }
      } catch (error) {
        console.error('Failed to apply optimizations:', error);
        recommendations.push('❌ 최적화 적용 실패');
      }
    }

    return {
      modelId,
      stats,
      patterns,
      recommendations,
      appliedChanges,
    };
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(trades: TradingPerformance[]): number {
    if (trades.length === 0) return 0;

    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const trade of trades) {
      cumulative += parseFloat(trade.profitLossRate?.toString() || '0');
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = peak - cumulative;
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
}
