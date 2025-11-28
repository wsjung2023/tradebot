import { eq, and, desc, gte, lt, sql } from 'drizzle-orm';
import { db } from './db';
import * as schema from '@shared/schema';
import type { IStorage } from './storage';
import type {
  User, InsertUser,
  KiwoomAccount, InsertKiwoomAccount,
  Holding, InsertHolding,
  Order, InsertOrder,
  AiModel, InsertAiModel,
  AiRecommendation, InsertAiRecommendation,
  WatchlistItem, InsertWatchlistItem,
  Alert, InsertAlert,
  UserSettings, InsertUserSettings,
  TradingLog, InsertTradingLog,
  ConditionFormula, InsertConditionFormula,
  ConditionResult, InsertConditionResult,
  ChartFormula, InsertChartFormula,
  WatchlistSignal, InsertWatchlistSignal,
  FinancialSnapshot, InsertFinancialSnapshot,
  MarketIssue, InsertMarketIssue,
  AutoTradingSettings, InsertAutoTradingSettings,
  TradingPerformance, InsertTradingPerformance,
} from '@shared/schema';

/**
 * PostgreSQL implementation of IStorage using Drizzle ORM
 */
export class PostgreSQLStorage implements IStorage {
  // ==================== User Methods ====================

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return result[0];
  }

  async getUserByAuthProvider(provider: string, providerId: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(
      and(
        eq(schema.users.authProvider, provider),
        eq(schema.users.authProviderId, providerId)
      )
    ).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values([user]).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, id))
      .returning();
    return result[0];
  }

  // ==================== Kiwoom Account Methods ====================

  async getKiwoomAccounts(userId: string): Promise<KiwoomAccount[]> {
    return db.select().from(schema.kiwoomAccounts).where(eq(schema.kiwoomAccounts.userId, userId));
  }

  async getKiwoomAccount(id: number): Promise<KiwoomAccount | undefined> {
    const result = await db.select().from(schema.kiwoomAccounts).where(eq(schema.kiwoomAccounts.id, id)).limit(1);
    return result[0];
  }

  async createKiwoomAccount(account: InsertKiwoomAccount): Promise<KiwoomAccount> {
    const result = await db.insert(schema.kiwoomAccounts).values([account]).returning();
    return result[0];
  }

  async updateKiwoomAccount(id: number, updates: Partial<KiwoomAccount>): Promise<KiwoomAccount | undefined> {
    const result = await db.update(schema.kiwoomAccounts)
      .set(updates)
      .where(eq(schema.kiwoomAccounts.id, id))
      .returning();
    return result[0];
  }

  async deleteKiwoomAccount(id: number): Promise<void> {
    await db.delete(schema.kiwoomAccounts).where(eq(schema.kiwoomAccounts.id, id));
  }

  // ==================== Holdings Methods ====================

  async getHoldings(accountId: number): Promise<Holding[]> {
    return db.select().from(schema.holdings).where(eq(schema.holdings.accountId, accountId));
  }

  async getHolding(id: number): Promise<Holding | undefined> {
    const result = await db.select().from(schema.holdings).where(eq(schema.holdings.id, id)).limit(1);
    return result[0];
  }

  async createHolding(holding: InsertHolding): Promise<Holding> {
    const result = await db.insert(schema.holdings).values([holding]).returning();
    return result[0];
  }

  async updateHolding(id: number, updates: Partial<Holding>): Promise<Holding | undefined> {
    const result = await db.update(schema.holdings)
      .set(updates)
      .where(eq(schema.holdings.id, id))
      .returning();
    return result[0];
  }

  async deleteHolding(id: number): Promise<void> {
    await db.delete(schema.holdings).where(eq(schema.holdings.id, id));
  }

  async getHoldingByStock(accountId: number, stockCode: string): Promise<Holding | undefined> {
    const result = await db.select().from(schema.holdings).where(
      and(
        eq(schema.holdings.accountId, accountId),
        eq(schema.holdings.stockCode, stockCode)
      )
    ).limit(1);
    return result[0];
  }

  // ==================== Order Methods ====================

  async getOrders(accountId: number, limit: number = 100): Promise<Order[]> {
    return db.select().from(schema.orders)
      .where(eq(schema.orders.accountId, accountId))
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit);
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const result = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
    return result[0];
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    // Set default values for required fields
    const orderWithDefaults = {
      ...order,
      orderStatus: order.orderStatus || 'pending',
      executedQuantity: order.executedQuantity ?? 0,
      isAutoTrading: order.isAutoTrading ?? false,
    };
    const result = await db.insert(schema.orders).values([orderWithDefaults]).returning();
    return result[0];
  }

  async updateOrder(id: number, updates: Partial<Order>): Promise<Order | undefined> {
    const result = await db.update(schema.orders)
      .set(updates)
      .where(eq(schema.orders.id, id))
      .returning();
    return result[0];
  }

  async deleteOrder(id: number): Promise<void> {
    await db.delete(schema.orders).where(eq(schema.orders.id, id));
  }

  // ==================== AI Model Methods ====================

  async getAiModels(userId: string): Promise<AiModel[]> {
    return db.select().from(schema.aiModels).where(eq(schema.aiModels.userId, userId));
  }

  async getAiModel(id: number): Promise<AiModel | undefined> {
    const result = await db.select().from(schema.aiModels).where(eq(schema.aiModels.id, id)).limit(1);
    return result[0];
  }

  async createAiModel(model: InsertAiModel): Promise<AiModel> {
    const result = await db.insert(schema.aiModels).values([model]).returning();
    return result[0];
  }

  async updateAiModel(id: number, updates: Partial<AiModel>): Promise<AiModel | undefined> {
    const result = await db.update(schema.aiModels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.aiModels.id, id))
      .returning();
    return result[0];
  }

  async deleteAiModel(id: number): Promise<void> {
    await db.delete(schema.aiModels).where(eq(schema.aiModels.id, id));
  }

  // ==================== AI Recommendation Methods ====================

  async getAiRecommendations(modelId: number, limit: number = 50): Promise<AiRecommendation[]> {
    return db.select().from(schema.aiRecommendations)
      .where(eq(schema.aiRecommendations.modelId, modelId))
      .orderBy(desc(schema.aiRecommendations.createdAt))
      .limit(limit);
  }

  async createAiRecommendation(recommendation: InsertAiRecommendation): Promise<AiRecommendation> {
    const result = await db.insert(schema.aiRecommendations).values([recommendation]).returning();
    return result[0];
  }

  async updateAiRecommendation(id: number, updates: Partial<AiRecommendation>): Promise<AiRecommendation | undefined> {
    const result = await db.update(schema.aiRecommendations)
      .set(updates)
      .where(eq(schema.aiRecommendations.id, id))
      .returning();
    return result[0];
  }

  async deleteAiRecommendation(id: number): Promise<void> {
    await db.delete(schema.aiRecommendations).where(eq(schema.aiRecommendations.id, id));
  }

  // ==================== Watchlist Methods ====================

  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    return db.select().from(schema.watchlist).where(eq(schema.watchlist.userId, userId));
  }

  async createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const result = await db.insert(schema.watchlist).values([item]).returning();
    return result[0];
  }

  async deleteWatchlistItem(id: number): Promise<void> {
    await db.delete(schema.watchlist).where(eq(schema.watchlist.id, id));
  }

  // ==================== Alert Methods ====================

  async getAlerts(userId: string): Promise<Alert[]> {
    return db.select().from(schema.alerts).where(eq(schema.alerts.userId, userId));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const result = await db.insert(schema.alerts).values([alert]).returning();
    return result[0];
  }

  async updateAlert(id: number, updates: Partial<Alert>): Promise<Alert | undefined> {
    const result = await db.update(schema.alerts)
      .set(updates)
      .where(eq(schema.alerts.id, id))
      .returning();
    return result[0];
  }

  async deleteAlert(id: number): Promise<void> {
    await db.delete(schema.alerts).where(eq(schema.alerts.id, id));
  }

  // ==================== User Settings Methods ====================

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const result = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId)).limit(1);
    return result[0];
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const result = await db.insert(schema.userSettings).values([settings]).returning();
    return result[0];
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    const result = await db.update(schema.userSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userSettings.userId, userId))
      .returning();
    return result[0];
  }

  // ==================== Trading Log Methods ====================

  async getTradingLogs(accountId: number, limit: number = 100): Promise<TradingLog[]> {
    return db.select().from(schema.tradingLogs)
      .where(eq(schema.tradingLogs.accountId, accountId))
      .orderBy(desc(schema.tradingLogs.createdAt))
      .limit(limit);
  }

  async createTradingLog(log: InsertTradingLog): Promise<TradingLog> {
    const result = await db.insert(schema.tradingLogs).values([log]).returning();
    return result[0];
  }

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
    const result = await db.update(schema.conditionFormulas)
      .set(updates)
      .where(eq(schema.conditionFormulas.id, id))
      .returning();
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
    const result = await db.update(schema.chartFormulas)
      .set(updates)
      .where(eq(schema.chartFormulas.id, id))
      .returning();
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
    const result = await db.update(schema.watchlistSignals)
      .set(updates)
      .where(eq(schema.watchlistSignals.id, id))
      .returning();
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
      and(
        eq(schema.financialSnapshots.stockCode, stockCode),
        eq(schema.financialSnapshots.fiscalYear, fiscalYear)
      )
    ).limit(1);
    return result[0];
  }

  async createFinancialSnapshot(snapshot: InsertFinancialSnapshot): Promise<FinancialSnapshot> {
    const result = await db.insert(schema.financialSnapshots).values([snapshot]).returning();
    return result[0];
  }

  async updateFinancialSnapshot(id: number, updates: Partial<FinancialSnapshot>): Promise<FinancialSnapshot | undefined> {
    const result = await db.update(schema.financialSnapshots)
      .set(updates)
      .where(eq(schema.financialSnapshots.id, id))
      .returning();
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
      .where(eq(schema.autoTradingSettings.modelId, modelId))
      .limit(1);
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
      and(
        eq(schema.tradingPerformance.modelId, modelId),
        eq(schema.tradingPerformance.stockCode, stockCode)
      )
    ).limit(1);
    return result[0];
  }

  async createTradingPerformance(performance: InsertTradingPerformance): Promise<TradingPerformance> {
    const result = await db.insert(schema.tradingPerformance).values([performance]).returning();
    return result[0];
  }

  async updateTradingPerformance(id: number, updates: Partial<TradingPerformance>): Promise<TradingPerformance | undefined> {
    const result = await db.update(schema.tradingPerformance)
      .set(updates)
      .where(eq(schema.tradingPerformance.id, id))
      .returning();
    return result[0];
  }

  // ==================== Helper Methods ====================

  async getActiveAiModels(): Promise<AiModel[]> {
    return db.select().from(schema.aiModels).where(eq(schema.aiModels.isActive, true));
  }

  // ==================== Data Cleanup Methods ====================

  async deleteConditionResultsOlderThan(cutoffDate: Date): Promise<number> {
    const result = await db.delete(schema.conditionResults)
      .where(lt(schema.conditionResults.createdAt, cutoffDate));
    return result.rowCount || 0;
  }

  async deleteTradingLogsOlderThan(cutoffDate: Date): Promise<number> {
    const result = await db.delete(schema.tradingLogs)
      .where(lt(schema.tradingLogs.createdAt, cutoffDate));
    return result.rowCount || 0;
  }

  async deleteMarketIssuesOlderThan(cutoffDate: Date): Promise<number> {
    const result = await db.delete(schema.marketIssues)
      .where(lt(schema.marketIssues.createdAt, cutoffDate));
    return result.rowCount || 0;
  }

  async deleteFinancialSnapshotsOlderThan(cutoffDate: Date): Promise<number> {
    const result = await db.delete(schema.financialSnapshots)
      .where(lt(schema.financialSnapshots.createdAt, cutoffDate));
    return result.rowCount || 0;
  }

  async deleteTriggeredAlertsOlderThan(cutoffDate: Date): Promise<number> {
    const result = await db.delete(schema.alerts).where(
      and(
        eq(schema.alerts.isTriggered, true),
        lt(schema.alerts.triggeredAt, cutoffDate)
      )
    );
    return result.rowCount || 0;
  }
}
