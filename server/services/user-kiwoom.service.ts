import { storage } from "../storage";
import { decrypt } from "../utils/crypto";
import { normalizePriceHistoryAsc } from "../utils/chart-normalization";
import { callViaAgent, AgentTimeoutError } from "./agent-proxy.service";
import { createKiwoomService, getKiwoomService, type KiwoomService } from "./kiwoom";

type CachedLegacyService = {
  fingerprint: string;
  service: KiwoomService;
  lastUsed: number;
};

function toNumberString(value: unknown): string {
  if (value === null || value === undefined) return "0";
  return String(value).replace(/,/g, "").trim();
}

function parseJobTypeCandidates(envValue: string | undefined, defaults: string[]): string[] {
  const parsed = (envValue || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (parsed.length === 0) return defaults;
  return Array.from(new Set(parsed));
}

export class UserKiwoomService {
  private readonly MAX_LEGACY_CACHE = 50;
  private globalLegacyKiwoom = getKiwoomService();
  private legacyByUser = new Map<string, CachedLegacyService>();
  private readonly conditionListJobTypes = parseJobTypeCandidates(
    process.env.KIWOOM_CONDITION_LIST_JOBTYPES,
    ["condition.list", "condition_list", "conditions.list", "condition.get_list"],
  );
  private readonly conditionRunJobTypes = parseJobTypeCandidates(
    process.env.KIWOOM_CONDITION_RUN_JOBTYPES,
    ["condition.run", "condition_run", "conditions.run", "condition.search"],
  );

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

  private readonly RETRIABLE_WS_ERRORS = [
    "로그인 인증이 들어오기 전에 다른 전문이 들어왔습니다",
    "키움 WS 오류",
    "키움 WS 로그인 실패",
    "Token이 유효하지 않습니다",
    "WebSocket",
  ];

  private isRetriableWsError(message: string): boolean {
    return this.RETRIABLE_WS_ERRORS.some((kw) => message.includes(kw));
  }

  private async callViaAgentWithRetry(
    userId: string,
    jobType: string,
    payload: Record<string, unknown>,
    maxRetries: number = 3,
    retryDelayMs: number = 4000,
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // condition.run은 CNSRLST→CNSRREQ 2단계로 더 오래 걸림 → 40초
        const timeoutMs = jobType.includes("condition") ? 40000 : 22000;
        return await callViaAgent(userId, jobType, payload, timeoutMs);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        const shouldRetry = this.isRetriableWsError(message) && attempt < maxRetries;
        if (shouldRetry) {
          console.warn(`[KiwoomAgent] ${jobType} 시도 ${attempt}/${maxRetries} 실패 (${retryDelayMs}ms 후 재시도): ${message}`);
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        } else {
          throw error;
        }
      }
    }
    throw new Error("에이전트 호출 실패");
  }

  private async callViaAgentWithJobTypeFallback(
    userId: string,
    jobTypes: string[],
    payload: Record<string, unknown>,
  ): Promise<any> {
    let lastError: unknown;
    const attemptLogs: Array<{ jobType: string; message: string }> = [];

    for (const jobType of jobTypes) {
      try {
        return await this.callViaAgentWithRetry(userId, jobType, payload, 3, 4000);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error ?? "");
        attemptLogs.push({ jobType, message });
        const isUnsupportedType = message.includes("지원하지 않는 작업 타입");

        if (!isUnsupportedType) {
          throw error;
        }
      }
    }

    if (lastError) {
      const detail = attemptLogs
        .map((log, idx) => `${idx + 1}) ${log.jobType} -> ${log.message}`)
        .join(" | ");
      throw new Error(`조건검색 에이전트 호출 실패 (모든 jobType 시도 실패): ${detail}`);
    }
    throw new Error("에이전트 호출 실패");
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
    const response = await this.callViaAgentWithJobTypeFallback(
      userId,
      this.conditionListJobTypes,
      {},
    );
    return response?.output ?? response ?? [];
  }

  async runCondition(userId: string, seq: string) {
    const response = await this.callViaAgentWithJobTypeFallback(
      userId,
      this.conditionRunJobTypes,
      { seq },
    );
    return response?.output1 ?? response?.output ?? response ?? [];
  }

  async getFinancials(userId: string, stockCode: string) {
    try {
      return await callViaAgent(userId, "financials.get", { stockCode });
    } catch (error) {
      if (error instanceof AgentTimeoutError) throw error;
      const legacyKiwoom = await this.getLegacyServiceForUser(userId);
      return legacyKiwoom.getFinancialStatements(stockCode);
    }
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
