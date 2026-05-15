import { storage } from "../storage";
import { decrypt, isEncrypted } from "../utils/crypto";
import { normalizePriceHistoryAsc } from "../utils/chart-normalization";
import { createKiwoomService, getKiwoomService, type KiwoomService, type OrderRequest } from "./kiwoom";

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
  private readonly MAX_LEGACY_CACHE = 50;
  private globalLegacyKiwoom = getKiwoomService();
  private legacyByUser = new Map<string, CachedService>();
  private byAccount = new Map<number, CachedService>(); // 계좌별 캐시

  private evictOldLegacyCache() {
    if (this.legacyByUser.size <= this.MAX_LEGACY_CACHE) return;
    const entries = Array.from(this.legacyByUser.entries())
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const toRemove = entries.slice(0, entries.length - this.MAX_LEGACY_CACHE);
    for (const [userId] of toRemove) {
      this.legacyByUser.delete(userId);
    }
  }

  private async getLegacyServiceForUser(userId: string): Promise<KiwoomService> {
    const settings = await storage.getUserSettings(userId);
    const hasUserKeys = !!settings?.kiwoomAppKey && !!settings?.kiwoomAppSecret;

    if (!hasUserKeys) {
      this.legacyByUser.delete(userId);
      return this.globalLegacyKiwoom;
    }

    const fingerprint = [
      settings!.kiwoomAppKey,
      settings!.kiwoomAppSecret,
      settings!.tradingMode || "mock",
    ].join(":");

    const cached = this.legacyByUser.get(userId);
    if (cached?.fingerprint === fingerprint) {
      cached.lastUsed = Date.now();
      return cached.service;
    }

    const service = createKiwoomService({
      appKey: decrypt(settings!.kiwoomAppKey!),
      appSecret: decrypt(settings!.kiwoomAppSecret!),
      accountType: settings!.tradingMode === "real" ? "real" : "mock",
    });
    this.legacyByUser.set(userId, { fingerprint, service, lastUsed: Date.now() });
    this.evictOldLegacyCache();
    return service;
  }

  // 계좌별 전용 서비스 — DB에 등록된 키가 있으면 사용, 없으면 null
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

  invalidateAccountCache(accountId: number): void {
    this.byAccount.delete(accountId);
  }

  // 실계좌 전용 서비스 (KIWOOM_APP_KEY_REAL) — 모의키로 실서버 인증 방지
  private realAccountService: KiwoomService | null = null;
  private getRealAccountService(): KiwoomService {
    if (!this.realAccountService) {
      const appKey = process.env.KIWOOM_APP_KEY_REAL || process.env.KIWOOM_APP_KEY || "stub";
      const appSecret = process.env.KIWOOM_APP_SECRET_REAL || process.env.KIWOOM_APP_SECRET || "stub";
      this.realAccountService = createKiwoomService({ appKey, appSecret, accountType: "real" });
    }
    return this.realAccountService;
  }

  async getPrice(userId: string, stockCode: string) {
    const kiwoom = await this.getLegacyServiceForUser(userId);
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
    const kiwoom = await this.getLegacyServiceForUser(userId);
    return kiwoom.getStockOrderbook(stockCode);
  }

  async getChart(userId: string, stockCode: string, period: string = "D", count = 100) {
    const kiwoom = await this.getLegacyServiceForUser(userId);
    return kiwoom.getStockChart(stockCode, period, count);
  }

  async searchStock(userId: string, keyword: string) {
    const kiwoom = await this.getLegacyServiceForUser(userId);
    return kiwoom.searchStock(keyword);
  }

  async getStockInfo(userId: string, stockCode: string) {
    const kiwoom = await this.getLegacyServiceForUser(userId);
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
    };
  }

  async getWatchlist(userId: string, stockCodes: string[]) {
    const kiwoom = await this.getLegacyServiceForUser(userId);
    return kiwoom.getWatchlistInfo(stockCodes);
  }

  async getConditionList(userId: string) {
    // 조건식은 HTS 실계좌 기준 → 항상 실계좌 WS 사용
    const response = await this.getRealAccountService().getConditionList();
    return response?.output ?? [];
  }

  async runCondition(userId: string, seq: string) {
    // 조건식은 HTS 실계좌 기준 → 항상 실계좌 WS 사용
    const response = await this.getRealAccountService().getConditionSearchResults(seq, 0);
    return response?.output ?? [];
  }

  async getBalance(userId: string, accountNumber: string, accountType: "mock" | "real" = "real", accountId?: number) {
    // 계좌별 키가 등록되어 있으면 우선 사용
    if (accountId) {
      const accountService = await this.getServiceForAccount(accountId);
      if (accountService) return accountService.getAccountBalance(accountNumber, accountType);
    }
    if (accountType === "real") {
      return this.getRealAccountService().getAccountBalance(accountNumber, "real");
    }
    const kiwoom = await this.getLegacyServiceForUser(userId);
    return kiwoom.getAccountBalance(accountNumber, accountType);
  }

  async placeOrder(userId: string, orderRequest: OrderRequest, accountId?: number) {
    // 계좌별 키가 등록되어 있으면 우선 사용
    if (accountId) {
      const accountService = await this.getServiceForAccount(accountId);
      if (accountService) return accountService.placeOrder(orderRequest);
    }
    const kiwoom = await this.getLegacyServiceForUser(userId);
    return kiwoom.placeOrder(orderRequest);
  }

  async getFinancials(userId: string, stockCode: string) {
    const kiwoom = await this.getLegacyServiceForUser(userId);
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
