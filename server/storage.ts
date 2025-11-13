import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
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
  users,
  kiwoomAccounts,
  holdings,
  orders,
  aiModels,
  aiRecommendations,
  watchlist,
  alerts,
  userSettings,
  tradingLogs,
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
}

export class DbStorage implements IStorage {
  // ==================== User Methods ====================
  
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async getUserByAuthProvider(provider: string, providerId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(and(eq(users.authProvider, provider), eq(users.authProviderId, providerId)));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  // ==================== Kiwoom Account Methods ====================
  
  async getKiwoomAccounts(userId: string): Promise<KiwoomAccount[]> {
    return await db.select().from(kiwoomAccounts).where(eq(kiwoomAccounts.userId, userId));
  }

  async getKiwoomAccount(id: number): Promise<KiwoomAccount | undefined> {
    const result = await db.select().from(kiwoomAccounts).where(eq(kiwoomAccounts.id, id));
    return result[0];
  }

  async createKiwoomAccount(account: InsertKiwoomAccount): Promise<KiwoomAccount> {
    const result = await db.insert(kiwoomAccounts).values(account).returning();
    return result[0];
  }

  async updateKiwoomAccount(id: number, updates: Partial<KiwoomAccount>): Promise<KiwoomAccount | undefined> {
    const result = await db.update(kiwoomAccounts).set(updates).where(eq(kiwoomAccounts.id, id)).returning();
    return result[0];
  }

  async deleteKiwoomAccount(id: number): Promise<void> {
    await db.delete(kiwoomAccounts).where(eq(kiwoomAccounts.id, id));
  }

  // ==================== Holdings Methods ====================
  
  async getHoldings(accountId: number): Promise<Holding[]> {
    return await db.select().from(holdings).where(eq(holdings.accountId, accountId));
  }

  async getHolding(id: number): Promise<Holding | undefined> {
    const result = await db.select().from(holdings).where(eq(holdings.id, id));
    return result[0];
  }

  async createHolding(holding: InsertHolding): Promise<Holding> {
    const result = await db.insert(holdings).values(holding).returning();
    return result[0];
  }

  async updateHolding(id: number, updates: Partial<Holding>): Promise<Holding | undefined> {
    const result = await db.update(holdings).set(updates).where(eq(holdings.id, id)).returning();
    return result[0];
  }

  async deleteHolding(id: number): Promise<void> {
    await db.delete(holdings).where(eq(holdings.id, id));
  }

  async getHoldingByStock(accountId: number, stockCode: string): Promise<Holding | undefined> {
    const result = await db
      .select()
      .from(holdings)
      .where(and(eq(holdings.accountId, accountId), eq(holdings.stockCode, stockCode)));
    return result[0];
  }

  // ==================== Order Methods ====================
  
  async getOrders(accountId: number, limit: number = 100): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.accountId, accountId))
      .orderBy(desc(orders.createdAt))
      .limit(limit);
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values({
      ...order,
      orderStatus: 'pending',
    }).returning();
    return result[0];
  }

  async updateOrder(id: number, updates: Partial<Order>): Promise<Order | undefined> {
    const result = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
    return result[0];
  }

  async deleteOrder(id: number): Promise<void> {
    await db.delete(orders).where(eq(orders.id, id));
  }

  // ==================== AI Model Methods ====================
  
  async getAiModels(userId: string): Promise<AiModel[]> {
    return await db.select().from(aiModels).where(eq(aiModels.userId, userId));
  }

  async getAiModel(id: number): Promise<AiModel | undefined> {
    const result = await db.select().from(aiModels).where(eq(aiModels.id, id));
    return result[0];
  }

  async createAiModel(model: InsertAiModel): Promise<AiModel> {
    const result = await db.insert(aiModels).values(model).returning();
    return result[0];
  }

  async updateAiModel(id: number, updates: Partial<AiModel>): Promise<AiModel | undefined> {
    const result = await db.update(aiModels).set(updates).where(eq(aiModels.id, id)).returning();
    return result[0];
  }

  async deleteAiModel(id: number): Promise<void> {
    await db.delete(aiModels).where(eq(aiModels.id, id));
  }

  // ==================== AI Recommendation Methods ====================
  
  async getAiRecommendations(modelId: number, limit: number = 50): Promise<AiRecommendation[]> {
    return await db
      .select()
      .from(aiRecommendations)
      .where(eq(aiRecommendations.modelId, modelId))
      .orderBy(desc(aiRecommendations.createdAt))
      .limit(limit);
  }

  async createAiRecommendation(recommendation: InsertAiRecommendation): Promise<AiRecommendation> {
    const result = await db.insert(aiRecommendations).values(recommendation).returning();
    return result[0];
  }

  async updateAiRecommendation(id: number, updates: Partial<AiRecommendation>): Promise<AiRecommendation | undefined> {
    const result = await db.update(aiRecommendations).set(updates).where(eq(aiRecommendations.id, id)).returning();
    return result[0];
  }

  async deleteAiRecommendation(id: number): Promise<void> {
    await db.delete(aiRecommendations).where(eq(aiRecommendations.id, id));
  }

  // ==================== Watchlist Methods ====================
  
  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    return await db.select().from(watchlist).where(eq(watchlist.userId, userId));
  }

  async createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const result = await db.insert(watchlist).values(item).returning();
    return result[0];
  }

  async deleteWatchlistItem(id: number): Promise<void> {
    await db.delete(watchlist).where(eq(watchlist.id, id));
  }

  // ==================== Alert Methods ====================
  
  async getAlerts(userId: string): Promise<Alert[]> {
    return await db.select().from(alerts).where(eq(alerts.userId, userId));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const result = await db.insert(alerts).values(alert).returning();
    return result[0];
  }

  async updateAlert(id: number, updates: Partial<Alert>): Promise<Alert | undefined> {
    const result = await db.update(alerts).set(updates).where(eq(alerts.id, id)).returning();
    return result[0];
  }

  async deleteAlert(id: number): Promise<void> {
    await db.delete(alerts).where(eq(alerts.id, id));
  }

  // ==================== User Settings Methods ====================
  
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return result[0];
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const result = await db.insert(userSettings).values(settings).returning();
    return result[0];
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    const result = await db.update(userSettings).set(updates).where(eq(userSettings.userId, userId)).returning();
    return result[0];
  }

  // ==================== Trading Log Methods ====================
  
  async createTradingLog(log: InsertTradingLog): Promise<TradingLog> {
    const result = await db.insert(tradingLogs).values(log).returning();
    return result[0];
  }

  async getTradingLogs(accountId: number, limit: number = 100): Promise<TradingLog[]> {
    return await db
      .select()
      .from(tradingLogs)
      .where(eq(tradingLogs.accountId, accountId))
      .orderBy(desc(tradingLogs.createdAt))
      .limit(limit);
  }
}

export const storage = new DbStorage();
