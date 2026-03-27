// interface.ts — 스토리지 레이어 공통 인터페이스 정의 (PostgreSQL/InMemory 구현체 공유)
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
} from "@shared/schema";

export interface IStorage {
  // 사용자
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByAuthProvider(provider: string, providerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // 키움 계좌
  getKiwoomAccounts(userId: string): Promise<KiwoomAccount[]>;
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

  // 관심종목
  getWatchlist(userId: string): Promise<WatchlistItem[]>;
  createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem>;
  deleteWatchlistItem(id: number): Promise<void>;
  getWatchlistSyncSnapshots(userId: string): Promise<WatchlistSyncSnapshot[]>;
  upsertWatchlistSyncSnapshot(snapshot: InsertWatchlistSyncSnapshot): Promise<WatchlistSyncSnapshot>;

  // 알림
  getAlerts(userId: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  updateAlert(id: number, updates: Partial<Alert>): Promise<Alert | undefined>;
  deleteAlert(id: number): Promise<void>;
  getAllActiveAlerts(): Promise<Alert[]>;

  // 사용자 설정
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined>;

  // 거래 로그
  createTradingLog(log: InsertTradingLog): Promise<TradingLog>;
  getTradingLogs(accountId: number, limit?: number): Promise<TradingLog[]>;

  // 조건식
  getConditionFormulas(userId: string): Promise<ConditionFormula[]>;
  getConditionFormula(id: number): Promise<ConditionFormula | undefined>;
  createConditionFormula(formula: InsertConditionFormula): Promise<ConditionFormula>;
  updateConditionFormula(id: number, updates: Partial<ConditionFormula>): Promise<ConditionFormula | undefined>;
  deleteConditionFormula(id: number): Promise<void>;

  // 조건식 결과
  getConditionResults(conditionId: number): Promise<ConditionResult[]>;
  createConditionResult(result: InsertConditionResult): Promise<ConditionResult>;
  deleteConditionResults(conditionId: number): Promise<void>;

  // 차트 수식
  getChartFormulas(userId: string): Promise<ChartFormula[]>;
  getChartFormula(id: number): Promise<ChartFormula | undefined>;
  createChartFormula(formula: InsertChartFormula): Promise<ChartFormula>;
  updateChartFormula(id: number, updates: Partial<ChartFormula>): Promise<ChartFormula | undefined>;
  deleteChartFormula(id: number): Promise<void>;

  // 관심종목 시그널
  getWatchlistSignals(watchlistId: number): Promise<WatchlistSignal[]>;
  createWatchlistSignal(signal: InsertWatchlistSignal): Promise<WatchlistSignal>;
  updateWatchlistSignal(id: number, updates: Partial<WatchlistSignal>): Promise<WatchlistSignal | undefined>;
  deleteWatchlistSignal(id: number): Promise<void>;

  // 재무 스냅샷
  getFinancialSnapshots(stockCode: string): Promise<FinancialSnapshot[]>;
  getFinancialSnapshot(stockCode: string, fiscalYear: number): Promise<FinancialSnapshot | undefined>;
  createFinancialSnapshot(snapshot: InsertFinancialSnapshot): Promise<FinancialSnapshot>;
  updateFinancialSnapshot(id: number, updates: Partial<FinancialSnapshot>): Promise<FinancialSnapshot | undefined>;

  // 장이슈 종목
  getMarketIssues(issueDate: string): Promise<MarketIssue[]>;
  getMarketIssuesByStock(stockCode: string): Promise<MarketIssue[]>;
  createMarketIssue(issue: InsertMarketIssue): Promise<MarketIssue>;
  deleteMarketIssues(issueDate: string): Promise<void>;

  // 자동매매 설정
  getAutoTradingSettings(modelId: number): Promise<AutoTradingSettings | undefined>;
  createAutoTradingSettings(settings: InsertAutoTradingSettings): Promise<AutoTradingSettings>;
  updateAutoTradingSettings(modelId: number, updates: Partial<AutoTradingSettings>): Promise<AutoTradingSettings | undefined>;

  // 매매 성과
  getTradingPerformance(modelId: number, limit?: number): Promise<TradingPerformance[]>;
  getTradingPerformanceByStock(modelId: number, stockCode: string): Promise<TradingPerformance | undefined>;
  createTradingPerformance(performance: InsertTradingPerformance): Promise<TradingPerformance>;
  updateTradingPerformance(id: number, updates: Partial<TradingPerformance>): Promise<TradingPerformance | undefined>;

  // AI 모델 스펙
  getAiModelSpecs(activeOnly?: boolean): Promise<AiModelSpec[]>;
  createAiModelSpec(spec: InsertAiModelSpec): Promise<AiModelSpec>;
  updateAiModelSpec(id: number, updates: Partial<AiModelSpec>): Promise<AiModelSpec | undefined>;

  // AI Council 세션
  getAiCouncilSessions(userId: string, limit?: number): Promise<AiCouncilSession[]>;
  createAiCouncilSession(session: InsertAiCouncilSession): Promise<AiCouncilSession>;

  // 타점 기록
  getEntryPoints(stockCode: string, limit?: number): Promise<EntryPoint[]>;
  createEntryPoint(entryPoint: InsertEntryPoint): Promise<EntryPoint>;

  // 학습 기록
  getLearningRecords(modelId: number, limit?: number): Promise<LearningRecord[]>;
  createLearningRecord(record: InsertLearningRecord): Promise<LearningRecord>;

  // 공시
  getCompanyFilings(stockCode: string, limit?: number): Promise<CompanyFiling[]>;
  upsertCompanyFiling(filing: InsertCompanyFiling): Promise<CompanyFiling>;

  // 뉴스(영속)
  getNewsArticles(stockCode: string, limit?: number): Promise<NewsArticleRecord[]>;
  upsertNewsArticle(article: InsertNewsArticleRecord): Promise<NewsArticleRecord>;

  // 분석 재료 스냅샷
  getAnalysisMaterialSnapshots(userId: string, stockCode: string, limit?: number): Promise<AnalysisMaterialSnapshot[]>;
  createAnalysisMaterialSnapshot(snapshot: InsertAnalysisMaterialSnapshot): Promise<AnalysisMaterialSnapshot>;

  // 키움 에이전트 작업 큐
  createKiwoomJob(job: InsertKiwoomJob): Promise<KiwoomJob>;
  getNextPendingJob(agentId: string, supportedJobTypes?: string[]): Promise<KiwoomJob | undefined>;
  updateKiwoomJobResult(id: number, status: string, result?: unknown, errorMessage?: string): Promise<KiwoomJob | undefined>;
  getKiwoomJobStatus(id: number, userId: string): Promise<KiwoomJob | undefined>;
  getRecentKiwoomJobsByUser(userId: string, limit?: number): Promise<KiwoomJob[]>;
  getKiwoomJobByIdInternal(id: number): Promise<KiwoomJob | undefined>;

  // 헬퍼
  getActiveAiModels(): Promise<AiModel[]>;

  // 데이터 정리
  deleteConditionResultsOlderThan(cutoffDate: Date): Promise<number>;
  deleteTradingLogsOlderThan(cutoffDate: Date): Promise<number>;
  deleteMarketIssuesOlderThan(cutoffDate: Date): Promise<number>;
  deleteFinancialSnapshotsOlderThan(cutoffDate: Date): Promise<number>;
  deleteTriggeredAlertsOlderThan(cutoffDate: Date): Promise<number>;
}
