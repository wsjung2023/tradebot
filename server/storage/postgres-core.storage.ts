// postgres-core.storage.ts — 핵심 엔티티(유저/계좌/보유/주문/AI모델/관심종목/알림/설정/로그) CRUD
import { eq, and, desc, lt } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '@shared/schema';
import type {
  User, InsertUser,
  KiwoomAccount, InsertKiwoomAccount,
  Holding, InsertHolding,
  Order, InsertOrder,
  AiModel, InsertAiModel,
  AiRecommendation, InsertAiRecommendation,
  WatchlistItem, InsertWatchlistItem,
  WatchlistSyncSnapshot, InsertWatchlistSyncSnapshot,
  Alert, InsertAlert,
  UserSettings, InsertUserSettings,
  TradingLog, InsertTradingLog,
  AiModelSpec, InsertAiModelSpec,
  AiCouncilSession, InsertAiCouncilSession,
  EntryPoint, InsertEntryPoint,
  LearningRecord, InsertLearningRecord,
  CompanyFiling, InsertCompanyFiling,
  NewsArticleRecord, InsertNewsArticleRecord,
  AnalysisMaterialSnapshot, InsertAnalysisMaterialSnapshot,
} from '@shared/schema';

export class PostgreSQLCoreStorage {
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
      and(eq(schema.users.authProvider, provider), eq(schema.users.authProviderId, providerId))
    ).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values([user]).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(schema.users).set(updates).where(eq(schema.users.id, id)).returning();
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
    const result = await db.update(schema.kiwoomAccounts).set(updates).where(eq(schema.kiwoomAccounts.id, id)).returning();
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
    const result = await db.update(schema.holdings).set(updates).where(eq(schema.holdings.id, id)).returning();
    return result[0];
  }

  async deleteHolding(id: number): Promise<void> {
    await db.delete(schema.holdings).where(eq(schema.holdings.id, id));
  }

  async getHoldingByStock(accountId: number, stockCode: string): Promise<Holding | undefined> {
    const result = await db.select().from(schema.holdings).where(
      and(eq(schema.holdings.accountId, accountId), eq(schema.holdings.stockCode, stockCode))
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
    const orderWithDefaults = { ...order, orderStatus: 'pending' as const, executedQuantity: 0, isAutoTrading: order.isAutoTrading ?? false };
    const result = await db.insert(schema.orders).values([orderWithDefaults]).returning();
    return result[0];
  }

  async updateOrder(id: number, updates: Partial<Order>): Promise<Order | undefined> {
    const result = await db.update(schema.orders).set(updates).where(eq(schema.orders.id, id)).returning();
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
    const result = await db.update(schema.aiModels).set({ ...updates, updatedAt: new Date() }).where(eq(schema.aiModels.id, id)).returning();
    return result[0];
  }

  async deleteAiModel(id: number): Promise<void> {
    await db.delete(schema.aiModels).where(eq(schema.aiModels.id, id));
  }

  async getActiveAiModels(): Promise<AiModel[]> {
    return db.select().from(schema.aiModels).where(eq(schema.aiModels.isActive, true));
  }

  // ==================== AI Recommendation Methods ====================

  async getAiRecommendations(modelId: number, limit: number = 50): Promise<AiRecommendation[]> {
    return db.select().from(schema.aiRecommendations)
      .where(eq(schema.aiRecommendations.modelId, modelId))
      .orderBy(desc(schema.aiRecommendations.createdAt))
      .limit(limit);
  }

  async createAiRecommendation(recommendation: InsertAiRecommendation): Promise<AiRecommendation> {
    const normalized = {
      ...recommendation,
      confidence: typeof recommendation.confidence === 'number' ? String(recommendation.confidence) : recommendation.confidence,
    };
    const result = await db.insert(schema.aiRecommendations).values([normalized]).returning();
    return result[0];
  }

  async updateAiRecommendation(id: number, updates: Partial<AiRecommendation>): Promise<AiRecommendation | undefined> {
    const result = await db.update(schema.aiRecommendations).set(updates).where(eq(schema.aiRecommendations.id, id)).returning();
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

  async getWatchlistSyncSnapshots(userId: string): Promise<WatchlistSyncSnapshot[]> {
    return db
      .select()
      .from(schema.watchlistSyncSnapshots)
      .where(eq(schema.watchlistSyncSnapshots.userId, userId))
      .orderBy(desc(schema.watchlistSyncSnapshots.updatedAt));
  }

  async upsertWatchlistSyncSnapshot(snapshot: InsertWatchlistSyncSnapshot): Promise<WatchlistSyncSnapshot> {
    const existing = await db
      .select()
      .from(schema.watchlistSyncSnapshots)
      .where(
        and(
          eq(schema.watchlistSyncSnapshots.userId, snapshot.userId),
          eq(schema.watchlistSyncSnapshots.stockCode, snapshot.stockCode),
        ),
      )
      .limit(1);

    if (existing[0]) {
      const updated = await db
        .update(schema.watchlistSyncSnapshots)
        .set({
          stockName: snapshot.stockName,
          source: snapshot.source,
          syncedPrice: snapshot.syncedPrice,
          rawPayload: snapshot.rawPayload,
          syncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.watchlistSyncSnapshots.id, existing[0].id))
        .returning();
      return updated[0];
    }

    const created = await db
      .insert(schema.watchlistSyncSnapshots)
      .values([snapshot])
      .returning();
    return created[0];
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
    const result = await db.update(schema.alerts).set(updates).where(eq(schema.alerts.id, id)).returning();
    return result[0];
  }

  async deleteAlert(id: number): Promise<void> {
    await db.delete(schema.alerts).where(eq(schema.alerts.id, id));
  }

  async getAllActiveAlerts(): Promise<Alert[]> {
    return db
      .select()
      .from(schema.alerts)
      .where(and(eq(schema.alerts.isActive, true), eq(schema.alerts.isTriggered, false)));
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

  // ==================== AI Model Specs ====================

  async getAiModelSpecs(activeOnly: boolean = true): Promise<AiModelSpec[]> {
    const query = db.select().from(schema.aiModelSpecs);
    if (!activeOnly) return query.orderBy(desc(schema.aiModelSpecs.updatedAt));
    return query.where(eq(schema.aiModelSpecs.isActive, true)).orderBy(desc(schema.aiModelSpecs.updatedAt));
  }

  async createAiModelSpec(spec: InsertAiModelSpec): Promise<AiModelSpec> {
    const result = await db.insert(schema.aiModelSpecs).values([spec]).returning();
    return result[0];
  }

  async updateAiModelSpec(id: number, updates: Partial<AiModelSpec>): Promise<AiModelSpec | undefined> {
    const result = await db.update(schema.aiModelSpecs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.aiModelSpecs.id, id))
      .returning();
    return result[0];
  }

  // ==================== AI Council Sessions ====================

  async getAiCouncilSessions(userId: string, limit: number = 20): Promise<AiCouncilSession[]> {
    return db.select().from(schema.aiCouncilSessions)
      .where(eq(schema.aiCouncilSessions.userId, userId))
      .orderBy(desc(schema.aiCouncilSessions.createdAt))
      .limit(limit);
  }

  async createAiCouncilSession(session: InsertAiCouncilSession): Promise<AiCouncilSession> {
    const result = await db.insert(schema.aiCouncilSessions).values([session]).returning();
    return result[0];
  }

  // ==================== Entry Points ====================

  async getEntryPoints(stockCode: string, limit: number = 50): Promise<EntryPoint[]> {
    return db.select().from(schema.entryPoints)
      .where(eq(schema.entryPoints.stockCode, stockCode))
      .orderBy(desc(schema.entryPoints.createdAt))
      .limit(limit);
  }

  async createEntryPoint(entryPoint: InsertEntryPoint): Promise<EntryPoint> {
    const result = await db.insert(schema.entryPoints).values([entryPoint]).returning();
    return result[0];
  }

  // ==================== Learning Records ====================

  async getLearningRecords(modelId: number, limit: number = 30): Promise<LearningRecord[]> {
    return db.select().from(schema.learningRecords)
      .where(eq(schema.learningRecords.modelId, modelId))
      .orderBy(desc(schema.learningRecords.createdAt))
      .limit(limit);
  }

  async createLearningRecord(record: InsertLearningRecord): Promise<LearningRecord> {
    const result = await db.insert(schema.learningRecords).values([record]).returning();
    return result[0];
  }

  // ==================== Company Filings ====================

  async getCompanyFilings(stockCode: string, limit: number = 30): Promise<CompanyFiling[]> {
    return db.select().from(schema.companyFilings)
      .where(eq(schema.companyFilings.stockCode, stockCode))
      .orderBy(desc(schema.companyFilings.rceptDt), desc(schema.companyFilings.updatedAt))
      .limit(limit);
  }

  async upsertCompanyFiling(filing: InsertCompanyFiling): Promise<CompanyFiling> {
    const existing = await db.select().from(schema.companyFilings)
      .where(and(eq(schema.companyFilings.stockCode, filing.stockCode), eq(schema.companyFilings.rceptNo, filing.rceptNo)))
      .limit(1);

    if (existing[0]) {
      const updated = await db.update(schema.companyFilings)
        .set({ ...filing, updatedAt: new Date() })
        .where(eq(schema.companyFilings.id, existing[0].id))
        .returning();
      return updated[0];
    }

    const created = await db.insert(schema.companyFilings).values([filing]).returning();
    return created[0];
  }

  // ==================== News Articles ====================

  async getNewsArticles(stockCode: string, limit: number = 50): Promise<NewsArticleRecord[]> {
    return db.select().from(schema.newsArticles)
      .where(eq(schema.newsArticles.stockCode, stockCode))
      .orderBy(desc(schema.newsArticles.publishedAt), desc(schema.newsArticles.updatedAt))
      .limit(limit);
  }

  async upsertNewsArticle(article: InsertNewsArticleRecord): Promise<NewsArticleRecord> {
    const existing = await db.select().from(schema.newsArticles)
      .where(and(eq(schema.newsArticles.stockCode, article.stockCode), eq(schema.newsArticles.link, article.link)))
      .limit(1);

    if (existing[0]) {
      const updated = await db.update(schema.newsArticles)
        .set({ ...article, updatedAt: new Date() })
        .where(eq(schema.newsArticles.id, existing[0].id))
        .returning();
      return updated[0];
    }

    const created = await db.insert(schema.newsArticles).values([article]).returning();
    return created[0];
  }

  // ==================== Analysis Material Snapshots ====================

  async getAnalysisMaterialSnapshots(userId: string, stockCode: string, limit: number = 20): Promise<AnalysisMaterialSnapshot[]> {
    return db.select().from(schema.analysisMaterialSnapshots)
      .where(and(eq(schema.analysisMaterialSnapshots.userId, userId), eq(schema.analysisMaterialSnapshots.stockCode, stockCode)))
      .orderBy(desc(schema.analysisMaterialSnapshots.collectedAt))
      .limit(limit);
  }

  async createAnalysisMaterialSnapshot(snapshot: InsertAnalysisMaterialSnapshot): Promise<AnalysisMaterialSnapshot> {
    const result = await db.insert(schema.analysisMaterialSnapshots).values([snapshot]).returning();
    return result[0];
  }

  // ==================== Data Cleanup Methods ====================

  async deleteConditionResultsOlderThan(cutoffDate: Date): Promise<number> {
    const result = await db.delete(schema.conditionResults).where(lt(schema.conditionResults.createdAt, cutoffDate));
    return result.rowCount || 0;
  }

  async deleteTradingLogsOlderThan(cutoffDate: Date): Promise<number> {
    const result = await db.delete(schema.tradingLogs).where(lt(schema.tradingLogs.createdAt, cutoffDate));
    return result.rowCount || 0;
  }

  async deleteMarketIssuesOlderThan(cutoffDate: Date): Promise<number> {
    const result = await db.delete(schema.marketIssues).where(lt(schema.marketIssues.createdAt, cutoffDate));
    return result.rowCount || 0;
  }

  async deleteFinancialSnapshotsOlderThan(cutoffDate: Date): Promise<number> {
    const result = await db.delete(schema.financialSnapshots).where(lt(schema.financialSnapshots.createdAt, cutoffDate));
    return result.rowCount || 0;
  }

  async deleteTriggeredAlertsOlderThan(cutoffDate: Date): Promise<number> {
    const result = await db.delete(schema.alerts).where(
      and(eq(schema.alerts.isTriggered, true), lt(schema.alerts.triggeredAt, cutoffDate))
    );
    return result.rowCount || 0;
  }
}
