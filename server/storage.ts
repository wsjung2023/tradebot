import {
  type User,
  type InsertUser,
  type KiwoomAccount,
  type InsertKiwoomAccount,
  type Holding,
  type InsertHolding,
  type Order,
  type InsertOrder,
  type AiModel,
  type InsertAiModel,
  type AiRecommendation,
  type InsertAiRecommendation,
  type WatchlistItem,
  type InsertWatchlistItem,
  type Alert,
  type InsertAlert,
  type UserSettings,
  type InsertUserSettings,
  type TradingLog,
  type InsertTradingLog,
  type ConditionFormula,
  type InsertConditionFormula,
  type ConditionResult,
  type InsertConditionResult,
  type ChartFormula,
  type InsertChartFormula,
  type WatchlistSignal,
  type InsertWatchlistSignal,
  type FinancialSnapshot,
  type InsertFinancialSnapshot,
  type MarketIssue,
  type InsertMarketIssue,
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByAuthProvider(provider: string, providerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Kiwoom Account methods
  getKiwoomAccounts(userId: string): Promise<KiwoomAccount[]>;
  getKiwoomAccount(id: number): Promise<KiwoomAccount | undefined>;
  createKiwoomAccount(account: InsertKiwoomAccount): Promise<KiwoomAccount>;
  updateKiwoomAccount(id: number, updates: Partial<KiwoomAccount>): Promise<KiwoomAccount | undefined>;
  deleteKiwoomAccount(id: number): Promise<void>;

  // Holdings methods
  getHoldings(accountId: number): Promise<Holding[]>;
  getHolding(id: number): Promise<Holding | undefined>;
  createHolding(holding: InsertHolding): Promise<Holding>;
  updateHolding(id: number, updates: Partial<Holding>): Promise<Holding | undefined>;
  deleteHolding(id: number): Promise<void>;
  getHoldingByStock(accountId: number, stockCode: string): Promise<Holding | undefined>;

  // Order methods
  getOrders(accountId: number, limit?: number): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, updates: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<void>;

  // AI Model methods
  getAiModels(userId: string): Promise<AiModel[]>;
  getAiModel(id: number): Promise<AiModel | undefined>;
  createAiModel(model: InsertAiModel): Promise<AiModel>;
  updateAiModel(id: number, updates: Partial<AiModel>): Promise<AiModel | undefined>;
  deleteAiModel(id: number): Promise<void>;

  // AI Recommendation methods
  getAiRecommendations(modelId: number, limit?: number): Promise<AiRecommendation[]>;
  createAiRecommendation(recommendation: InsertAiRecommendation): Promise<AiRecommendation>;
  updateAiRecommendation(id: number, updates: Partial<AiRecommendation>): Promise<AiRecommendation | undefined>;
  deleteAiRecommendation(id: number): Promise<void>;

  // Watchlist methods
  getWatchlist(userId: string): Promise<WatchlistItem[]>;
  createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem>;
  deleteWatchlistItem(id: number): Promise<void>;

  // Alert methods
  getAlerts(userId: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  updateAlert(id: number, updates: Partial<Alert>): Promise<Alert | undefined>;
  deleteAlert(id: number): Promise<void>;

  // User Settings methods
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined>;

  // Trading Log methods
  createTradingLog(log: InsertTradingLog): Promise<TradingLog>;
  getTradingLogs(accountId: number, limit?: number): Promise<TradingLog[]>;

  // Condition Formula methods (화면 0105)
  getConditionFormulas(userId: string): Promise<ConditionFormula[]>;
  getConditionFormula(id: number): Promise<ConditionFormula | undefined>;
  createConditionFormula(formula: InsertConditionFormula): Promise<ConditionFormula>;
  updateConditionFormula(id: number, updates: Partial<ConditionFormula>): Promise<ConditionFormula | undefined>;
  deleteConditionFormula(id: number): Promise<void>;

  // Condition Result methods (화면 0156)
  getConditionResults(conditionId: number): Promise<ConditionResult[]>;
  createConditionResult(result: InsertConditionResult): Promise<ConditionResult>;
  deleteConditionResults(conditionId: number): Promise<void>;

  // Chart Formula methods
  getChartFormulas(userId: string): Promise<ChartFormula[]>;
  getChartFormula(id: number): Promise<ChartFormula | undefined>;
  createChartFormula(formula: InsertChartFormula): Promise<ChartFormula>;
  updateChartFormula(id: number, updates: Partial<ChartFormula>): Promise<ChartFormula | undefined>;
  deleteChartFormula(id: number): Promise<void>;

  // Watchlist Signal methods (화면 0130)
  getWatchlistSignals(watchlistId: number): Promise<WatchlistSignal[]>;
  createWatchlistSignal(signal: InsertWatchlistSignal): Promise<WatchlistSignal>;
  updateWatchlistSignal(id: number, updates: Partial<WatchlistSignal>): Promise<WatchlistSignal | undefined>;
  deleteWatchlistSignal(id: number): Promise<void>;

  // Financial Snapshot methods (3년 재무 데이터)
  getFinancialSnapshots(stockCode: string): Promise<FinancialSnapshot[]>;
  getFinancialSnapshot(stockCode: string, fiscalYear: number): Promise<FinancialSnapshot | undefined>;
  createFinancialSnapshot(snapshot: InsertFinancialSnapshot): Promise<FinancialSnapshot>;
  updateFinancialSnapshot(id: number, updates: Partial<FinancialSnapshot>): Promise<FinancialSnapshot | undefined>;

  // Market Issue methods (시장이슈종목)
  getMarketIssues(issueDate: string): Promise<MarketIssue[]>;
  getMarketIssuesByStock(stockCode: string): Promise<MarketIssue[]>;
  createMarketIssue(issue: InsertMarketIssue): Promise<MarketIssue>;
  deleteMarketIssues(issueDate: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, User> = new Map();
  private usersByProvider: Map<string, User> = new Map();
  
  private kiwoomAccounts: Map<number, KiwoomAccount> = new Map();
  private holdings: Map<number, Holding> = new Map();
  private orders: Map<number, Order> = new Map();
  private aiModels: Map<number, AiModel> = new Map();
  private aiRecommendations: Map<number, AiRecommendation> = new Map();
  private watchlistItems: Map<number, WatchlistItem> = new Map();
  private alertsMap: Map<number, Alert> = new Map();
  private settings: Map<string, UserSettings> = new Map();
  private logs: Map<number, TradingLog> = new Map();
  
  private conditionFormulas: Map<number, ConditionFormula> = new Map();
  private conditionResults: Map<number, ConditionResult> = new Map();
  private chartFormulas: Map<number, ChartFormula> = new Map();
  private watchlistSignals: Map<number, WatchlistSignal> = new Map();
  private financialSnapshots: Map<number, FinancialSnapshot> = new Map();
  private marketIssues: Map<number, MarketIssue> = new Map();
  
  private nextAccountId = 1;
  private nextHoldingId = 1;
  private nextOrderId = 1;
  private nextModelId = 1;
  private nextRecommendationId = 1;
  private nextWatchlistId = 1;
  private nextAlertId = 1;
  private nextSettingsId = 1;
  private nextLogId = 1;
  private nextConditionFormulaId = 1;
  private nextConditionResultId = 1;
  private nextChartFormulaId = 1;
  private nextWatchlistSignalId = 1;
  private nextFinancialSnapshotId = 1;
  private nextMarketIssueId = 1;

  // ==================== User Methods ====================
  
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.usersByEmail.get(email);
  }

  async getUserByAuthProvider(provider: string, providerId: string): Promise<User | undefined> {
    const key = `${provider}:${providerId}`;
    return this.usersByProvider.get(key);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const user: User = {
      id,
      email: insertUser.email,
      password: insertUser.password || null,
      name: insertUser.name,
      authProvider: insertUser.authProvider || 'local',
      authProviderId: insertUser.authProviderId || null,
    };
    
    this.users.set(id, user);
    if (user.email) {
      this.usersByEmail.set(user.email, user);
    }
    if (user.authProvider && user.authProviderId) {
      const key = `${user.authProvider}:${user.authProviderId}`;
      this.usersByProvider.set(key, user);
    }
    
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const oldEmail = user.email;
    const oldProvider = user.authProvider && user.authProviderId ? `${user.authProvider}:${user.authProviderId}` : null;
    
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    
    if (oldEmail && oldEmail !== updated.email) {
      this.usersByEmail.delete(oldEmail);
    }
    if (updated.email) {
      this.usersByEmail.set(updated.email, updated);
    }
    
    if (oldProvider) {
      this.usersByProvider.delete(oldProvider);
    }
    if (updated.authProvider && updated.authProviderId) {
      const newKey = `${updated.authProvider}:${updated.authProviderId}`;
      this.usersByProvider.set(newKey, updated);
    }
    
    return updated;
  }

  // ==================== Kiwoom Account Methods ====================
  
  async getKiwoomAccounts(userId: string): Promise<KiwoomAccount[]> {
    return Array.from(this.kiwoomAccounts.values()).filter(acc => acc.userId === userId);
  }

  async getKiwoomAccount(id: number): Promise<KiwoomAccount | undefined> {
    return this.kiwoomAccounts.get(id);
  }

  async createKiwoomAccount(insertAccount: InsertKiwoomAccount): Promise<KiwoomAccount> {
    const id = this.nextAccountId++;
    const account: KiwoomAccount = {
      id,
      ...insertAccount,
    };
    this.kiwoomAccounts.set(id, account);
    return account;
  }

  async updateKiwoomAccount(id: number, updates: Partial<KiwoomAccount>): Promise<KiwoomAccount | undefined> {
    const account = this.kiwoomAccounts.get(id);
    if (!account) return undefined;
    
    const updated = { ...account, ...updates };
    this.kiwoomAccounts.set(id, updated);
    return updated;
  }

  async deleteKiwoomAccount(id: number): Promise<void> {
    this.kiwoomAccounts.delete(id);
  }

  // ==================== Holdings Methods ====================
  
  async getHoldings(accountId: number): Promise<Holding[]> {
    return Array.from(this.holdings.values()).filter(h => h.accountId === accountId);
  }

  async getHolding(id: number): Promise<Holding | undefined> {
    return this.holdings.get(id);
  }

  async createHolding(insertHolding: InsertHolding): Promise<Holding> {
    const id = this.nextHoldingId++;
    const holding: Holding = {
      id,
      ...insertHolding,
    };
    this.holdings.set(id, holding);
    return holding;
  }

  async updateHolding(id: number, updates: Partial<Holding>): Promise<Holding | undefined> {
    const holding = this.holdings.get(id);
    if (!holding) return undefined;
    
    const updated = { ...holding, ...updates };
    this.holdings.set(id, updated);
    return updated;
  }

  async deleteHolding(id: number): Promise<void> {
    this.holdings.delete(id);
  }

  async getHoldingByStock(accountId: number, stockCode: string): Promise<Holding | undefined> {
    return Array.from(this.holdings.values()).find(
      h => h.accountId === accountId && h.stockCode === stockCode
    );
  }

  // ==================== Order Methods ====================
  
  async getOrders(accountId: number, limit?: number): Promise<Order[]> {
    const filtered = Array.from(this.orders.values()).filter(o => o.accountId === accountId);
    return limit ? filtered.slice(0, limit) : filtered;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = this.nextOrderId++;
    const order: Order = {
      id,
      ...insertOrder,
      createdAt: new Date().toISOString(),
      executedQuantity: insertOrder.executedQuantity || 0,
      orderStatus: insertOrder.orderStatus || 'pending',
      executedAt: insertOrder.executedAt || null,
      executedPrice: insertOrder.executedPrice || null,
      orderNumber: insertOrder.orderNumber || null,
      isAutoTrading: insertOrder.isAutoTrading || false,
      aiModelId: insertOrder.aiModelId || null,
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrder(id: number, updates: Partial<Order>): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    const updated = { ...order, ...updates };
    this.orders.set(id, updated);
    return updated;
  }

  async deleteOrder(id: number): Promise<void> {
    this.orders.delete(id);
  }

  // ==================== AI Model Methods ====================
  
  async getAiModels(userId: string): Promise<AiModel[]> {
    return Array.from(this.aiModels.values()).filter(m => m.userId === userId);
  }

  async getAiModel(id: number): Promise<AiModel | undefined> {
    return this.aiModels.get(id);
  }

  async createAiModel(insertModel: InsertAiModel): Promise<AiModel> {
    const id = this.nextModelId++;
    const model: AiModel = {
      id,
      ...insertModel,
    };
    this.aiModels.set(id, model);
    return model;
  }

  async updateAiModel(id: number, updates: Partial<AiModel>): Promise<AiModel | undefined> {
    const model = this.aiModels.get(id);
    if (!model) return undefined;
    
    const updated = { ...model, ...updates };
    this.aiModels.set(id, updated);
    return updated;
  }

  async deleteAiModel(id: number): Promise<void> {
    this.aiModels.delete(id);
  }

  // ==================== AI Recommendation Methods ====================
  
  async getAiRecommendations(modelId: number, limit?: number): Promise<AiRecommendation[]> {
    const filtered = Array.from(this.aiRecommendations.values()).filter(r => r.modelId === modelId);
    return limit ? filtered.slice(0, limit) : filtered;
  }

  async createAiRecommendation(insertRecommendation: InsertAiRecommendation): Promise<AiRecommendation> {
    const id = this.nextRecommendationId++;
    const recommendation: AiRecommendation = {
      id,
      ...insertRecommendation,
    };
    this.aiRecommendations.set(id, recommendation);
    return recommendation;
  }

  async updateAiRecommendation(id: number, updates: Partial<AiRecommendation>): Promise<AiRecommendation | undefined> {
    const recommendation = this.aiRecommendations.get(id);
    if (!recommendation) return undefined;
    
    const updated = { ...recommendation, ...updates };
    this.aiRecommendations.set(id, updated);
    return updated;
  }

  async deleteAiRecommendation(id: number): Promise<void> {
    this.aiRecommendations.delete(id);
  }

  // ==================== Watchlist Methods ====================
  
  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    return Array.from(this.watchlistItems.values()).filter(w => w.userId === userId);
  }

  async createWatchlistItem(insertItem: InsertWatchlistItem): Promise<WatchlistItem> {
    const id = this.nextWatchlistId++;
    const item: WatchlistItem = {
      id,
      ...insertItem,
    };
    this.watchlistItems.set(id, item);
    return item;
  }

  async deleteWatchlistItem(id: number): Promise<void> {
    this.watchlistItems.delete(id);
  }

  // ==================== Alert Methods ====================
  
  async getAlerts(userId: string): Promise<Alert[]> {
    return Array.from(this.alertsMap.values()).filter(a => a.userId === userId);
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const id = this.nextAlertId++;
    const alert: Alert = {
      id,
      ...insertAlert,
    };
    this.alertsMap.set(id, alert);
    return alert;
  }

  async updateAlert(id: number, updates: Partial<Alert>): Promise<Alert | undefined> {
    const alert = this.alertsMap.get(id);
    if (!alert) return undefined;
    
    const updated = { ...alert, ...updates };
    this.alertsMap.set(id, updated);
    return updated;
  }

  async deleteAlert(id: number): Promise<void> {
    this.alertsMap.delete(id);
  }

  // ==================== User Settings Methods ====================
  
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    return this.settings.get(userId);
  }

  async createUserSettings(insertSettings: InsertUserSettings): Promise<UserSettings> {
    const settings: UserSettings = {
      id: this.nextSettingsId++,
      userId: insertSettings.userId,
      defaultAccountId: insertSettings.defaultAccountId || null,
      tradingMode: insertSettings.tradingMode || 'mock',
      autoTradingEnabled: insertSettings.autoTradingEnabled || false,
      riskLevel: insertSettings.riskLevel || 'medium',
      maxDailyLoss: insertSettings.maxDailyLoss || null,
      notificationSettings: insertSettings.notificationSettings || null,
      kiwoomAppKey: insertSettings.kiwoomAppKey || null,
      kiwoomAppSecret: insertSettings.kiwoomAppSecret || null,
      priceAlertEnabled: insertSettings.priceAlertEnabled !== undefined ? insertSettings.priceAlertEnabled : true,
      tradeAlertEnabled: insertSettings.tradeAlertEnabled !== undefined ? insertSettings.tradeAlertEnabled : true,
      theme: insertSettings.theme || 'light',
      updatedAt: new Date().toISOString(),
    };
    this.settings.set(insertSettings.userId, settings);
    return settings;
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    const current = this.settings.get(userId);
    if (!current) return undefined;
    
    const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
    this.settings.set(userId, updated);
    return updated;
  }

  // ==================== Trading Log Methods ====================
  
  async createTradingLog(insertLog: InsertTradingLog): Promise<TradingLog> {
    const id = this.nextLogId++;
    const log: TradingLog = {
      id,
      ...insertLog,
      createdAt: new Date().toISOString(),
      errorMessage: insertLog.errorMessage || null,
    };
    this.logs.set(id, log);
    return log;
  }

  async getTradingLogs(accountId: number, limit?: number): Promise<TradingLog[]> {
    const filtered = Array.from(this.logs.values()).filter(l => l.accountId === accountId);
    return limit ? filtered.slice(0, limit) : filtered;
  }

  // ==================== Condition Formula Methods ====================

  async getConditionFormulas(userId: string): Promise<ConditionFormula[]> {
    return Array.from(this.conditionFormulas.values()).filter(f => f.userId === userId);
  }

  async getConditionFormula(id: number): Promise<ConditionFormula | undefined> {
    return this.conditionFormulas.get(id);
  }

  async createConditionFormula(insertFormula: InsertConditionFormula): Promise<ConditionFormula> {
    const id = this.nextConditionFormulaId++;
    const formula: ConditionFormula = {
      id,
      userId: insertFormula.userId,
      conditionName: insertFormula.conditionName,
      description: insertFormula.description ?? null,
      formulaAst: insertFormula.formulaAst,
      rawFormula: insertFormula.rawFormula ?? null,
      marketType: insertFormula.marketType,
      isActive: insertFormula.isActive ?? false,
      isRealTimeMonitoring: insertFormula.isRealTimeMonitoring ?? false,
      matchCount: 0,
      lastMatchedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.conditionFormulas.set(id, formula);
    return formula;
  }

  async updateConditionFormula(id: number, updates: Partial<ConditionFormula>): Promise<ConditionFormula | undefined> {
    const formula = this.conditionFormulas.get(id);
    if (!formula) return undefined;

    const updated = { ...formula, ...updates, updatedAt: new Date() };
    this.conditionFormulas.set(id, updated);
    return updated;
  }

  async deleteConditionFormula(id: number): Promise<void> {
    this.conditionFormulas.delete(id);
  }

  // ==================== Condition Result Methods ====================

  async getConditionResults(conditionId: number): Promise<ConditionResult[]> {
    return Array.from(this.conditionResults.values()).filter(r => r.conditionId === conditionId);
  }

  async createConditionResult(insertResult: InsertConditionResult): Promise<ConditionResult> {
    const id = this.nextConditionResultId++;
    const result: ConditionResult = {
      id,
      conditionId: insertResult.conditionId,
      stockCode: insertResult.stockCode,
      stockName: insertResult.stockName,
      matchScore: insertResult.matchScore ?? null,
      currentPrice: insertResult.currentPrice ?? null,
      volume: insertResult.volume ?? null,
      changeRate: insertResult.changeRate ?? null,
      isMarketIssue: insertResult.isMarketIssue ?? false,
      hasGoodFinancials: insertResult.hasGoodFinancials ?? false,
      hasHighLiquidity: insertResult.hasHighLiquidity ?? false,
      passedFilters: insertResult.passedFilters ?? false,
      metadata: insertResult.metadata ?? null,
      createdAt: new Date(),
    };
    this.conditionResults.set(id, result);
    return result;
  }

  async deleteConditionResults(conditionId: number): Promise<void> {
    const toDelete = Array.from(this.conditionResults.entries())
      .filter(([_, result]) => result.conditionId === conditionId)
      .map(([id, _]) => id);
    
    toDelete.forEach(id => this.conditionResults.delete(id));
  }

  // ==================== Chart Formula Methods ====================

  async getChartFormulas(userId: string): Promise<ChartFormula[]> {
    return Array.from(this.chartFormulas.values()).filter(f => f.userId === userId);
  }

  async getChartFormula(id: number): Promise<ChartFormula | undefined> {
    return this.chartFormulas.get(id);
  }

  async createChartFormula(insertFormula: InsertChartFormula): Promise<ChartFormula> {
    const id = this.nextChartFormulaId++;
    const formula: ChartFormula = {
      id,
      userId: insertFormula.userId,
      formulaName: insertFormula.formulaName,
      formulaType: insertFormula.formulaType,
      description: insertFormula.description ?? null,
      formulaAst: insertFormula.formulaAst,
      rawFormula: insertFormula.rawFormula,
      outputType: insertFormula.outputType,
      color: insertFormula.color ?? null,
      lineWeight: insertFormula.lineWeight ?? 1,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.chartFormulas.set(id, formula);
    return formula;
  }

  async updateChartFormula(id: number, updates: Partial<ChartFormula>): Promise<ChartFormula | undefined> {
    const formula = this.chartFormulas.get(id);
    if (!formula) return undefined;

    const updated = { ...formula, ...updates, updatedAt: new Date() };
    this.chartFormulas.set(id, updated);
    return updated;
  }

  async deleteChartFormula(id: number): Promise<void> {
    this.chartFormulas.delete(id);
  }

  // ==================== Watchlist Signal Methods ====================

  async getWatchlistSignals(watchlistId: number): Promise<WatchlistSignal[]> {
    return Array.from(this.watchlistSignals.values()).filter(s => s.watchlistId === watchlistId);
  }

  async createWatchlistSignal(insertSignal: InsertWatchlistSignal): Promise<WatchlistSignal> {
    const id = this.nextWatchlistSignalId++;
    const signal: WatchlistSignal = {
      id,
      watchlistId: insertSignal.watchlistId,
      chartFormulaId: insertSignal.chartFormulaId ?? null,
      signalData: insertSignal.signalData,
      currentSignal: insertSignal.currentSignal ?? null,
      signalStrength: insertSignal.signalStrength ?? null,
      lastCalculatedAt: new Date(),
      updatedAt: new Date(),
    };
    this.watchlistSignals.set(id, signal);
    return signal;
  }

  async updateWatchlistSignal(id: number, updates: Partial<WatchlistSignal>): Promise<WatchlistSignal | undefined> {
    const signal = this.watchlistSignals.get(id);
    if (!signal) return undefined;

    const updated = { ...signal, ...updates, updatedAt: new Date() };
    this.watchlistSignals.set(id, updated);
    return updated;
  }

  async deleteWatchlistSignal(id: number): Promise<void> {
    this.watchlistSignals.delete(id);
  }

  // ==================== Financial Snapshot Methods ====================

  async getFinancialSnapshots(stockCode: string): Promise<FinancialSnapshot[]> {
    return Array.from(this.financialSnapshots.values()).filter(s => s.stockCode === stockCode);
  }

  async getFinancialSnapshot(stockCode: string, fiscalYear: number): Promise<FinancialSnapshot | undefined> {
    return Array.from(this.financialSnapshots.values()).find(
      s => s.stockCode === stockCode && s.fiscalYear === fiscalYear
    );
  }

  async createFinancialSnapshot(insertSnapshot: InsertFinancialSnapshot): Promise<FinancialSnapshot> {
    const id = this.nextFinancialSnapshotId++;
    const snapshot: FinancialSnapshot = {
      id,
      stockCode: insertSnapshot.stockCode,
      fiscalYear: insertSnapshot.fiscalYear,
      revenue: insertSnapshot.revenue ?? null,
      operatingProfit: insertSnapshot.operatingProfit ?? null,
      netIncome: insertSnapshot.netIncome ?? null,
      totalAssets: insertSnapshot.totalAssets ?? null,
      totalLiabilities: insertSnapshot.totalLiabilities ?? null,
      totalEquity: insertSnapshot.totalEquity ?? null,
      debtRatio: insertSnapshot.debtRatio ?? null,
      roe: insertSnapshot.roe ?? null,
      roa: insertSnapshot.roa ?? null,
      isHealthy: insertSnapshot.isHealthy ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.financialSnapshots.set(id, snapshot);
    return snapshot;
  }

  async updateFinancialSnapshot(id: number, updates: Partial<FinancialSnapshot>): Promise<FinancialSnapshot | undefined> {
    const snapshot = this.financialSnapshots.get(id);
    if (!snapshot) return undefined;

    const updated = { ...snapshot, ...updates };
    this.financialSnapshots.set(id, updated);
    return updated;
  }

  // ==================== Market Issue Methods ====================

  async getMarketIssues(issueDate: string): Promise<MarketIssue[]> {
    return Array.from(this.marketIssues.values()).filter(i => i.issueDate === issueDate);
  }

  async getMarketIssuesByStock(stockCode: string): Promise<MarketIssue[]> {
    return Array.from(this.marketIssues.values()).filter(i => i.stockCode === stockCode);
  }

  async createMarketIssue(insertIssue: InsertMarketIssue): Promise<MarketIssue> {
    const id = this.nextMarketIssueId++;
    const issue: MarketIssue = {
      id,
      issueDate: insertIssue.issueDate,
      stockCode: insertIssue.stockCode,
      stockName: insertIssue.stockName,
      issueType: insertIssue.issueType,
      issueTitle: insertIssue.issueTitle ?? null,
      issueDescription: insertIssue.issueDescription ?? null,
      impactLevel: insertIssue.impactLevel,
      relatedTheme: insertIssue.relatedTheme ?? null,
      createdAt: new Date(),
    };
    this.marketIssues.set(id, issue);
    return issue;
  }

  async deleteMarketIssues(issueDate: string): Promise<void> {
    const toDelete = Array.from(this.marketIssues.entries())
      .filter(([_, issue]) => issue.issueDate === issueDate)
      .map(([id, _]) => id);
    
    toDelete.forEach(id => this.marketIssues.delete(id));
  }
}

export const storage = new MemStorage();
