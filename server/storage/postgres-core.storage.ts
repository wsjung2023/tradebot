// postgres-core.storage.ts ???듭떖 ?뷀떚???좎?/怨꾩쥖/蹂댁쑀/二쇰Ц/AI紐⑤뜽/愿?ъ쥌紐??뚮┝/?ㅼ젙/濡쒓렇) CRUD
import { eq, and, desc, lt, gte, lte, inArray, or, sql, getTableColumns } from 'drizzle-orm';
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
  KiwoomJob, InsertKiwoomJob,
  AutoTradingRun,
  EngineNotification, InsertEngineNotification,
  CandidateStock, InsertCandidateStock,
  AssetSnapshot, InsertAssetSnapshot,
  AgentUpdateLog, InsertAgentUpdateLog,
  AgentAlertLog, InsertAgentAlertLog,
  AiUsageDaily,
  TradeJournal, InsertTradeJournal,
  InsertConditionScanLog,
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

  async getAllUsers(): Promise<User[]> {
    return db.select().from(schema.users).orderBy(schema.users.createdAt);
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const rows = await db.select().from(schema.users)
      .where(eq(schema.users.emailVerificationToken, token))
      .limit(1);
    return rows[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values([user]).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(schema.users).set(updates).where(eq(schema.users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(schema.users).where(eq(schema.users.id, id));
  }

  // ==================== Subscription / Plan Methods ====================

  async getPlans() {
    return db.select().from(schema.plans).where(eq(schema.plans.isActive, true));
  }

  async getUserSubscription(userId: string) {
    const rows = await db.select().from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .limit(1);
    return rows[0];
  }

  async upsertSubscription(data: any) {
    const existing = await this.getUserSubscription(data.userId);
    if (existing) {
      const rows = await db.update(schema.subscriptions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.subscriptions.userId, data.userId))
        .returning();
      return rows[0];
    }
    const rows = await db.insert(schema.subscriptions).values(data).returning();
    return rows[0];
  }

  // ==================== Kiwoom Account Methods ====================

  async getKiwoomAccounts(userId: string): Promise<KiwoomAccount[]> {
    return db.select().from(schema.kiwoomAccounts).where(eq(schema.kiwoomAccounts.userId, userId));
  }

  async getAllRealKiwoomAccounts(): Promise<KiwoomAccount[]> {
    return db.select().from(schema.kiwoomAccounts).where(
      and(eq(schema.kiwoomAccounts.accountType, 'real'), eq(schema.kiwoomAccounts.isActive, true))
    );
  }

  async getAllActiveKiwoomAccounts(): Promise<KiwoomAccount[]> {
    return db.select().from(schema.kiwoomAccounts).where(eq(schema.kiwoomAccounts.isActive, true));
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
    const result = await db.update(schema.holdings).set({ ...updates, updatedAt: new Date() }).where(eq(schema.holdings.id, id)).returning();
    return result[0];
  }

  async deleteHolding(id: number): Promise<void> {
    await db.delete(schema.holdings).where(eq(schema.holdings.id, id));
  }

  async deleteHoldingsByAccount(accountId: number): Promise<void> {
    await db.delete(schema.holdings).where(eq(schema.holdings.accountId, accountId));
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

  async getAllAiModels(): Promise<AiModel[]> {
    return db.select().from(schema.aiModels);
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

  // ==================== Kiwoom Agent Job Queue ====================

  async createKiwoomJob(job: InsertKiwoomJob): Promise<KiwoomJob> {
    const result = await db.insert(schema.kiwoomJobs).values([job]).returning();
    return result[0];
  }

  async getNextPendingJob(agentId: string, supportedJobTypes?: string[]): Promise<KiwoomJob | undefined> {
    // pending ?곹깭??媛???ㅻ옒???묒뾽??processing?쇰줈 蹂寃???諛섑솚
    // 留뚮즺 ?뺣━??cleanupExpiredJobs()?먯꽌 蹂꾨룄 5遺?二쇨린濡??ㅽ뻾 (DB 荑쇰━ ?덇컧)
    const hasSupportedTypes = Array.isArray(supportedJobTypes) && supportedJobTypes.length > 0;

    const pending = await db.select().from(schema.kiwoomJobs)
      .where(
        hasSupportedTypes
          ? and(
              eq(schema.kiwoomJobs.status, 'pending'),
              inArray(schema.kiwoomJobs.jobType, supportedJobTypes!),
            )
          : eq(schema.kiwoomJobs.status, 'pending'),
      )
      .orderBy(schema.kiwoomJobs.createdAt)
      .limit(1);
    if (!pending[0]) return undefined;
    const result = await db.update(schema.kiwoomJobs)
      .set({ status: 'processing', agentId, updatedAt: new Date() })
      .where(eq(schema.kiwoomJobs.id, pending[0].id))
      .returning();
    return result[0];
  }

  // ?쒕쾭 ?ъ떆????processing ?곹깭濡?stuck???≪쓣 pending?쇰줈 ?섎룎由?
  // (諛고룷 ?ъ떆?? ?щ옒???깆쑝濡??먯씠?꾪듃媛 泥섎━ 以묒씠???≪씠 ?꾨즺?섏? 紐삵븳 寃쎌슦)
  async resetStuckProcessingJobs(): Promise<void> {
    const result = await db.update(schema.kiwoomJobs)
      .set({ status: 'pending', agentId: null, updatedAt: new Date() })
      .where(eq(schema.kiwoomJobs.status, 'processing'))
      .returning({ id: schema.kiwoomJobs.id });
    if (result.length > 0) {
      console.log(`[AgentQueue] ${result.length}媛?stuck ?≪쓣 pending?쇰줈 由ъ뀑`);
    }
  }

  async cleanupExpiredJobs(): Promise<void> {
    // 60珥??댁긽 pending ?곹깭濡??⑥븘?덈뒗 ?≪쓣 留뚮즺 泥섎━
    const EXPIRY_SEC = 60;
    const expiryCutoff = new Date(Date.now() - EXPIRY_SEC * 1000);
    const expiredPending = await db.select({ id: schema.kiwoomJobs.id })
      .from(schema.kiwoomJobs)
      .where(
        and(
          eq(schema.kiwoomJobs.status, 'pending'),
          lt(schema.kiwoomJobs.createdAt, expiryCutoff),
        ),
      );
    if (expiredPending.length > 0) {
      const expiredIds = expiredPending.map((j) => j.id);
      await db.update(schema.kiwoomJobs)
        .set({ status: 'error', errorMessage: 'expired: agent was offline', updatedAt: new Date(), processedAt: new Date() })
        .where(inArray(schema.kiwoomJobs.id, expiredIds));
      console.log(`[AgentQueue] ${expiredIds.length}媛?留뚮즺 ???뺣━ (>=${EXPIRY_SEC}珥?`);
    }
  }

  async hasPendingJobForAccount(userId: string, jobType: string, accountNumber: string): Promise<boolean> {
    const result = await db.select({ id: schema.kiwoomJobs.id })
      .from(schema.kiwoomJobs)
      .where(
        and(
          eq(schema.kiwoomJobs.userId, userId),
          eq(schema.kiwoomJobs.jobType, jobType),
          or(
            eq(schema.kiwoomJobs.status, 'pending'),
            eq(schema.kiwoomJobs.status, 'processing'),
          ),
          sql`${schema.kiwoomJobs.payload}->>'accountNumber' = ${accountNumber}`,
        ),
      )
      .limit(1);
    return result.length > 0;
  }

  async upsertAutoTradingRun(userId: string, updates: Partial<AutoTradingRun> & { state: string }): Promise<AutoTradingRun> {
    const existing = await db
      .select()
      .from(schema.autoTradingRuns)
      .where(eq(schema.autoTradingRuns.userId, userId))
      .limit(1);

    const payload = {
      ...updates,
      updatedAt: new Date(),
      lastHeartbeatAt: new Date(),
    };

    if (existing[0]) {
      const updated = await db
        .update(schema.autoTradingRuns)
        .set(payload)
        .where(eq(schema.autoTradingRuns.userId, userId))
        .returning();
      return updated[0];
    }

    const created = await db
      .insert(schema.autoTradingRuns)
      .values([{ userId, ...payload }])
      .returning();
    return created[0];
  }

  async getAutoTradingRun(userId: string): Promise<AutoTradingRun | undefined> {
    const result = await db
      .select()
      .from(schema.autoTradingRuns)
      .where(eq(schema.autoTradingRuns.userId, userId))
      .limit(1);
    return result[0];
  }

  async createEngineNotification(notification: InsertEngineNotification): Promise<EngineNotification> {
    const result = await db
      .insert(schema.engineNotifications)
      .values([notification])
      .returning();
    return result[0];
  }

  async getEngineNotifications(
    userId: string,
    limit: number = 50,
    unreadOnly: boolean = false,
    severity?: string,
    type?: string,
  ): Promise<EngineNotification[]> {
    const filters = [eq(schema.engineNotifications.userId, userId)];
    if (unreadOnly) filters.push(sql`${schema.engineNotifications.readAt} IS NULL`);
    if (severity) filters.push(eq(schema.engineNotifications.severity, severity));
    if (type) filters.push(eq(schema.engineNotifications.type, type));

    const whereClause = filters.length === 1 ? filters[0] : and(filters[0], ...filters.slice(1));
    return db
      .select()
      .from(schema.engineNotifications)
      .where(whereClause)
      .orderBy(desc(schema.engineNotifications.createdAt))
      .limit(limit);
  }

  async markEngineNotificationRead(userId: string, notificationId: number): Promise<EngineNotification | undefined> {
    const result = await db
      .update(schema.engineNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.engineNotifications.id, notificationId),
          eq(schema.engineNotifications.userId, userId),
        ),
      )
      .returning();
    return result[0];
  }

  async getUnreadEngineNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.engineNotifications)
      .where(
        and(
          eq(schema.engineNotifications.userId, userId),
          sql`${schema.engineNotifications.readAt} IS NULL`,
        ),
      );
    return Number(result[0]?.count ?? 0);
  }

  async markAllEngineNotificationsRead(userId: string): Promise<number> {
    const updated = await db
      .update(schema.engineNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.engineNotifications.userId, userId),
          sql`${schema.engineNotifications.readAt} IS NULL`,
        ),
      )
      .returning({ id: schema.engineNotifications.id });
    return updated.length;
  }

  async getEngineNotificationSummary(userId: string): Promise<{
    total: number;
    unreadTotal: number;
    unreadCrit: number;
    unreadWarn: number;
  }> {
    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread_total,
        COUNT(*) FILTER (WHERE read_at IS NULL AND severity = 'crit')::int AS unread_crit,
        COUNT(*) FILTER (WHERE read_at IS NULL AND severity = 'warn')::int AS unread_warn
      FROM engine_notifications
      WHERE user_id = ${userId}
    `);

    const row = (result as any).rows?.[0] ?? {};
    return {
      total: Number(row.total ?? 0),
      unreadTotal: Number(row.unread_total ?? 0),
      unreadCrit: Number(row.unread_crit ?? 0),
      unreadWarn: Number(row.unread_warn ?? 0),
    };
  }

  async updateKiwoomJobResult(id: number, status: string, result?: unknown, errorMessage?: string): Promise<KiwoomJob | undefined> {
    const updated = await db.update(schema.kiwoomJobs)
      .set({
        status,
        result: result ?? null,
        errorMessage: errorMessage ?? null,
        updatedAt: new Date(),
        processedAt: new Date(),
      })
      .where(eq(schema.kiwoomJobs.id, id))
      .returning();
    return updated[0];
  }

  async getKiwoomJobStatus(id: number, userId: string): Promise<KiwoomJob | undefined> {
    // ?뚯쑀??蹂몄씤???묒뾽留?議고쉶 媛??
    const result = await db.select().from(schema.kiwoomJobs)
      .where(and(eq(schema.kiwoomJobs.id, id), eq(schema.kiwoomJobs.userId, userId)))
      .limit(1);
    return result[0];
  }

  async getRecentKiwoomJobsByUser(userId: string, limit: number = 20): Promise<KiwoomJob[]> {
    return db.select().from(schema.kiwoomJobs)
      .where(eq(schema.kiwoomJobs.userId, userId))
      .orderBy(desc(schema.kiwoomJobs.createdAt))
      .limit(limit);
  }

  async getKiwoomJobByIdInternal(id: number): Promise<KiwoomJob | undefined> {
    const result = await db.select().from(schema.kiwoomJobs)
      .where(eq(schema.kiwoomJobs.id, id))
      .limit(1);
    return result[0];
  }

  async upsertCandidateStock(data: InsertCandidateStock): Promise<CandidateStock> {
    if (!data.stockCode || data.stockCode.trim() === "") {
      throw new Error("Candidate stock must have a valid stockCode");
    }
    try {
      const result = await db.insert(schema.candidateStocks).values(data)
        .onConflictDoUpdate({
          target: [schema.candidateStocks.userId, schema.candidateStocks.modelId, schema.candidateStocks.stockCode],
          set: {
            stockName: data.stockName,
            scannedLine: data.scannedLine,
            scannedAt: new Date(),
            source: data.source,
          },
        })
        .returning();
      return result[0];
    } catch (err: any) {
      // Some environments are missing the unique constraint required by ON CONFLICT.
      // Fallback to read-then-update/insert so candidate sync still works.
      if (err?.code !== '42P10') throw err;

      const existing = await db.select({ id: schema.candidateStocks.id })
        .from(schema.candidateStocks)
        .where(and(
          eq(schema.candidateStocks.userId, data.userId),
          eq(schema.candidateStocks.modelId, data.modelId),
          eq(schema.candidateStocks.stockCode, data.stockCode),
        ))
        .limit(1);

      if (existing[0]?.id) {
        const updated = await db.update(schema.candidateStocks)
          .set({
            stockName: data.stockName,
            scannedLine: data.scannedLine,
            scannedAt: new Date(),
            source: data.source,
          })
          .where(eq(schema.candidateStocks.id, existing[0].id))
          .returning();
        return updated[0];
      }

      const inserted = await db.insert(schema.candidateStocks).values(data).returning();
      return inserted[0];
    }
  }

  async getAllCandidateStocksForUser(userId: string): Promise<CandidateStock[]> {
    return db.select().from(schema.candidateStocks)
      .where(eq(schema.candidateStocks.userId, userId))
      .orderBy(desc(schema.candidateStocks.scannedAt));
  }

  async getCandidateStocks(userId: string, modelId: number): Promise<CandidateStock[]> {
    return db.select().from(schema.candidateStocks)
      .where(and(
        eq(schema.candidateStocks.userId, userId),
        eq(schema.candidateStocks.modelId, modelId),
      ));
  }

  async clearCandidateStocks(userId: string, modelId: number): Promise<void> {
    await db.delete(schema.candidateStocks)
      .where(and(
        eq(schema.candidateStocks.userId, userId),
        eq(schema.candidateStocks.modelId, modelId),
      ));
  }

  async createConditionScanLog(data: InsertConditionScanLog): Promise<void> {
    await db.insert(schema.conditionScanLogs).values(data);
  }

  async updateCandidateStock(id: number, updates: Partial<CandidateStock>): Promise<CandidateStock | undefined> {
    const result = await db.update(schema.candidateStocks)
      .set(updates)
      .where(eq(schema.candidateStocks.id, id))
      .returning();
    return result[0];
  }

  async getAllHoldingsForUser(
    userId: string,
    options?: { activeOnly?: boolean; accountType?: "mock" | "real"; accountId?: number },
  ): Promise<(Holding & { accountName: string; accountNumber: string; accountType: string; isActive: boolean })[]> {
    const filters: any[] = [eq(schema.kiwoomAccounts.userId, userId)];
    if (options?.activeOnly) filters.push(eq(schema.kiwoomAccounts.isActive, true));
    if (options?.accountType) filters.push(eq(schema.kiwoomAccounts.accountType, options.accountType));
    if (options?.accountId) filters.push(eq(schema.kiwoomAccounts.id, options.accountId));

    const rows = await db
      .select({
        id: schema.holdings.id,
        accountId: schema.holdings.accountId,
        stockCode: schema.holdings.stockCode,
        stockName: schema.holdings.stockName,
        quantity: schema.holdings.quantity,
        averagePrice: schema.holdings.averagePrice,
        currentPrice: schema.holdings.currentPrice,
        profitLoss: schema.holdings.profitLoss,
        profitLossRate: schema.holdings.profitLossRate,
        updatedAt: schema.holdings.updatedAt,
        accountName: schema.kiwoomAccounts.accountName,
        accountNumber: schema.kiwoomAccounts.accountNumber,
        accountType: schema.kiwoomAccounts.accountType,
        isActive: schema.kiwoomAccounts.isActive,
      })
      .from(schema.holdings)
      .innerJoin(schema.kiwoomAccounts, eq(schema.holdings.accountId, schema.kiwoomAccounts.id))
      .where(filters.length === 1 ? filters[0] : and(filters[0], ...filters.slice(1)))
      .orderBy(desc(schema.holdings.updatedAt));
    return rows.map((row) => ({
      ...row,
      accountName: row.accountName ?? '',
    }));
  }

  async createAssetSnapshot(data: InsertAssetSnapshot): Promise<AssetSnapshot> {
    const result = await db.insert(schema.assetSnapshots).values([data]).returning();
    return result[0];
  }

  async getAssetSnapshots(accountId: number, days: number = 30): Promise<AssetSnapshot[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return db.select().from(schema.assetSnapshots)
      .where(and(
        eq(schema.assetSnapshots.accountId, accountId),
        gte(schema.assetSnapshots.snapshotAt, cutoff),
      ))
      .orderBy(schema.assetSnapshots.snapshotAt);
  }

  async recordAiUsageDaily(data: {
    userId: string;
    accountId?: number | null;
    usageDate?: string;
    requestCount?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    costUsd?: number;
  }): Promise<void> {
    const usageDate = data.usageDate ?? new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const requestCount = Math.max(0, Number(data.requestCount ?? 1));
    const promptTokens = Math.max(0, Number(data.promptTokens ?? 0));
    const completionTokens = Math.max(0, Number(data.completionTokens ?? 0));
    const totalTokens = Math.max(0, Number(data.totalTokens ?? (promptTokens + completionTokens)));
    const costUsd = Math.max(0, Number(data.costUsd ?? 0));

    const scopes: Array<{ scopeType: 'login' | 'account'; scopeKey: string; accountId: number | null }> = [
      { scopeType: 'login', scopeKey: `login:${data.userId}`, accountId: null },
    ];
    if (data.accountId) {
      scopes.push({
        scopeType: 'account',
        scopeKey: `account:${data.accountId}`,
        accountId: data.accountId,
      });
    }

    for (const scope of scopes) {
      await db.insert(schema.aiUsageDaily).values({
        usageDate,
        userId: data.userId,
        scopeType: scope.scopeType,
        scopeKey: scope.scopeKey,
        accountId: scope.accountId,
        requestCount,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd: costUsd.toFixed(8),
      }).onConflictDoUpdate({
        target: [schema.aiUsageDaily.usageDate, schema.aiUsageDaily.userId, schema.aiUsageDaily.scopeKey],
        set: {
          requestCount: sql`${schema.aiUsageDaily.requestCount} + ${requestCount}`,
          promptTokens: sql`${schema.aiUsageDaily.promptTokens} + ${promptTokens}`,
          completionTokens: sql`${schema.aiUsageDaily.completionTokens} + ${completionTokens}`,
          totalTokens: sql`${schema.aiUsageDaily.totalTokens} + ${totalTokens}`,
          costUsd: sql`${schema.aiUsageDaily.costUsd} + ${costUsd.toFixed(8)}`,
          accountId: scope.accountId,
          scopeType: scope.scopeType,
          updatedAt: new Date(),
        },
      });
    }
  }

  async getAiUsageDaily(
    userId: string,
    options?: { fromDate?: string; toDate?: string; scopeType?: 'login' | 'account'; accountId?: number; limit?: number },
  ): Promise<AiUsageDaily[]> {
    const filters: any[] = [eq(schema.aiUsageDaily.userId, userId)];
    if (options?.fromDate) filters.push(gte(schema.aiUsageDaily.usageDate, options.fromDate));
    if (options?.toDate) filters.push(lte(schema.aiUsageDaily.usageDate, options.toDate));
    if (options?.scopeType) filters.push(eq(schema.aiUsageDaily.scopeType, options.scopeType));
    if (options?.accountId) filters.push(eq(schema.aiUsageDaily.accountId, options.accountId));
    const whereClause = filters.length === 1 ? filters[0] : and(filters[0], ...filters.slice(1));

    return db.select()
      .from(schema.aiUsageDaily)
      .where(whereClause)
      .orderBy(desc(schema.aiUsageDaily.usageDate), desc(schema.aiUsageDaily.updatedAt))
      .limit(options?.limit ?? 200);
  }

  // ==================== Agent Update Logs ====================

  async createAgentUpdateLog(log: InsertAgentUpdateLog): Promise<AgentUpdateLog> {
    const result = await db.insert(schema.agentUpdateLogs).values([log]).returning();
    return result[0];
  }

  async getAgentUpdateLogs(limit: number = 20, offset: number = 0): Promise<AgentUpdateLog[]> {
    return db.select()
      .from(schema.agentUpdateLogs)
      .orderBy(desc(schema.agentUpdateLogs.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async countAgentUpdateLogs(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(schema.agentUpdateLogs);
    return Number(result[0]?.count ?? 0);
  }

  async deleteAgentUpdateLog(id: number): Promise<void> {
    await db.delete(schema.agentUpdateLogs).where(eq(schema.agentUpdateLogs.id, id));
  }

  async deleteAllAgentUpdateLogs(): Promise<void> {
    await db.delete(schema.agentUpdateLogs);
  }

  // ==================== Agent Alert Logs ====================

  async createAgentAlertLog(log: InsertAgentAlertLog): Promise<AgentAlertLog> {
    const result = await db.insert(schema.agentAlertLogs).values([log]).returning();
    return result[0];
  }

  async getAgentAlertLogs(userId: string, limit: number = 20): Promise<AgentAlertLog[]> {
    return db.select()
      .from(schema.agentAlertLogs)
      .where(eq(schema.agentAlertLogs.userId, userId))
      .orderBy(desc(schema.agentAlertLogs.sentAt))
      .limit(limit);
  }

  // ==================== System Config ====================

  async getSystemConfig(key: string): Promise<string | null> {
    const result = await db.select().from(schema.systemConfig).where(eq(schema.systemConfig.key, key)).limit(1);
    return result[0]?.value ?? null;
  }

  async setSystemConfig(key: string, value: string): Promise<void> {
    await db.insert(schema.systemConfig)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.systemConfig.key,
        set: { value, updatedAt: new Date() },
      });
  }

  // ==================== Trade Journal ====================

  async createTradeJournal(entry: InsertTradeJournal): Promise<TradeJournal> {
    const result = await db.insert(schema.tradeJournal).values([entry]).returning();
    return result[0];
  }

  async getTradeJournalEntries(userId: string, options?: {
    startDate?: string;
    endDate?: string;
    stockCode?: string;
    tradeType?: string;
    accountId?: number;
    accountType?: "mock" | "real";
    accountStatus?: "active" | "all" | "archived";
    activeOnly?: boolean;
    modelId?: number;
    limit?: number;
  }): Promise<any[]> {
    const filters: any[] = [eq(schema.tradeJournal.userId, userId)];
    
    if (options?.startDate) filters.push(gte(schema.tradeJournal.tradeDate, options.startDate.replace(/-/g, '')));
    if (options?.endDate) filters.push(lte(schema.tradeJournal.tradeDate, options.endDate.replace(/-/g, '')));
    if (options?.stockCode) filters.push(eq(schema.tradeJournal.stockCode, options.stockCode));
    if (options?.tradeType) filters.push(eq(schema.tradeJournal.tradeType, options.tradeType));
    if (options?.accountId) filters.push(eq(schema.tradeJournal.accountId, options.accountId));
    if (options?.accountType) filters.push(eq(schema.kiwoomAccounts.accountType, options.accountType));
    if (options?.accountStatus === "archived") {
      filters.push(eq(schema.kiwoomAccounts.isActive, false));
    } else if (options?.activeOnly !== false) {
      filters.push(eq(schema.kiwoomAccounts.isActive, true));
    }
    if (options?.modelId) filters.push(eq(schema.tradeJournal.modelId, options.modelId));

    const whereClause = filters.length === 1 ? filters[0] : and(filters[0], ...filters.slice(1));
    
    return db.select({
        ...getTableColumns(schema.tradeJournal),
        accountName: schema.kiwoomAccounts.accountName,
        accountNumber: schema.kiwoomAccounts.accountNumber,
        accountType: schema.kiwoomAccounts.accountType,
        accountIsActive: schema.kiwoomAccounts.isActive,
        modelName: schema.aiModels.modelName,
      })
      .from(schema.tradeJournal)
      .innerJoin(schema.kiwoomAccounts, eq(schema.tradeJournal.accountId, schema.kiwoomAccounts.id))
      .leftJoin(schema.aiModels, eq(schema.tradeJournal.modelId, schema.aiModels.id))
      .where(whereClause)
      .orderBy(desc(schema.tradeJournal.tradeDate), desc(schema.tradeJournal.tradeTime))
      .limit(options?.limit ?? 500);
  }

  // ==================== Stock Status (Phase 2) ====================

  async upsertStockStatus(status: schema.InsertStockStatus): Promise<schema.StockStatus> {
    const [row] = await db.insert(schema.stockStatus)
      .values({ ...status, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.stockStatus.stockCode,
        set: { ...status, updatedAt: new Date() }
      })
      .returning();
    return row;
  }

  async getStockStatus(stockCode: string): Promise<schema.StockStatus | null> {
    const [row] = await db.select()
      .from(schema.stockStatus)
      .where(eq(schema.stockStatus.stockCode, stockCode));
    return row || null;
  }

  // ==================== Holding Exit Plans (종목별 분할매도 계획) ====================

  async getHoldingExitPlan(modelId: number, stockCode: string): Promise<schema.HoldingExitPlan | undefined> {
    const [row] = await db.select()
      .from(schema.holdingExitPlans)
      .where(and(
        eq(schema.holdingExitPlans.modelId, modelId),
        eq(schema.holdingExitPlans.stockCode, stockCode),
      ));
    return row;
  }

  async upsertHoldingExitPlan(data: schema.InsertHoldingExitPlan & { modelId: number; stockCode: string }): Promise<schema.HoldingExitPlan> {
    const now = new Date();
    const [row] = await db.insert(schema.holdingExitPlans)
      .values({ ...data, updatedAt: now })
      .onConflictDoUpdate({
        target: [schema.holdingExitPlans.modelId, schema.holdingExitPlans.stockCode],
        set: {
          exitStages: data.exitStages,
          aiReasoning: data.aiReasoning,
          source: data.source,
          generatedAt: data.generatedAt,
          // 수기 오버라이드 필드는 ai_batch 호출 시에만 null이면 유지
          ...(data.takeProfitPercent !== undefined ? { takeProfitPercent: data.takeProfitPercent } : {}),
          ...(data.stopLossPercent !== undefined ? { stopLossPercent: data.stopLossPercent } : {}),
          updatedAt: now,
        },
      })
      .returning();
    return row;
  }

  async deleteHoldingExitPlan(modelId: number, stockCode: string): Promise<void> {
    await db.delete(schema.holdingExitPlans)
      .where(and(
        eq(schema.holdingExitPlans.modelId, modelId),
        eq(schema.holdingExitPlans.stockCode, stockCode),
      ));
  }

  async getHoldingExitPlansForModel(modelId: number): Promise<schema.HoldingExitPlan[]> {
    return db.select()
      .from(schema.holdingExitPlans)
      .where(eq(schema.holdingExitPlans.modelId, modelId))
      .orderBy(desc(schema.holdingExitPlans.updatedAt));
  }

  async markExitStageFulfilled(modelId: number, stockCode: string, priority: number): Promise<schema.HoldingExitPlan | undefined> {
    const existing = await this.getHoldingExitPlan(modelId, stockCode);
    if (!existing || !Array.isArray(existing.exitStages)) return existing;
    const updated = (existing.exitStages as schema.ExitStage[]).map(s =>
      s.priority === priority ? { ...s, fulfilled: true } : s
    );
    const [row] = await db.update(schema.holdingExitPlans)
      .set({ exitStages: updated, updatedAt: new Date() })
      .where(and(
        eq(schema.holdingExitPlans.modelId, modelId),
        eq(schema.holdingExitPlans.stockCode, stockCode),
      ))
      .returning();
    return row;
  }

  // ==================== Learning Suggestions Methods ====================

  async createLearningSuggestions(suggestions: schema.InsertLearningSuggestion[]): Promise<schema.LearningSuggestion[]> {
    if (suggestions.length === 0) return [];
    return db.insert(schema.learningSuggestions).values(suggestions).returning();
  }

  async getLearningSuggestions(modelId: number, status?: string | string[]): Promise<schema.LearningSuggestion[]> {
    const conditions = [eq(schema.learningSuggestions.modelId, modelId)];
    if (Array.isArray(status) && status.length > 0) {
      conditions.push(inArray(schema.learningSuggestions.status, status));
    } else if (typeof status === 'string' && status) {
      conditions.push(eq(schema.learningSuggestions.status, status));
    }
    return db.select()
      .from(schema.learningSuggestions)
      .where(and(...conditions))
      .orderBy(desc(schema.learningSuggestions.createdAt));
  }

  async countPendingLearningSuggestions(userId: string): Promise<number> {
    const models = await db.select({ id: schema.aiModels.id })
      .from(schema.aiModels)
      .where(eq(schema.aiModels.userId, userId));
    if (models.length === 0) return 0;
    const modelIds = models.map(m => m.id);
    const rows = await db.select({ count: sql<number>`count(*)` })
      .from(schema.learningSuggestions)
      .where(and(
        inArray(schema.learningSuggestions.modelId, modelIds),
        eq(schema.learningSuggestions.status, 'pending'),
      ));
    return Number(rows[0]?.count ?? 0);
  }

  async updateLearningSuggestionStatus(id: number, status: 'applied' | 'dismissed' | 'auto_applied'): Promise<schema.LearningSuggestion | undefined> {
    const [row] = await db.update(schema.learningSuggestions)
      .set({ status, reviewedAt: new Date() })
      .where(eq(schema.learningSuggestions.id, id))
      .returning();
    return row;
  }

  async applyLearningSuggestion(id: number, userId: string): Promise<schema.LearningSuggestion | undefined> {
    const [suggestion] = await db.select()
      .from(schema.learningSuggestions)
      .where(eq(schema.learningSuggestions.id, id));
    if (!suggestion || suggestion.status !== 'pending') return suggestion;

    // 모델 소유권 확인 후 파라미터 적용
    const [model] = await db.select()
      .from(schema.aiModels)
      .where(and(
        eq(schema.aiModels.id, suggestion.modelId),
        eq(schema.aiModels.userId, userId),
      ));
    if (!model) return undefined;

    const [settings] = await db.select()
      .from(schema.autoTradingSettings)
      .where(eq(schema.autoTradingSettings.modelId, suggestion.modelId));

    if (settings) {
      const numericValue = parseFloat(suggestion.suggestedValue);
      const updateMap: Record<string, unknown> = {};
      if (suggestion.paramKey === 'takeProfitPercent') updateMap.takeProfitPercent = suggestion.suggestedValue;
      else if (suggestion.paramKey === 'stopLossPercent') updateMap.stopLossPercent = suggestion.suggestedValue;
      else if (suggestion.paramKey === 'minAiConfidence') updateMap.minAiConfidence = suggestion.suggestedValue;
      else if (suggestion.paramKey === 'maxUnitsPerStock') updateMap.maxUnitsPerStock = isNaN(numericValue) ? undefined : Math.round(numericValue);

      if (Object.keys(updateMap).length > 0) {
        await db.update(schema.autoTradingSettings)
          .set(updateMap)
          .where(eq(schema.autoTradingSettings.modelId, suggestion.modelId));
      }
    }

    // aiModels config JSON 파라미터 업데이트 (weights, entryLadder 등)
    const configKeys = ['themeWeight', 'newsWeight', 'financialsWeight', 'liquidityWeight', 'institutionalWeight',
      'requireGoodFinancials', 'requireHighLiquidity', 'stopLossMode', 'entryLadderEnabled'];
    if (configKeys.includes(suggestion.paramKey)) {
      const currentConfig = (model.config as Record<string, unknown>) ?? {};
      let parsedValue: unknown = suggestion.suggestedValue;
      try { parsedValue = JSON.parse(suggestion.suggestedValue); } catch {}
      await db.update(schema.aiModels)
        .set({ config: { ...currentConfig, [suggestion.paramKey]: parsedValue } })
        .where(eq(schema.aiModels.id, suggestion.modelId));
    }

    return this.updateLearningSuggestionStatus(id, 'applied');
  }

  async dismissAllLearningSuggestions(modelId: number): Promise<void> {
    await db.update(schema.learningSuggestions)
      .set({ status: 'dismissed', reviewedAt: new Date() })
      .where(and(
        eq(schema.learningSuggestions.modelId, modelId),
        eq(schema.learningSuggestions.status, 'pending'),
      ));
  }
}

