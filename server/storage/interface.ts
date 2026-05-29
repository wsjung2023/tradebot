// interface.ts ???§ÌÜ†Î¶¨Ï? ?àÏù¥??Í≥µÌÜµ ?∏ÌÑ∞?òÏù¥???ïÏùò (PostgreSQL/InMemory Íµ¨ÌòÑÏ≤?Í≥µÏú†)
import {
  type User, type InsertUser,
  type KiwoomAccount, type InsertKiwoomAccount,
  type Holding, type InsertHolding,
  type Order, type InsertOrder,
  type AiModel, type InsertAiModel,
  type AiRecommendation, type InsertAiRecommendation,
  type WatchlistItem, type InsertWatchlistItem,
  type WatchlistSyncSnapshot, type InsertWatchlistSyncSnapshot,
  type Alert, type InsertAlert,
  type UserSettings, type InsertUserSettings,
  type TradingLog, type InsertTradingLog,
  type ConditionFormula, type InsertConditionFormula,
  type ConditionResult, type InsertConditionResult,
  type ChartFormula, type InsertChartFormula,
  type WatchlistSignal, type InsertWatchlistSignal,
  type FinancialSnapshot, type InsertFinancialSnapshot,
  type MarketIssue, type InsertMarketIssue,
  type AutoTradingSettings, type InsertAutoTradingSettings,
  type TradingPerformance, type InsertTradingPerformance,
  type AiModelSpec, type InsertAiModelSpec,
  type AiCouncilSession, type InsertAiCouncilSession,
  type EntryPoint, type InsertEntryPoint,
  type LearningRecord, type InsertLearningRecord,
  type CompanyFiling, type InsertCompanyFiling,
  type NewsArticleRecord, type InsertNewsArticleRecord,
  type AnalysisMaterialSnapshot, type InsertAnalysisMaterialSnapshot,
  type KiwoomJob, type InsertKiwoomJob,
  type AutoTradingRun, type InsertAutoTradingRun,
  type EngineNotification, type InsertEngineNotification,
  type CandidateStock, type InsertCandidateStock,
  type AssetSnapshot, type InsertAssetSnapshot,
  type AgentUpdateLog, type InsertAgentUpdateLog,
  type AgentAlertLog, type InsertAgentAlertLog,
  type CandidateDecisionLog, type InsertCandidateDecisionLog,
  type PositionDecisionLog, type InsertPositionDecisionLog,
  type AiUsageDaily,
  type TradeJournal, type InsertTradeJournal,
  type StockStatus, type InsertStockStatus,
  type InsertConditionScanLog,
  type HoldingExitPlan, type InsertHoldingExitPlan,
} from "@shared/schema";

export interface IStorage {
  // ?¨Ïö©??
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByAuthProvider(provider: string, providerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // ?§Ï? Í≥ÑÏ¢å
  getKiwoomAccounts(userId: string): Promise<KiwoomAccount[]>;
  getAllRealKiwoomAccounts(): Promise<KiwoomAccount[]>;
  getAllActiveKiwoomAccounts(): Promise<KiwoomAccount[]>;
  getKiwoomAccount(id: number): Promise<KiwoomAccount | undefined>;
  createKiwoomAccount(account: InsertKiwoomAccount): Promise<KiwoomAccount>;
  updateKiwoomAccount(id: number, updates: Partial<KiwoomAccount>): Promise<KiwoomAccount | undefined>;
  deleteKiwoomAccount(id: number): Promise<void>;

  // Î≥¥Ïú†Ï¢ÖÎ™©
  getHoldings(accountId: number): Promise<Holding[]>;
  getHolding(id: number): Promise<Holding | undefined>;
  createHolding(holding: InsertHolding): Promise<Holding>;
  updateHolding(id: number, updates: Partial<Holding>): Promise<Holding | undefined>;
  deleteHolding(id: number): Promise<void>;
  deleteHoldingsByAccount(accountId: number): Promise<void>;
  getHoldingByStock(accountId: number, stockCode: string): Promise<Holding | undefined>;

  // Ï£ºÎ¨∏
  getOrders(accountId: number, limit?: number): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, updates: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<void>;

  // AI Î™®Îç∏
  getAiModels(userId: string): Promise<AiModel[]>;
  getAiModel(id: number): Promise<AiModel | undefined>;
  createAiModel(model: InsertAiModel): Promise<AiModel>;
  updateAiModel(id: number, updates: Partial<AiModel>): Promise<AiModel | undefined>;
  deleteAiModel(id: number): Promise<void>;

  // AI Ï∂îÏ≤ú
  getAiRecommendations(modelId: number, limit?: number): Promise<AiRecommendation[]>;
  createAiRecommendation(recommendation: InsertAiRecommendation): Promise<AiRecommendation>;
  updateAiRecommendation(id: number, updates: Partial<AiRecommendation>): Promise<AiRecommendation | undefined>;
  deleteAiRecommendation(id: number): Promise<void>;

  // Í¥Ä?¨Ï¢ÖÎ™?
  getWatchlist(userId: string): Promise<WatchlistItem[]>;
  createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem>;
  deleteWatchlistItem(id: number): Promise<void>;
  getWatchlistSyncSnapshots(userId: string): Promise<WatchlistSyncSnapshot[]>;
  upsertWatchlistSyncSnapshot(snapshot: InsertWatchlistSyncSnapshot): Promise<WatchlistSyncSnapshot>;

  // ?åÎ¶º
  getAlerts(userId: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  updateAlert(id: number, updates: Partial<Alert>): Promise<Alert | undefined>;
  deleteAlert(id: number): Promise<void>;
  getAllActiveAlerts(): Promise<Alert[]>;

  // ?¨Ïö©???§Ï†ï
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined>;

  // Í±∞Îûò Î°úÍ∑∏
  createTradingLog(log: InsertTradingLog): Promise<TradingLog>;
  getTradingLogs(accountId: number, limit?: number): Promise<TradingLog[]>;

  // Ï°∞Í±¥??
  getConditionFormulas(userId: string): Promise<ConditionFormula[]>;
  getConditionFormula(id: number): Promise<ConditionFormula | undefined>;
  createConditionFormula(formula: InsertConditionFormula): Promise<ConditionFormula>;
  updateConditionFormula(id: number, updates: Partial<ConditionFormula>): Promise<ConditionFormula | undefined>;
  deleteConditionFormula(id: number): Promise<void>;

  // Ï°∞Í±¥??Í≤∞Í≥º
  getConditionResults(conditionId: number): Promise<ConditionResult[]>;
  createConditionResult(result: InsertConditionResult): Promise<ConditionResult>;
  deleteConditionResults(conditionId: number): Promise<void>;

  // Ï∞®Ìä∏ ?òÏãù
  getChartFormulas(userId: string): Promise<ChartFormula[]>;
  getChartFormula(id: number): Promise<ChartFormula | undefined>;
  createChartFormula(formula: InsertChartFormula): Promise<ChartFormula>;
  updateChartFormula(id: number, updates: Partial<ChartFormula>): Promise<ChartFormula | undefined>;
  deleteChartFormula(id: number): Promise<void>;

  // Í¥Ä?¨Ï¢ÖÎ™??úÍ∑∏??
  getWatchlistSignals(watchlistId: number): Promise<WatchlistSignal[]>;
  getAllUserWatchlistSignals(userId: string): Promise<(WatchlistSignal & { stockCode: string; stockName: string })[]>;
  createWatchlistSignal(signal: InsertWatchlistSignal): Promise<WatchlistSignal>;
  updateWatchlistSignal(id: number, updates: Partial<WatchlistSignal>): Promise<WatchlistSignal | undefined>;
  deleteWatchlistSignal(id: number): Promise<void>;

  // ?¨Î¨¥ ?§ÎÉÖ??
  getFinancialSnapshots(stockCode: string): Promise<FinancialSnapshot[]>;
  getFinancialSnapshot(stockCode: string, fiscalYear: number): Promise<FinancialSnapshot | undefined>;
  createFinancialSnapshot(snapshot: InsertFinancialSnapshot): Promise<FinancialSnapshot>;
  updateFinancialSnapshot(id: number, updates: Partial<FinancialSnapshot>): Promise<FinancialSnapshot | undefined>;

  // ?•Ïù¥??Ï¢ÖÎ™©
  getMarketIssues(issueDate: string): Promise<MarketIssue[]>;
  getMarketIssuesByStock(stockCode: string): Promise<MarketIssue[]>;
  createMarketIssue(issue: InsertMarketIssue): Promise<MarketIssue>;
  deleteMarketIssue(id: number): Promise<void>;
  deleteMarketIssues(issueDate: string): Promise<void>;

  // ?êÎèôÎß§Îß§ ?§Ï†ï
  getAutoTradingSettings(modelId: number): Promise<AutoTradingSettings | undefined>;
  createAutoTradingSettings(settings: InsertAutoTradingSettings): Promise<AutoTradingSettings>;
  updateAutoTradingSettings(modelId: number, updates: Partial<AutoTradingSettings>): Promise<AutoTradingSettings | undefined>;

  // Îß§Îß§ ?±Í≥º
  getTradingPerformance(modelId: number, limit?: number): Promise<TradingPerformance[]>;
  getTradingPerformanceByStock(modelId: number, stockCode: string): Promise<TradingPerformance | undefined>;
  createTradingPerformance(performance: InsertTradingPerformance): Promise<TradingPerformance>;
  updateTradingPerformance(id: number, updates: Partial<TradingPerformance>): Promise<TradingPerformance | undefined>;

  // AI Î™®Îç∏ ?§Ìéô
  getAiModelSpecs(activeOnly?: boolean): Promise<AiModelSpec[]>;
  createAiModelSpec(spec: InsertAiModelSpec): Promise<AiModelSpec>;
  updateAiModelSpec(id: number, updates: Partial<AiModelSpec>): Promise<AiModelSpec | undefined>;

  // AI Council ?∏ÏÖò
  getAiCouncilSessions(userId: string, limit?: number): Promise<AiCouncilSession[]>;
  createAiCouncilSession(session: InsertAiCouncilSession): Promise<AiCouncilSession>;

  // ?Ä??Í∏∞Î°ù
  getEntryPoints(stockCode: string, limit?: number): Promise<EntryPoint[]>;
  createEntryPoint(entryPoint: InsertEntryPoint): Promise<EntryPoint>;

  // ?ôÏäµ Í∏∞Î°ù
  getLearningRecords(modelId: number, limit?: number): Promise<LearningRecord[]>;
  createLearningRecord(record: InsertLearningRecord): Promise<LearningRecord>;

  // Í≥µÏãú
  getCompanyFilings(stockCode: string, limit?: number): Promise<CompanyFiling[]>;
  upsertCompanyFiling(filing: InsertCompanyFiling): Promise<CompanyFiling>;

  // ?¥Ïä§(?ÅÏÜç)
  getNewsArticles(stockCode: string, limit?: number): Promise<NewsArticleRecord[]>;
  upsertNewsArticle(article: InsertNewsArticleRecord): Promise<NewsArticleRecord>;

  // Î∂ÑÏÑù ?¨Î£å ?§ÎÉÖ??
  getAnalysisMaterialSnapshots(userId: string, stockCode: string, limit?: number): Promise<AnalysisMaterialSnapshot[]>;
  createAnalysisMaterialSnapshot(snapshot: InsertAnalysisMaterialSnapshot): Promise<AnalysisMaterialSnapshot>;

  // ?§Ï? ?êÏù¥?ÑÌä∏ ?ëÏóÖ ??
  createKiwoomJob(job: InsertKiwoomJob): Promise<KiwoomJob>;
  getNextPendingJob(agentId: string, supportedJobTypes?: string[]): Promise<KiwoomJob | undefined>;
  cleanupExpiredJobs(): Promise<void>;
  resetStuckProcessingJobs(): Promise<void>;
  updateKiwoomJobResult(id: number, status: string, result?: unknown, errorMessage?: string): Promise<KiwoomJob | undefined>;
  getKiwoomJobStatus(id: number, userId: string): Promise<KiwoomJob | undefined>;
  getRecentKiwoomJobsByUser(userId: string, limit?: number): Promise<KiwoomJob[]>;
  getKiwoomJobByIdInternal(id: number): Promise<KiwoomJob | undefined>;
  hasPendingJobForAccount(userId: string, jobType: string, accountNumber: string): Promise<boolean>;

  // ?êÎèôÎß§Îß§ ?ÅÌÉú Î®∏Ïã† / ?åÎ¶º
  upsertAutoTradingRun(userId: string, updates: Partial<AutoTradingRun> & { state: string }): Promise<AutoTradingRun>;
  getAutoTradingRun(userId: string): Promise<AutoTradingRun | undefined>;
  createEngineNotification(notification: InsertEngineNotification): Promise<EngineNotification>;
  getEngineNotifications(
    userId: string,
    limit?: number,
    unreadOnly?: boolean,
    severity?: string,
    type?: string,
  ): Promise<EngineNotification[]>;
  markEngineNotificationRead(userId: string, notificationId: number): Promise<EngineNotification | undefined>;
  getUnreadEngineNotificationCount(userId: string): Promise<number>;
  markAllEngineNotificationsRead(userId: string): Promise<number>;
  getEngineNotificationSummary(userId: string): Promise<{
    total: number;
    unreadTotal: number;
    unreadCrit: number;
    unreadWarn: number;
  }>;

  // ?ÑÎ≥¥ Ï¢ÖÎ™© (candidate_stocks)
  getAllCandidateStocksForUser(userId: string): Promise<CandidateStock[]>;
  upsertCandidateStock(data: InsertCandidateStock): Promise<CandidateStock>;
  getCandidateStocks(userId: string, modelId: number): Promise<CandidateStock[]>;
  clearCandidateStocks(userId: string, modelId: number): Promise<void>;
  updateCandidateStock(id: number, updates: Partial<CandidateStock>): Promise<CandidateStock | undefined>;
  updateCandidateEvaluation(candidateId: number, updates: Pick<CandidateStock, 'evaluationResult' | 'skipReason' | 'evaluatedAt'>): Promise<CandidateStock | undefined>;

  // Ï°∞Í±¥Í≤Ä???§Ï∫î ?àÏä§?†Î¶¨
  createConditionScanLog(data: InsertConditionScanLog): Promise<void>;

  // ?òÏÇ¨Í≤∞Ï†ï Î°úÍ∑∏
  createCandidateDecisionLog(data: InsertCandidateDecisionLog): Promise<CandidateDecisionLog>;
  getCandidateDecisionLogsForUser(
    userId: string,
    options?: {
      modelId?: number;
      accepted?: boolean;
      from?: Date;
      to?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<Array<CandidateDecisionLog & { modelName: string; modelType: string }>>;
  getLatestCandidateDecision(
    modelId: number,
    stockCode: string,
    since?: Date,
  ): Promise<CandidateDecisionLog | undefined>;
  getLatestCandidateDecisionByCooldownKey(
    modelId: number,
    stockCode: string,
    cooldownKey: string,
  ): Promise<CandidateDecisionLog | undefined>;
  createPositionDecisionLog(data: InsertPositionDecisionLog): Promise<PositionDecisionLog>;

  // ?ÑÍ≥ÑÏ¢?Î≥¥Ïú†Ï¢ÖÎ™©
  getAllHoldingsForUser(userId: string): Promise<(Holding & { accountName: string; accountNumber: string })[]>;

  // ?êÏÇ∞ ?§ÎÉÖ??
  createAssetSnapshot(data: InsertAssetSnapshot): Promise<AssetSnapshot>;
  getAssetSnapshots(accountId: number, days?: number): Promise<AssetSnapshot[]>;

  // AI ?ºÎ≥Ñ ?¨Ïö©??ÎπÑÏö© ?ÅÏπò
  recordAiUsageDaily(data: {
    userId: string;
    accountId?: number | null;
    usageDate?: string; // YYYY-MM-DD (KST)
    requestCount?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    costUsd?: number;
  }): Promise<void>;
  getAiUsageDaily(
    userId: string,
    options?: { fromDate?: string; toDate?: string; scopeType?: 'login' | 'account'; accountId?: number; limit?: number },
  ): Promise<AiUsageDaily[]>;

  // ?¨Ìçº
  getActiveAiModels(): Promise<AiModel[]>;
  getAllAiModels(): Promise<AiModel[]>;

  // ?∞Ïù¥???ïÎ¶¨
  deleteConditionResultsOlderThan(cutoffDate: Date): Promise<number>;
  deleteTradingLogsOlderThan(cutoffDate: Date): Promise<number>;
  deleteMarketIssuesOlderThan(cutoffDate: Date): Promise<number>;
  deleteFinancialSnapshotsOlderThan(cutoffDate: Date): Promise<number>;
  deleteTriggeredAlertsOlderThan(cutoffDate: Date): Promise<number>;

  // ?êÏù¥?ÑÌä∏ ?ÖÎç∞?¥Ìä∏ ?¥Î†•
  createAgentUpdateLog(log: InsertAgentUpdateLog): Promise<AgentUpdateLog>;
  getAgentUpdateLogs(limit?: number, offset?: number): Promise<AgentUpdateLog[]>;
  countAgentUpdateLogs(): Promise<number>;
  deleteAgentUpdateLog(id: number): Promise<void>;
  deleteAllAgentUpdateLogs(): Promise<void>;

  // ?êÏù¥?ÑÌä∏ ?åÎ¶º ?¥Î†•
  createAgentAlertLog(log: InsertAgentAlertLog): Promise<AgentAlertLog>;
  getAgentAlertLogs(userId: string, limit?: number): Promise<AgentAlertLog[]>;

  // ?úÏä§???§Ï†ï (???ÅÌÉú ?ÅÏÜç??????Í∞??Ä?•ÏÜå)
  getSystemConfig(key: string): Promise<string | null>;
  setSystemConfig(key: string, value: string): Promise<void>;

  // ∏≈∏≈ ¿˙≥Œ
  createTradeJournal(entry: InsertTradeJournal): Promise<TradeJournal>;
  getTradeJournalEntries(userId: string, options?: {
    startDate?: string;
    endDate?: string;
    stockCode?: string;
    tradeType?: string;
    limit?: number;
  }): Promise<TradeJournal[]>;

  // Stock Status (Phase 2)
  upsertStockStatus(status: InsertStockStatus): Promise<StockStatus>;
  getStockStatus(stockCode: string): Promise<StockStatus | null>;

  // ¡æ∏Ò∫∞ ∫–«“∏≈µµ ∞Ë»π
  getHoldingExitPlan(modelId: number, stockCode: string): Promise<HoldingExitPlan | undefined>;
  upsertHoldingExitPlan(data: InsertHoldingExitPlan & { modelId: number; stockCode: string }): Promise<HoldingExitPlan>;
  deleteHoldingExitPlan(modelId: number, stockCode: string): Promise<void>;
  getHoldingExitPlansForModel(modelId: number): Promise<HoldingExitPlan[]>;
  markExitStageFulfilled(modelId: number, stockCode: string, priority: number): Promise<HoldingExitPlan | undefined>;
}
