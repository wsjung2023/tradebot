import { storage } from "../storage";
import { decrypt, isEncrypted } from "../utils/crypto";
import { normalizePriceHistoryAsc } from "../utils/chart-normalization";
import { createKiwoomService, type KiwoomService, type OrderRequest } from "./kiwoom";

type CachedService = {
  fingerprint: string;
  service: KiwoomService;
  lastUsed: number;
};

function toNumberString(value: unknown): string {
  if (value === null || value === undefined) return "0";
  return String(value).replace(/,/g, "").trim();
}

function safeDecrypt(val: string): string {
  return isEncrypted(val) ? decrypt(val) : val;
}

export class UserKiwoomService {
  private readonly MAX_CACHE = 50;
  private byUser = new Map<string, CachedService>();
  private byAccount = new Map<number, CachedService>();

  private evictOldCache(cache: Map<any, CachedService>) {
    if (cache.size <= this.MAX_CACHE) return;
    const entries = Array.from(cache.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    entries.slice(0, entries.length - this.MAX_CACHE).forEach(([k]) => cache.delete(k));
  }

  // user_settings 기반 서비스 (없으면 null)
  private async getServiceFromUserSettings(userId: string): Promise<KiwoomService | null> {
    const settings = await storage.getUserSettings(userId);
    if (!settings?.kiwoomAppKey || !settings?.kiwoomAppSecret) return null;

    const fingerprint = [settings.kiwoomAppKey, settings.kiwoomAppSecret, settings.tradingMode || "mock"].join(":");
    const cached = this.byUser.get(userId);
    if (cached?.fingerprint === fingerprint) {
      cached.lastUsed = Date.now();
      return cached.service;
    }

    const service = createKiwoomService({
      appKey: safeDecrypt(settings.kiwoomAppKey),
      appSecret: safeDecrypt(settings.kiwoomAppSecret),
      accountType: settings.tradingMode === "real" ? "real" : "mock",
    });
    this.byUser.set(userId, { fingerprint, service, lastUsed: Date.now() });
    this.evictOldCache(this.byUser);
    return service;
  }

  // 계좌 ID 기반 서비스 — DB 등록 키 사용, 없으면 null
  private async getServiceForAccount(accountId: number): Promise<KiwoomService | null> {
    const account = await storage.getKiwoomAccount(accountId);
    if (!account?.kiwoomAppKey || !account?.kiwoomAppSecret) return null;

    const fingerprint = account.kiwoomAppKey + ":" + account.kiwoomAppSecret;
    const cached = this.byAccount.get(accountId);
    if (cached?.fingerprint === fingerprint) {
      cached.lastUsed = Date.now();
      return cached.service;
    }

    const service = createKiwoomService({
      appKey: safeDecrypt(account.kiwoomAppKey),
      appSecret: safeDecrypt(account.kiwoomAppSecret),
      accountType: (account.accountType as "real" | "mock") || "real",
    });
    this.byAccount.set(accountId, { fingerprint, service, lastUsed: Date.now() });
    return service;
  }

  // 유저의 어떤 유효한 키든 반환 (시세/차트 등 계좌 무관 조회용). 없으면 throw.
  private async getAnyServiceForUser(userId: string): Promise<KiwoomService> {
    const fromSettings = await this.getServiceFromUserSettings(userId);
    if (fromSettings) return fromSettings;

    const accounts = await storage.getKiwoomAccounts(userId);
    for (const account of accounts) {
      if (account.kiwoomAppKey && account.kiwoomAppSecret) {
        const service = await this.getServiceForAccount(account.id);
        if (service) return service;
      }
    }

    throw new Error("API 키 미등록: 설정 > API 키에서 키움 API 키를 먼저 등록하세요.");
  }

  // 유저의 실계좌 키 반환 (조건검색 등 HTS 전용). 실계좌 없으면 아무 계좌 키로 시도.
  private async getRealServiceForUser(userId: string): Promise<KiwoomService> {
    const accounts = await storage.getKiwoomAccounts(userId);
    const realAccounts = (accounts as any[]).filter((a) => a.accountType === "real");
    for (const account of realAccounts) {
      if (account.kiwoomAppKey && account.kiwoomAppSecret) {
        const service = await this.getServiceForAccount(account.id);
        if (service) return service;
      }
    }
    return this.getAnyServiceForUser(userId);
  }

  invalidateAccountCache(accountId: number): void {
    this.byAccount.delete(accountId);
  }

  async getPrice(userId: string, stockCode: string) {
    const kiwoom = await this.getAnyServiceForUser(userId);
    const price = await kiwoom.getStockPrice(stockCode);
    const output = price?.output || {};
    return {
      stockCode,
      stockName: output.stck_nm || stockCode,
      currentPrice: output.stck_prpr || "0",
      changeRate: output.prdy_ctrt || "0",
      change: output.prdy_vrss || "0",
      volume: output.acml_vol || "0",
      high: output.stck_hgpr || "0",
      low: output.stck_lwpr || "0",
      open: output.stck_oprc || "0",
      output,
      raw: price,
    };
  }

  async getOrderbook(userId: string, stockCode: string) {
    const kiwoom = await this.getAnyServiceForUser(userId);
    return kiwoom.getStockOrderbook(stockCode);
  }

  async getChart(userId: string, stockCode: string, period: string = "D", count = 100) {
    const kiwoom = await this.getAnyServiceForUser(userId);
    return kiwoom.getStockChart(stockCode, period, count);
  }

  async searchStock(userId: string, keyword: string) {
    const kiwoom = await this.getAnyServiceForUser(userId);
    return kiwoom.searchStock(keyword);
  }

  async getStockInfo(userId: string, stockCode: string) {
    const kiwoom = await this.getAnyServiceForUser(userId);
    const [info, price] = await Promise.allSettled([
      kiwoom.getStockInfo(stockCode),
      kiwoom.getStockPrice(stockCode),
    ]);
    const infoValue = info.status === "fulfilled" ? info.value : null;
    const priceOutput = price.status === "fulfilled" ? price.value?.output || {} : {};
    return {
      stockCode,
      name: infoValue?.name || stockCode,
      marketName: infoValue?.marketName || "",
      state: infoValue?.state || "",
      currentPrice: priceOutput.stck_prpr || undefined,
      raw: infoValue?.raw || {},
    };
  }

  async getWatchlist(userId: string, stockCodes: string[]) {
    const kiwoom = await this.getAnyServiceForUser(userId);
    return kiwoom.getWatchlistInfo(stockCodes);
  }

  async getConditionList(userId: string) {
    const service = await this.getRealServiceForUser(userId);
    const response = await service.getConditionList();
    return response?.output ?? [];
  }

  async runCondition(userId: string, seq: string) {
    const service = await this.getRealServiceForUser(userId);
    const response = await service.getConditionSearchResults(seq, 0);
    return response?.output ?? [];
  }

  async getBalance(userId: string, accountNumber: string, accountType: "mock" | "real" = "real", accountId?: number) {
    if (!accountId) throw new Error("계좌 ID가 필요합니다.");
    const service = await this.getServiceForAccount(accountId);
    if (!service) throw new Error(`계좌 ${accountNumber}에 API 키가 등록되지 않았습니다. 계좌 설정에서 API 키를 등록하세요.`);
    return service.getAccountBalance(accountNumber, accountType);
  }

  async placeOrder(userId: string, orderRequest: OrderRequest, accountId?: number) {
    if (!accountId) throw new Error("계좌 ID가 필요합니다.");
    const service = await this.getServiceForAccount(accountId);
    if (!service) throw new Error("계좌에 API 키가 등록되지 않았습니다. 계좌 설정에서 API 키를 등록하세요.");
    return service.placeOrder(orderRequest);
  }

  async getFinancials(userId: string, stockCode: string) {
    const kiwoom = await this.getAnyServiceForUser(userId);
    return kiwoom.getFinancialStatements(stockCode);
  }

  normalizeChartForPriceHistory(chartData: any[]) {
    return normalizePriceHistoryAsc(chartData, 30);
  }

  normalizeConditionResult(result: any) {
    return {
      stockCode: result?.stock_code || result?.stck_cd || "",
      stockName: result?.stock_name || result?.stck_nm || "",
      currentPrice: toNumberString(result?.current_price || result?.stck_prpr),
      changeRate: toNumberString(result?.change_rate || result?.prdy_ctrt),
    };
  }
}

let userKiwoomServiceInstance: UserKiwoomService | null = null;

export function getUserKiwoomService() {
  if (!userKiwoomServiceInstance) {
    userKiwoomServiceInstance = new UserKiwoomService();
  }
  return userKiwoomServiceInstance;
}
