import { storage } from "../storage";
import { decrypt } from "../utils/crypto";
import { callViaAgent, AgentTimeoutError } from "./agent-proxy.service";
import { createKiwoomService, getKiwoomService, type KiwoomService } from "./kiwoom";

type CachedLegacyService = {
  fingerprint: string;
  service: KiwoomService;
};

function toNumberString(value: unknown): string {
  if (value === null || value === undefined) return "0";
  return String(value).replace(/,/g, "").trim();
}

export class UserKiwoomService {
  private globalLegacyKiwoom = getKiwoomService();
  private legacyByUser = new Map<string, CachedLegacyService>();

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
      return cached.service;
    }

    const service = createKiwoomService({
      appKey: decrypt(settings!.kiwoomAppKey!),
      appSecret: decrypt(settings!.kiwoomAppSecret!),
      accountType: settings!.tradingMode === "real" ? "real" : "mock",
    });
    this.legacyByUser.set(userId, { fingerprint, service });
    return service;
  }

  async getPrice(userId: string, stockCode: string) {
    try {
      return await callViaAgent(userId, "price.get", { stockCode });
    } catch (error) {
      if (error instanceof AgentTimeoutError) throw error;
      const legacyKiwoom = await this.getLegacyServiceForUser(userId);
      const price = await legacyKiwoom.getStockPrice(stockCode);
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
  }

  async getOrderbook(userId: string, stockCode: string) {
    try {
      return await callViaAgent(userId, "orderbook.get", { stockCode });
    } catch (error) {
      if (error instanceof AgentTimeoutError) throw error;
      const legacyKiwoom = await this.getLegacyServiceForUser(userId);
      return legacyKiwoom.getStockOrderbook(stockCode);
    }
  }

  async getChart(userId: string, stockCode: string, period: string = "D", count = 100) {
    try {
      return await callViaAgent(userId, "chart.get", { stockCode, period, count });
    } catch (error) {
      if (error instanceof AgentTimeoutError) throw error;
      const legacyKiwoom = await this.getLegacyServiceForUser(userId);
      return legacyKiwoom.getStockChart(stockCode, period, count);
    }
  }

  async searchStock(userId: string, keyword: string) {
    try {
      return await callViaAgent(userId, "stock.search", { keyword });
    } catch (error) {
      if (error instanceof AgentTimeoutError) throw error;
      const legacyKiwoom = await this.getLegacyServiceForUser(userId);
      return legacyKiwoom.searchStock(keyword);
    }
  }

  async getStockInfo(userId: string, stockCode: string) {
    try {
      return await callViaAgent(userId, "stock.info", { stockCode });
    } catch (error) {
      if (error instanceof AgentTimeoutError) throw error;
      const legacyKiwoom = await this.getLegacyServiceForUser(userId);
      const [info, price] = await Promise.allSettled([
        legacyKiwoom.getStockInfo(stockCode),
        legacyKiwoom.getStockPrice(stockCode),
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
  }

  async getWatchlist(userId: string, stockCodes: string[]) {
    try {
      const response = await callViaAgent(userId, "watchlist.get", { stockCodes });
      return response?.items || [];
    } catch (error) {
      if (error instanceof AgentTimeoutError) throw error;
      const legacyKiwoom = await this.getLegacyServiceForUser(userId);
      return legacyKiwoom.getWatchlistInfo(stockCodes);
    }
  }

  async getConditionList(userId: string) {
    try {
      const response = await callViaAgent(userId, "condition.list", {});
      return response?.output ?? response ?? [];
    } catch (error) {
      if (error instanceof AgentTimeoutError) throw error;
      const legacyKiwoom = await this.getLegacyServiceForUser(userId);
      const response = await legacyKiwoom.getConditionList();
      return response?.output ?? response ?? [];
    }
  }

  async runCondition(userId: string, seq: string) {
    try {
      const response = await callViaAgent(userId, "condition.run", { seq });
      return response?.output1 ?? response?.output ?? response ?? [];
    } catch (error) {
      if (error instanceof AgentTimeoutError) throw error;
      const legacyKiwoom = await this.getLegacyServiceForUser(userId);
      const response = await legacyKiwoom.getConditionSearchResults(seq, 0);
      return response?.output1 ?? response?.output ?? response ?? [];
    }
  }

  normalizeChartForPriceHistory(chartData: any[]) {
    return chartData.slice(0, 30).map((row: any) => ({
      date: row.dt || row.date || "",
      price: Number(row.cls_prc || row.close || 0),
      volume: Number(row.trde_qty || row.volume || 0),
    }));
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
