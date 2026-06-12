// interface.ts ???�토리�? ?�이??공통 ?�터?�이???�의 (PostgreSQL/InMemory 구현�?공유)
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
  type LearningSuggestion, type InsertLearningSuggestion,
  type Plan,
  type Subscription,
} from "@shared/schema";

export interface IStorage {
  // ?�용??
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByAuthProvider(provider: string, providerId: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  // 구독/플랜 (SaaS billing)
  getPlans(): Promise<Plan[]>;
  getUserSubscription(userId: string): Promise<Subscription | undefined>;
  upsertSubscription(data: Partial<Subscription> & { userId: string }): Promise<Subscription>;

  // ?��? 계좌
  getKiwoomAccounts(userId: string): Promise<KiwoomAccount[]>;
  getAllRealKiwoomAccounts(): Promise<KiwoomAccount[]>;
  getAllActiveKiwoomAccounts(): Promise<KiwoomAccount[]>;
  getKiwoomAccount(id: number): Promise<KiwoomAccount | undefined>;
  createKiwoomAccount(account: InsertKiwoomAccount): Promise<KiwoomAccount>;
  updateKiwoomAccount(id: number, updates: Partial<KiwoomAccount>): Promise<KiwoomAccount | undefined>;
  deleteKiwoomAccount(id: number): Promise<void>;

  // 보유종목
  getHoldings(accountId: number): Promise<Holding[]>;
  getHolding(id: number): Promise<Holding | undefined>;
  createHolding(holding: InsertHolding): Promise<Holding>;
  updateHolding(id: number, updates: Partial<Holding>): Promise<Holding | undefined>;
  deleteHolding(id: number): Promise<void>;
  deleteHoldingsByAccount(accountId: number): Promise<void>;
  getHoldingByStock(accountId: number, stockCode: string): Promise<Holding | undefined>;

  // 주문
  getOrders(accountId: number, limit?: number): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, updates: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<void>;

  // AI 모델
  getAiModels(userId: string): Promise<AiModel[]>;
  getAiModel(id: number): Promise<AiModel | undefined>;
  createAiModel(model: InsertAiModel): Promise<AiModel>;
  updateAiModel(id: number, updates: Partial<AiModel>): Promise<AiModel | undefined>;
  deleteAiModel(id: number): Promise<void>;

  // AI 추천
  getAiRecommendations(modelId: number, limit?: number): Promise<AiRecommendation[]>;
  createAiRecommendation(recommendation: InsertAiRecommendation): Promise<AiRecommendation>;
  updateAiRecommendation(id: number, updates: Partial<AiRecommendation>): Promise<AiRecommendation | undefined>;
  deleteAiRecommendation(id: number): Promise<void>;

  // 관?�종�?
  getWatchlist(userId: string): Promise<WatchlistItem[]>;
  createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem>;
  deleteWatchlistItem(id: number): Promise<void>;
  getWatchlistSyncSnapshots(userId: string): Promise<WatchlistSyncSnapshot[]>;
  upsertWatchlistSyncSnapshot(snapshot: InsertWatchlistSyncSnapshot): Promise<WatchlistSyncSnapshot>;

  // ?�림
  getAlerts(userId: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  updateAlert(id: number, updates: Partial<Alert>): Promise<Alert | undefined>;
  deleteAlert(id: number): Promise<void>;
  getAllActiveAlerts(): Promise<Alert[]>;

  // ?�용???�정
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined>;

  // 거래 로그
  createTradingLog(log: InsertTradingLog): Promise<TradingLog>;
  getTradingLogs(accountId: number, limit?: number): Promise<TradingLog[]>;

  // 조건??
  getConditionFormulas(userId: string): Promise<ConditionFormula[]>;
  getConditionFormula(id: number): Promise<ConditionFormula | undefined>;
  createConditionFormula(formula: InsertConditionFormula): Promise<ConditionFormula>;
  updateConditionFormula(id: number, updates: Partial<ConditionFormula>): Promise<ConditionFormula | undefined>;
  deleteConditionFormula(id: number): Promise<void>;

  // 조건??결과
  getConditionResults(conditionId: number): Promise<ConditionResult[]>;
  createConditionResult(result: InsertConditionResult): Promise<ConditionResult>;
  deleteConditionResults(conditionId: number): Promise<void>;

  // 차트 ?�식
  getChartFormulas(userId: string): Promise<ChartFormula[]>;
  getChartFormula(id: number): Promise<ChartFormula | undefined>;
  createChartFormula(formula: InsertChartFormula): Promise<ChartFormula>;
  updateChartFormula(id: number, updates: Partial<ChartFormula>): Promise<ChartFormula | undefined>;
  deleteChartFormula(id: number): Promise<void>;

  // 관?�종�??�그??
  getWatchlistSignals(watchlistId: number): Promise<WatchlistSignal[]>;
  getAllUserWatchlistSignals(userId: string): Promise<(WatchlistSignal & { stockCode: string; stockName: string })[]>;
  createWatchlistSignal(signal: InsertWatchlistSignal): Promise<WatchlistSignal>;
  updateWatchlistSignal(id: number, updates: Partial<WatchlistSignal>): Promise<WatchlistSignal | undefined>;
  deleteWatchlistSignal(id: number): Promise<void>;

  // ?�무 ?�냅??
  getFinancialSnapshots(stockCode: string): Promise<FinancialSnapshot[]>;
  getFinancialSnapshot(stockCode: string, fiscalYear: number): Promise<FinancialSnapshot | undefined>;
  createFinancialSnapshot(snapshot: InsertFinancialSnapshot): Promise<FinancialSnapshot>;
  updateFinancialSnapshot(id: number, updates: Partial<FinancialSnapshot>): Promise<FinancialSnapshot | undefined>;

  // ?�이??종목
  getMarketIssues(issueDate: string): Promise<MarketIssue[]>;
  getMarketIssuesByStock(stockCode: string): Promise<MarketIssue[]>;
  createMarketIssue(issue: InsertMarketIssue): Promise<MarketIssue>;
  deleteMarketIssue(id: number): Promise<void>;
  deleteMarketIssues(issueDate: string): Promise<void>;

  // ?�동매매 ?�정
  getAutoTradingSettings(modelId: number): Promise<AutoTradingSettings | undefined>;
  createAutoTradingSettings(settings: InsertAutoTradingSettings): Promise<AutoTradingSettings>;
  updateAutoTradingSettings(modelId: number, updates: Partial<AutoTradingSettings>): Promise<AutoTradingSettings | undefined>;

  // 매매 ?�과
  getTradingPerformance(modelId: number, limit?: number): Promise<TradingPerformance[]>;
  getTradingPerformanceByStock(modelId: number, stockCode: string): Promise<TradingPerformance | undefined>;
  createTradingPerformance(performance: InsertTradingPerformance): Promise<TradingPerformance>;
  updateTradingPerformance(id: number, updates: Partial<TradingPerformance>): Promise<TradingPerformance | undefined>;

  // AI 모델 ?�펙
  getAiModelSpecs(activeOnly?: boolean): Promise<AiModelSpec[]>;
  createAiModelSpec(spec: InsertAiModelSpec): Promise<AiModelSpec>;
  updateAiModelSpec(id: number, updates: Partial<AiModelSpec>): Promise<AiModelSpec | undefined>;

  // AI Council ?�션
  getAiCouncilSessions(userId: string, limit?: number): Promise<AiCouncilSession[]>;
  createAiCouncilSession(session: InsertAiCouncilSession): Promise<AiCouncilSession>;

  // ?�??기록
  getEntryPoints(stockCode: string, limit?: number): Promise<EntryPoint[]>;
  createEntryPoint(entryPoint: InsertEntryPoint): Promise<EntryPoint>;

  // ?�습 기록
  getLearningRecords(modelId: number, limit?: number): Promise<LearningRecord[]>;
  createLearningRecord(record: InsertLearningRecord): Promise<LearningRecord>;

  // 공시
  getCompanyFilings(stockCode: string, limit?: number): Promise<CompanyFiling[]>;
  upsertCompanyFiling(filing: InsertCompanyFiling): Promise<CompanyFiling>;

  // ?�스(?�속)
  getNewsArticles(stockCode: string, limit?: number): Promise<NewsArticleRecord[]>;
  upsertNewsArticle(article: InsertNewsArticleRecord): Promise<NewsArticleRecord>;

  // 분석 ?�료 ?�냅??
  getAnalysisMaterialSnapshots(userId: string, stockCode: string, limit?: number): Promise<AnalysisMaterialSnapshot[]>;
  createAnalysisMaterialSnapshot(snapshot: InsertAnalysisMaterialSnapshot): Promise<AnalysisMaterialSnapshot>;

  // ?��? ?�이?�트 ?�업 ??
  createKiwoomJob(job: InsertKiwoomJob): Promise<KiwoomJob>;
  getNextPendingJob(agentId: string, supportedJobTypes?: string[]): Promise<KiwoomJob | undefined>;
  cleanupExpiredJobs(): Promise<void>;
  resetStuckProcessingJobs(): Promise<void>;
  updateKiwoomJobResult(id: number, status: string, result?: unknown, errorMessage?: string): Promise<KiwoomJob | undefined>;
  getKiwoomJobStatus(id: number, userId: string): Promise<KiwoomJob | undefined>;
  getRecentKiwoomJobsByUser(userId: string, limit?: number): Promise<KiwoomJob[]>;
  getKiwoomJobByIdInternal(id: number): Promise<KiwoomJob | undefined>;
  hasPendingJobForAccount(userId: string, jobType: string, accountNumber: string): Promise<boolean>;

  // ?�동매매 ?�태 머신 / ?�림
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

  // ?�보 종목 (candidate_stocks)
  getAllCandidateStocksForUser(userId: string): Promise<CandidateStock[]>;
  upsertCandidateStock(data: InsertCandidateStock): Promise<CandidateStock>;
  getCandidateStocks(userId: string, modelId: number): Promise<CandidateStock[]>;
  clearCandidateStocks(userId: string, modelId: number): Promise<void>;
  updateCandidateStock(id: number, updates: Partial<CandidateStock>): Promise<CandidateStock | undefined>;
  updateCandidateEvaluation(candidateId: number, updates: Pick<CandidateStock, 'evaluationResult' | 'skipReason' | 'evaluatedAt'>): Promise<CandidateStock | undefined>;

  // 조건검???�캔 ?�스?�리
  createConditionScanLog(data: InsertConditionScanLog): Promise<void>;

  // ?�사결정 로그
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

  // ?�계�?보유종목
  getAllHoldingsForUser(userId: string): Promise<(Holding & { accountName: string; accountNumber: string })[]>;

  // ?�산 ?�냅??
  createAssetSnapshot(data: InsertAssetSnapshot): Promise<AssetSnapshot>;
  getAssetSnapshots(accountId: number, days?: number): Promise<AssetSnapshot[]>;

  // AI ?�별 ?�용??비용 ?�치
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

  // ?�퍼
  getActiveAiModels(): Promise<AiModel[]>;
  getAllAiModels(): Promise<AiModel[]>;

  // ?�이???�리
  deleteConditionResultsOlderThan(cutoffDate: Date): Promise<number>;
  deleteTradingLogsOlderThan(cutoffDate: Date): Promise<number>;
  deleteMarketIssuesOlderThan(cutoffDate: Date): Promise<number>;
  deleteFinancialSnapshotsOlderThan(cutoffDate: Date): Promise<number>;
  deleteTriggeredAlertsOlderThan(cutoffDate: Date): Promise<number>;

  // ?�이?�트 ?�데?�트 ?�력
  createAgentUpdateLog(log: InsertAgentUpdateLog): Promise<AgentUpdateLog>;
  getAgentUpdateLogs(limit?: number, offset?: number): Promise<AgentUpdateLog[]>;
  countAgentUpdateLogs(): Promise<number>;
  deleteAgentUpdateLog(id: number): Promise<void>;
  deleteAllAgentUpdateLogs(): Promise<void>;

  // ?�이?�트 ?�림 ?�력
  createAgentAlertLog(log: InsertAgentAlertLog): Promise<AgentAlertLog>;
  getAgentAlertLogs(userId: string, limit?: number): Promise<AgentAlertLog[]>;

  // ?�스???�정 (???�태 ?�속??????�??�?�소)
  getSystemConfig(key: string): Promise<string | null>;
  setSystemConfig(key: string, value: string): Promise<void>;

  // �Ÿ� ����
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

  // ���� ���Ҹŵ� ��ȹ
  getHoldingExitPlan(modelId: number, stockCode: string): Promise<HoldingExitPlan | undefined>;
  upsertHoldingExitPlan(data: InsertHoldingExitPlan & { modelId: number; stockCode: string }): Promise<HoldingExitPlan>;
  deleteHoldingExitPlan(modelId: number, stockCode: string): Promise<void>;
  getHoldingExitPlansForModel(modelId: number): Promise<HoldingExitPlan[]>;
  markExitStageFulfilled(modelId: number, stockCode: string, priority: number): Promise<HoldingExitPlan | undefined>;

  // 학습잡 파라미터 제안
  createLearningSuggestions(suggestions: InsertLearningSuggestion[]): Promise<LearningSuggestion[]>;
  getLearningSuggestions(modelId: number, status?: string | string[]): Promise<LearningSuggestion[]>;
  countPendingLearningSuggestions(userId: string): Promise<number>;
  updateLearningSuggestionStatus(id: number, status: 'applied' | 'dismissed' | 'auto_applied'): Promise<LearningSuggestion | undefined>;
  applyLearningSuggestion(id: number, userId: string): Promise<LearningSuggestion | undefined>;
  dismissAllLearningSuggestions(modelId: number): Promise<void>;
}
