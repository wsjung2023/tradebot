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
  serial
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  config: jsonb("config").notNull(), // AI model parameters
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
}).omit({ id: true, updatedAt: true });

export const insertTradingLogSchema = createInsertSchema(tradingLogs).omit({ 
  id: true, 
  createdAt: true 
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
