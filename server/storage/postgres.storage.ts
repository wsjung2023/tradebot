// postgres.storage.ts — 조건식/차트수식/관심종목시그널/재무/자동매매/성과 CRUD. PostgreSQLCoreStorage 확장
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '@shared/schema';
import type { IStorage } from './interface';
import type {
  ConditionFormula, InsertConditionFormula,
  ConditionResult, InsertConditionResult,
  ChartFormula, InsertChartFormula,
  WatchlistSignal, InsertWatchlistSignal,
  FinancialSnapshot, InsertFinancialSnapshot,
  MarketIssue, InsertMarketIssue,
  AutoTradingSettings, InsertAutoTradingSettings,
  TradingPerformance, InsertTradingPerformance,
} from '@shared/schema';
import { PostgreSQLCoreStorage } from './postgres-core.storage';

export class PostgreSQLStorage extends PostgreSQLCoreStorage implements IStorage {
  // ==================== Condition Formula Methods ====================

  async getConditionFormulas(userId: string): Promise<ConditionFormula[]> {
    return db.select().from(schema.conditionFormulas).where(eq(schema.conditionFormulas.userId, userId));
  }

  async getConditionFormula(id: number): Promise<ConditionFormula | undefined> {
    const result = await db.select().from(schema.conditionFormulas).where(eq(schema.conditionFormulas.id, id)).limit(1);
    return result[0];
  }

  async createConditionFormula(formula: InsertConditionFormula): Promise<ConditionFormula> {
    const result = await db.insert(schema.conditionFormulas).values([formula]).returning();
    return result[0];
  }

  async updateConditionFormula(id: number, updates: Partial<ConditionFormula>): Promise<ConditionFormula | undefined> {
    const result = await db.update(schema.conditionFormulas).set(updates).where(eq(schema.conditionFormulas.id, id)).returning();
    return result[0];
  }

  async deleteConditionFormula(id: number): Promise<void> {
    await db.delete(schema.conditionFormulas).where(eq(schema.conditionFormulas.id, id));
  }

  // ==================== Condition Result Methods ====================

  async getConditionResults(conditionId: number, limit: number = 100): Promise<ConditionResult[]> {
    return db.select().from(schema.conditionResults)
      .where(eq(schema.conditionResults.conditionId, conditionId))
      .orderBy(desc(schema.conditionResults.createdAt))
      .limit(limit);
  }

  async createConditionResult(result: InsertConditionResult): Promise<ConditionResult> {
    const inserted = await db.insert(schema.conditionResults).values([result]).returning();
    return inserted[0];
  }

  async deleteConditionResults(conditionId: number): Promise<void> {
    await db.delete(schema.conditionResults).where(eq(schema.conditionResults.conditionId, conditionId));
  }

  // ==================== Chart Formula Methods ====================

  async getChartFormulas(userId: string): Promise<ChartFormula[]> {
    return db.select().from(schema.chartFormulas).where(eq(schema.chartFormulas.userId, userId));
  }

  async getChartFormula(id: number): Promise<ChartFormula | undefined> {
    const result = await db.select().from(schema.chartFormulas).where(eq(schema.chartFormulas.id, id)).limit(1);
    return result[0];
  }

  async createChartFormula(formula: InsertChartFormula): Promise<ChartFormula> {
    const result = await db.insert(schema.chartFormulas).values([formula]).returning();
    return result[0];
  }

  async updateChartFormula(id: number, updates: Partial<ChartFormula>): Promise<ChartFormula | undefined> {
    const result = await db.update(schema.chartFormulas).set(updates).where(eq(schema.chartFormulas.id, id)).returning();
    return result[0];
  }

  async deleteChartFormula(id: number): Promise<void> {
    await db.delete(schema.chartFormulas).where(eq(schema.chartFormulas.id, id));
  }

  // ==================== Watchlist Signal Methods ====================

  async getWatchlistSignals(watchlistId: number): Promise<WatchlistSignal[]> {
    return db.select().from(schema.watchlistSignals).where(eq(schema.watchlistSignals.watchlistId, watchlistId));
  }

  async createWatchlistSignal(signal: InsertWatchlistSignal): Promise<WatchlistSignal> {
    const result = await db.insert(schema.watchlistSignals).values([signal]).returning();
    return result[0];
  }

  async updateWatchlistSignal(id: number, updates: Partial<WatchlistSignal>): Promise<WatchlistSignal | undefined> {
    const result = await db.update(schema.watchlistSignals).set(updates).where(eq(schema.watchlistSignals.id, id)).returning();
    return result[0];
  }

  async deleteWatchlistSignal(id: number): Promise<void> {
    await db.delete(schema.watchlistSignals).where(eq(schema.watchlistSignals.id, id));
  }

  // ==================== Financial Snapshot Methods ====================

  async getFinancialSnapshots(stockCode: string): Promise<FinancialSnapshot[]> {
    return db.select().from(schema.financialSnapshots)
      .where(eq(schema.financialSnapshots.stockCode, stockCode))
      .orderBy(desc(schema.financialSnapshots.fiscalYear));
  }

  async getFinancialSnapshot(stockCode: string, fiscalYear: number): Promise<FinancialSnapshot | undefined> {
    const result = await db.select().from(schema.financialSnapshots).where(
      and(eq(schema.financialSnapshots.stockCode, stockCode), eq(schema.financialSnapshots.fiscalYear, fiscalYear))
    ).limit(1);
    return result[0];
  }

  async createFinancialSnapshot(snapshot: InsertFinancialSnapshot): Promise<FinancialSnapshot> {
    const result = await db.insert(schema.financialSnapshots).values([snapshot]).returning();
    return result[0];
  }

  async updateFinancialSnapshot(id: number, updates: Partial<FinancialSnapshot>): Promise<FinancialSnapshot | undefined> {
    const result = await db.update(schema.financialSnapshots).set(updates).where(eq(schema.financialSnapshots.id, id)).returning();
    return result[0];
  }

  // ==================== Market Issue Methods ====================

  async getMarketIssues(issueDate: string): Promise<MarketIssue[]> {
    return db.select().from(schema.marketIssues).where(eq(schema.marketIssues.issueDate, issueDate));
  }

  async getMarketIssuesByStock(stockCode: string): Promise<MarketIssue[]> {
    return db.select().from(schema.marketIssues).where(eq(schema.marketIssues.stockCode, stockCode));
  }

  async createMarketIssue(issue: InsertMarketIssue): Promise<MarketIssue> {
    const result = await db.insert(schema.marketIssues).values([issue]).returning();
    return result[0];
  }

  async deleteMarketIssues(issueDate: string): Promise<void> {
    await db.delete(schema.marketIssues).where(eq(schema.marketIssues.issueDate, issueDate));
  }

  // ==================== Auto Trading Settings Methods ====================

  async getAutoTradingSettings(modelId: number): Promise<AutoTradingSettings | undefined> {
    const result = await db.select().from(schema.autoTradingSettings)
      .where(eq(schema.autoTradingSettings.modelId, modelId)).limit(1);
    return result[0];
  }

  async createAutoTradingSettings(settings: InsertAutoTradingSettings): Promise<AutoTradingSettings> {
    const result = await db.insert(schema.autoTradingSettings).values([settings]).returning();
    return result[0];
  }

  async updateAutoTradingSettings(modelId: number, updates: Partial<AutoTradingSettings>): Promise<AutoTradingSettings | undefined> {
    const result = await db.update(schema.autoTradingSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.autoTradingSettings.modelId, modelId))
      .returning();
    return result[0];
  }

  // ==================== Trading Performance Methods ====================

  async getTradingPerformance(modelId: number, limit: number = 100): Promise<TradingPerformance[]> {
    return db.select().from(schema.tradingPerformance)
      .where(eq(schema.tradingPerformance.modelId, modelId))
      .orderBy(desc(schema.tradingPerformance.entryTime))
      .limit(limit);
  }

  async getTradingPerformanceByStock(modelId: number, stockCode: string): Promise<TradingPerformance | undefined> {
    const result = await db.select().from(schema.tradingPerformance).where(
      and(eq(schema.tradingPerformance.modelId, modelId), eq(schema.tradingPerformance.stockCode, stockCode))
    ).limit(1);
    return result[0];
  }

  async createTradingPerformance(performance: InsertTradingPerformance): Promise<TradingPerformance> {
    const result = await db.insert(schema.tradingPerformance).values([performance]).returning();
    return result[0];
  }

  async updateTradingPerformance(id: number, updates: Partial<TradingPerformance>): Promise<TradingPerformance | undefined> {
    const result = await db.update(schema.tradingPerformance).set(updates).where(eq(schema.tradingPerformance.id, id)).returning();
    return result[0];
  }
}
