import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  timestamp, 
  integer, 
  decimal, 
  boolean, 
  jsonb,
  json,
  serial
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session table - managed by express-session (connect-pg-simple)
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6, mode: 'date' }).notNull(),
});

// Users table - supports multiple auth providers
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"), // null for OAuth users
  name: text("name"),
  profileImage: text("profile_image"),
  authProvider: text("auth_provider").notNull().default('local'), // 'local', 'google', 'kakao', 'naver'
  authProviderId: text("auth_provider_id"), // ID from OAuth provider
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Kiwoom account configuration
export const kiwoomAccounts = pgTable("kiwoom_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountNumber: text("account_number").notNull(),
  accountType: text("account_type").notNull(), // 'mock' or 'real'
  accountName: text("account_name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Portfolio holdings
export const holdings = pgTable("holdings", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => kiwoomAccounts.id, { onDelete: 'cascade' }),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  quantity: integer("quantity").notNull(),
  averagePrice: decimal("average_price", { precision: 12, scale: 2 }).notNull(),
  currentPrice: decimal("current_price", { precision: 12, scale: 2 }),
  profitLoss: decimal("profit_loss", { precision: 12, scale: 2 }),
  profitLossRate: decimal("profit_loss_rate", { precision: 8, scale: 4 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Orders history
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => kiwoomAccounts.id, { onDelete: 'cascade' }),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  orderType: text("order_type").notNull(), // 'buy' or 'sell'
  orderMethod: text("order_method").notNull(), // 'market', 'limit', 'conditional'
  orderPrice: decimal("order_price", { precision: 12, scale: 2 }),
  orderQuantity: integer("order_quantity").notNull(),
  executedQuantity: integer("executed_quantity").notNull().default(0),
  executedPrice: decimal("executed_price", { precision: 12, scale: 2 }),
  orderStatus: text("order_status").notNull(), // 'pending', 'partial', 'completed', 'cancelled'
  orderNumber: text("order_number"), // from Kiwoom API
  isAutoTrading: boolean("is_auto_trading").notNull().default(false),
  aiModelId: integer("ai_model_id").references(() => aiModels.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  executedAt: timestamp("executed_at"),
});

// AI trading models/strategies
export const aiModels = pgTable("ai_models", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  modelName: text("model_name").notNull(),
  modelType: text("model_type").notNull(), // 'momentum', 'value', 'technical', 'custom'
  description: text("description"),
  config: jsonb("config").notNull().default({}), // AI model parameters
  isActive: boolean("is_active").notNull().default(false),
  performance: jsonb("performance"), // backtesting results
  totalTrades: integer("total_trades").notNull().default(0),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }),
  totalReturn: decimal("total_return", { precision: 8, scale: 4 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// AI recommendations
export const aiRecommendations = pgTable("ai_recommendations", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull().references(() => aiModels.id, { onDelete: 'cascade' }),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  action: text("action").notNull(), // 'buy', 'sell', 'hold'
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
  targetPrice: decimal("target_price", { precision: 12, scale: 2 }),
  reasoning: text("reasoning"),
  indicators: jsonb("indicators"), // technical indicators used
  isExecuted: boolean("is_executed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// Watchlist
export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  targetPrice: decimal("target_price", { precision: 12, scale: 2 }),
  alertEnabled: boolean("alert_enabled").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Price alerts
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  alertType: text("alert_type").notNull(), // 'price_above', 'price_below', 'volume_spike', 'ai_signal'
  targetValue: decimal("target_value", { precision: 12, scale: 2 }),
  isTriggered: boolean("is_triggered").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  triggeredAt: timestamp("triggered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// System settings
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  defaultAccountId: integer("default_account_id").references(() => kiwoomAccounts.id),
  tradingMode: text("trading_mode").notNull().default('mock'), // 'mock' or 'real'
  autoTradingEnabled: boolean("auto_trading_enabled").notNull().default(false),
  riskLevel: text("risk_level").notNull().default('medium'), // 'low', 'medium', 'high'
  maxDailyLoss: decimal("max_daily_loss", { precision: 12, scale: 2 }),
  notificationSettings: jsonb("notification_settings"),
  kiwoomAppKey: text("kiwoom_app_key"), // Encrypted
  kiwoomAppSecret: text("kiwoom_app_secret"), // Encrypted
  priceAlertEnabled: boolean("price_alert_enabled").notNull().default(true),
  tradeAlertEnabled: boolean("trade_alert_enabled").notNull().default(true),
  theme: text("theme").notNull().default('light'),
  aiModel: text("ai_model").notNull().default('gpt-5.1'), // 'gpt-5.1', 'gpt-5.1-chat-latest', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o'
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Trading logs for audit
export const tradingLogs = pgTable("trading_logs", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => kiwoomAccounts.id, { onDelete: 'cascade' }),
  action: text("action").notNull(),
  details: jsonb("details").notNull(),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==================== Condition Search System ====================

// Condition formulas (화면 0105 - 조건검색 식)
export const conditionFormulas = pgTable("condition_formulas", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  conditionName: text("condition_name").notNull(),
  description: text("description"),
  formulaAst: jsonb("formula_ast").notNull().default({}), // Parsed formula AST: (A and B) or (C and D) and E...
  rawFormula: text("raw_formula"), // Original formula text
  marketType: text("market_type").notNull().default('ALL'), // 'ALL', 'KOSPI', 'KOSDAQ', 'KONEX'
  isActive: boolean("is_active").notNull().default(false),
  isRealTimeMonitoring: boolean("is_real_time_monitoring").notNull().default(false),
  matchCount: integer("match_count").notNull().default(0),
  lastMatchedAt: timestamp("last_matched_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Condition results - latest matches from real-time screening (화면 0156)
export const conditionResults = pgTable("condition_results", {
  id: serial("id").primaryKey(),
  conditionId: integer("condition_id").notNull().references(() => conditionFormulas.id, { onDelete: 'cascade' }),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  matchScore: decimal("match_score", { precision: 5, scale: 2 }), // 0-100 confidence
  currentPrice: decimal("current_price", { precision: 12, scale: 2 }),
  volume: integer("volume"),
  changeRate: decimal("change_rate", { precision: 8, scale: 4 }),
  isMarketIssue: boolean("is_market_issue").notNull().default(false), // 시장이슈종목
  hasGoodFinancials: boolean("has_good_financials").notNull().default(false), // 3년 재무 양호
  hasHighLiquidity: boolean("has_high_liquidity").notNull().default(false), // 유동성 양호
  passedFilters: boolean("passed_filters").notNull().default(false), // All filters passed
  metadata: jsonb("metadata"), // Additional technical indicators
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Chart formulas (차트 수식 관리자)
export const chartFormulas = pgTable("chart_formulas", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  formulaName: text("formula_name").notNull(),
  formulaType: text("formula_type").notNull(), // 'indicator', 'signal', 'condition'
  description: text("description"),
  formulaAst: jsonb("formula_ast").notNull().default({}), // Parsed formula AST
  rawFormula: text("raw_formula").notNull(), // e.g., "CL=valuewhen((highest(h(1).period)<highest(h.period))..."
  outputType: text("output_type").notNull().default('line'), // 'line', 'bar', 'signal'
  color: text("color"), // For 7-color system: red, orange, yellow, green, blue, indigo, violet
  lineWeight: integer("line_weight").notNull().default(1),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Watchlist signals - stores 7-color indicator states for each stock (화면 0130)
export const watchlistSignals = pgTable("watchlist_signals", {
  id: serial("id").primaryKey(),
  watchlistId: integer("watchlist_id").notNull().references(() => watchlist.id, { onDelete: 'cascade' }),
  chartFormulaId: integer("chart_formula_id").references(() => chartFormulas.id),
  signalData: jsonb("signal_data").notNull().default({}), // Time-series data for 7 signal lines
  currentSignal: text("current_signal"), // Current buy/sell signal
  signalStrength: decimal("signal_strength", { precision: 5, scale: 2 }), // 0-100
  lastCalculatedAt: timestamp("last_calculated_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Financial snapshots - 3-year financial data cache
export const financialSnapshots = pgTable("financial_snapshots", {
  id: serial("id").primaryKey(),
  stockCode: text("stock_code").notNull(),
  fiscalYear: integer("fiscal_year").notNull(),
  revenue: decimal("revenue", { precision: 16, scale: 2 }),
  operatingProfit: decimal("operating_profit", { precision: 16, scale: 2 }),
  netIncome: decimal("net_income", { precision: 16, scale: 2 }),
  totalAssets: decimal("total_assets", { precision: 16, scale: 2 }),
  totalLiabilities: decimal("total_liabilities", { precision: 16, scale: 2 }),
  totalEquity: decimal("total_equity", { precision: 16, scale: 2 }),
  debtRatio: decimal("debt_ratio", { precision: 8, scale: 4 }),
  roe: decimal("roe", { precision: 8, scale: 4 }), // Return on Equity
  roa: decimal("roa", { precision: 8, scale: 4 }), // Return on Assets
  isHealthy: boolean("is_healthy").notNull().default(true), // Overall health flag
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Market issues - daily market issue tracking (시장이슈종목)
export const marketIssues = pgTable("market_issues", {
  id: serial("id").primaryKey(),
  issueDate: text("issue_date").notNull(), // YYYYMMDD
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  issueType: text("issue_type").notNull(), // 'news', 'theme', 'volume', 'price', 'sector'
  issueTitle: text("issue_title"),
  issueDescription: text("issue_description"),
  impactLevel: text("impact_level").notNull().default('medium'), // 'low', 'medium', 'high'
  relatedTheme: text("related_theme"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==================== Auto Trading System ====================

// Auto trading settings - customizable trading parameters per AI model
export const autoTradingSettings = pgTable("auto_trading_settings", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull().unique().references(() => aiModels.id, { onDelete: 'cascade' }),
  
  // Position sizing
  defaultPositionSize: decimal("default_position_size", { precision: 12, scale: 2 }).notNull().default('1000000'), // 100만원
  maxPositionSize: decimal("max_position_size", { precision: 12, scale: 2 }).notNull().default('10000000'), // 1000만원
  maxDailyTrades: integer("max_daily_trades").notNull().default(5),
  
  // 10-line rainbow chart settings (10% intervals from peak)
  rainbowLineSettings: jsonb("rainbow_line_settings").notNull().default([]), // Array of 10 objects: { line: 10-100, buyWeight: 0-100, sellWeight: 0-100 }
  centerBuyLine: integer("center_buy_line").notNull().default(50), // 50% = primary buy zone
  
  // Entry/Exit conditions
  minAiConfidence: decimal("min_ai_confidence", { precision: 5, scale: 2 }).notNull().default('70'), // 70%
  requireGoodFinancials: boolean("require_good_financials").notNull().default(true),
  requireHighLiquidity: boolean("require_high_liquidity").notNull().default(true),
  requireMarketIssue: boolean("require_market_issue").notNull().default(false),
  
  // AI analysis weights
  themeWeight: decimal("theme_weight", { precision: 5, scale: 2 }).notNull().default('20'),
  newsWeight: decimal("news_weight", { precision: 5, scale: 2 }).notNull().default('15'),
  financialsWeight: decimal("financials_weight", { precision: 5, scale: 2 }).notNull().default('25'),
  liquidityWeight: decimal("liquidity_weight", { precision: 5, scale: 2 }).notNull().default('20'),
  institutionalWeight: decimal("institutional_weight", { precision: 5, scale: 2 }).notNull().default('20'),
  
  // Dynamic exit adjustment
  enableDynamicExit: boolean("enable_dynamic_exit").notNull().default(true),
  stalePeriodDays: integer("stale_period_days").notNull().default(5), // Lower exit if held > 5 days
  surgeThreshold: decimal("surge_threshold", { precision: 5, scale: 2 }).notNull().default('10'), // Raise exit if +10% surge
  volumeSpikeMultiplier: decimal("volume_spike_multiplier", { precision: 5, scale: 2 }).notNull().default('3'), // 3x volume
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Trading performance - learning data for strategy improvement
export const tradingPerformance = pgTable("trading_performance", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull().references(() => aiModels.id, { onDelete: 'cascade' }),
  orderId: integer("order_id").references(() => orders.id),
  
  // Trade details
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  entryPrice: decimal("entry_price", { precision: 12, scale: 2 }).notNull(),
  exitPrice: decimal("exit_price", { precision: 12, scale: 2 }),
  quantity: integer("quantity").notNull(),
  
  // Performance metrics
  profitLoss: decimal("profit_loss", { precision: 12, scale: 2 }),
  profitLossRate: decimal("profit_loss_rate", { precision: 8, scale: 4 }),
  holdingDays: integer("holding_days"),
  isWin: boolean("is_win"),
  
  // Entry context
  entryRainbowLine: integer("entry_rainbow_line"), // Which line triggered entry (10-100)
  entryAiConfidence: decimal("entry_ai_confidence", { precision: 5, scale: 2 }),
  entryConditions: jsonb("entry_conditions"), // Snapshot of conditions at entry
  
  // Exit context
  exitReason: text("exit_reason"), // 'target', 'stoploss', 'dynamic_lower', 'dynamic_higher', 'timeout'
  exitRainbowLine: integer("exit_rainbow_line"),
  exitConditions: jsonb("exit_conditions"),
  
  // Learning data
  themeScore: decimal("theme_score", { precision: 5, scale: 2 }),
  newsScore: decimal("news_score", { precision: 5, scale: 2 }),
  financialsScore: decimal("financials_score", { precision: 5, scale: 2 }),
  liquidityScore: decimal("liquidity_score", { precision: 5, scale: 2 }),
  institutionalScore: decimal("institutional_score", { precision: 5, scale: 2 }),
  
  entryTime: timestamp("entry_time").notNull().defaultNow(),
  exitTime: timestamp("exit_time"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==================== Insert Schemas ====================

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  password: z.string().min(8).optional(),
  name: z.string().optional(),
}).omit({ id: true, createdAt: true });

export const insertKiwoomAccountSchema = createInsertSchema(kiwoomAccounts, {
  accountNumber: z.string().min(1),
  accountType: z.enum(['mock', 'real']),
}).omit({ id: true, createdAt: true });

export const insertHoldingSchema = createInsertSchema(holdings).omit({ 
  id: true, 
  updatedAt: true 
});

export const insertOrderSchema = createInsertSchema(orders, {
  stockCode: z.string().min(1),
  orderType: z.enum(['buy', 'sell']),
  orderMethod: z.enum(['market', 'limit', 'conditional']),
  orderQuantity: z.number().int().positive(),
  orderPrice: z.union([z.string(), z.number()]).optional().transform(val => 
    val !== undefined && val !== null ? String(val) : undefined
  ),
}).omit({ 
  id: true, 
  createdAt: true, 
  executedAt: true,
  executedQuantity: true,
  orderStatus: true 
});

export const insertAiModelSchema = createInsertSchema(aiModels, {
  modelName: z.string().min(1),
  modelType: z.enum(['momentum', 'value', 'technical', 'custom']),
  config: z.any(),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  totalTrades: true 
});

export const updateAiModelSchema = z.object({
  modelName: z.string().min(1).optional(),
  description: z.string().optional(),
  config: z.any().optional(),
  isActive: z.boolean().optional(),
});

export const insertAiRecommendationSchema = createInsertSchema(aiRecommendations, {
  action: z.enum(['buy', 'sell', 'hold']),
  confidence: z.string().or(z.number()),
}).omit({ 
  id: true, 
  createdAt: true,
  isExecuted: true 
});

export const insertWatchlistSchema = createInsertSchema(watchlist, {
  stockCode: z.string().min(1),
  stockName: z.string().min(1),
}).omit({ id: true, createdAt: true });

export const insertAlertSchema = createInsertSchema(alerts, {
  alertType: z.enum(['price_above', 'price_below', 'volume_spike', 'ai_signal']),
}).omit({ 
  id: true, 
  createdAt: true,
  isTriggered: true,
  triggeredAt: true 
});

export const insertUserSettingsSchema = createInsertSchema(userSettings, {
  tradingMode: z.enum(['mock', 'real']),
  riskLevel: z.enum(['low', 'medium', 'high']),
  aiModel: z.enum(['gpt-5.1', 'gpt-5.1-chat-latest', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o']),
}).omit({ id: true, updatedAt: true });

export const insertTradingLogSchema = createInsertSchema(tradingLogs).omit({ 
  id: true, 
  createdAt: true 
});

export const insertConditionFormulaSchema = createInsertSchema(conditionFormulas, {
  conditionName: z.string().min(1),
  formulaAst: z.any(),
  marketType: z.enum(['ALL', 'KOSPI', 'KOSDAQ', 'KONEX']),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  matchCount: true,
  lastMatchedAt: true
});

export const insertConditionResultSchema = createInsertSchema(conditionResults).omit({ 
  id: true, 
  createdAt: true 
});

export const insertChartFormulaSchema = createInsertSchema(chartFormulas, {
  formulaName: z.string().min(1),
  formulaType: z.enum(['indicator', 'signal', 'condition']),
  formulaAst: z.any(),
  rawFormula: z.string().min(1),
  outputType: z.enum(['line', 'bar', 'signal']),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  version: true
});

export const insertWatchlistSignalSchema = createInsertSchema(watchlistSignals, {
  signalData: z.any(),
}).omit({ 
  id: true, 
  lastCalculatedAt: true,
  updatedAt: true 
});

export const insertFinancialSnapshotSchema = createInsertSchema(financialSnapshots, {
  stockCode: z.string().min(1),
  fiscalYear: z.number().int().min(2000),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertMarketIssueSchema = createInsertSchema(marketIssues, {
  issueDate: z.string().regex(/^\d{8}$/),
  stockCode: z.string().min(1),
  issueType: z.enum(['news', 'theme', 'volume', 'price', 'sector']),
  impactLevel: z.enum(['low', 'medium', 'high']),
}).omit({ 
  id: true, 
  createdAt: true 
});

export const insertAutoTradingSettingsSchema = createInsertSchema(autoTradingSettings, {
  modelId: z.number().int().positive(),
  rainbowLineSettings: z.any(),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertTradingPerformanceSchema = createInsertSchema(tradingPerformance, {
  modelId: z.number().int().positive(),
  stockCode: z.string().min(1),
}).omit({ 
  id: true, 
  createdAt: true,
  entryTime: true 
});

// ==================== Type Exports ====================

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type KiwoomAccount = typeof kiwoomAccounts.$inferSelect;
export type InsertKiwoomAccount = z.infer<typeof insertKiwoomAccountSchema>;

export type Holding = typeof holdings.$inferSelect;
export type InsertHolding = z.infer<typeof insertHoldingSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type AiModel = typeof aiModels.$inferSelect;
export type InsertAiModel = z.infer<typeof insertAiModelSchema>;

export type AiRecommendation = typeof aiRecommendations.$inferSelect;
export type InsertAiRecommendation = z.infer<typeof insertAiRecommendationSchema>;

export type WatchlistItem = typeof watchlist.$inferSelect;
export type InsertWatchlistItem = z.infer<typeof insertWatchlistSchema>;

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;

export type TradingLog = typeof tradingLogs.$inferSelect;
export type InsertTradingLog = z.infer<typeof insertTradingLogSchema>;

export type ConditionFormula = typeof conditionFormulas.$inferSelect;
export type InsertConditionFormula = z.infer<typeof insertConditionFormulaSchema>;

export type ConditionResult = typeof conditionResults.$inferSelect;
export type InsertConditionResult = z.infer<typeof insertConditionResultSchema>;

export type ChartFormula = typeof chartFormulas.$inferSelect;
export type InsertChartFormula = z.infer<typeof insertChartFormulaSchema>;

export type WatchlistSignal = typeof watchlistSignals.$inferSelect;
export type InsertWatchlistSignal = z.infer<typeof insertWatchlistSignalSchema>;

export type FinancialSnapshot = typeof financialSnapshots.$inferSelect;
export type InsertFinancialSnapshot = z.infer<typeof insertFinancialSnapshotSchema>;

export type MarketIssue = typeof marketIssues.$inferSelect;
export type InsertMarketIssue = z.infer<typeof insertMarketIssueSchema>;

export type AutoTradingSettings = typeof autoTradingSettings.$inferSelect;
export type InsertAutoTradingSettings = z.infer<typeof insertAutoTradingSettingsSchema>;

export type TradingPerformance = typeof tradingPerformance.$inferSelect;
export type InsertTradingPerformance = z.infer<typeof insertTradingPerformanceSchema>;
