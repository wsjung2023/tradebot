// kiwoom.market.ts — 키움증권 REST API 시세·차트·호가 조회 (공식 api-id 사용)
import {
  KiwoomBase,
  type StockPriceResponse,
  type MarketIssuesResponse,
  type ThemeStocksResponse,
  type HighVolumeStocksResponse,
} from "./kiwoom.base";

const MRKCOND = "/api/dostk/mrkcond";
const CHART = "/api/dostk/chart";
const STKINFO = "/api/dostk/stkinfo";

function today(): string {
  return new Date().toISOString().split("T")[0].replace(/-/g, "");
}

function absStr(v: string | undefined): string {
  if (!v) return "0";
  return String(v).replace(/^-/, "");
}

export interface WatchlistStockInfo {
  stockCode: string;
  stockName: string;
  currentPrice: string;
  change: string;
  changeSign: string;
  changeRate: string;
  volume: string;
  high: string;
  low: string;
  open: string;
  sellBid: string;
  buyBid: string;
}

export interface StockInfoResult {
  name: string;
  marketName: string;
  state: string;
}

export interface StockSearchResult {
  stockCode: string;
  stockName: string;
  currentPrice: string;
  marketName: string;
}

export class KiwoomMarket extends KiwoomBase {
  private stockCache: Array<{ code: string; name: string }> = [];
  private cacheBuiltAt: Date | null = null;

  async getStockPrice(stockCode: string): Promise<StockPriceResponse> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    await this.ensureValidToken();

    const resp = await this.api.post<any>(MRKCOND, { stk_cd: stockCode }, { headers: { "api-id": "ka10007" } });
    const d = resp.data;
    if (d?.return_code !== undefined && d.return_code !== 0 && String(d.return_code) !== "0") {
      throw new Error(`시세조회 실패: ${d.return_msg} (code: ${d.return_code})`);
    }

    return {
      output: {
        stck_prpr: absStr(d.cur_prc),
        prdy_vrss: absStr(d.pred_rt || "0"),
        prdy_vrss_sign: d.smbol || "3",
        prdy_ctrt: String(d.flu_rt || "0").replace(/^-/, ""),
        acml_vol: d.acc_trde_qty || d.trde_qty || "0",
        stck_oprc: absStr(d.open_pric),
        stck_hgpr: absStr(d.high_pric),
        stck_lwpr: absStr(d.low_pric),
        stck_nm: d.stk_nm || "",
      },
      return_code: 0,
    };
  }

  async getStockOrderbook(stockCode: string): Promise<any> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    await this.ensureValidToken();

    const resp = await this.api.post<any>(MRKCOND, { stk_cd: stockCode }, { headers: { "api-id": "ka10004" } });
    const d = resp.data;
    if (d?.return_code !== undefined && d.return_code !== 0 && String(d.return_code) !== "0") {
      throw new Error(`호가조회 실패: ${d.return_msg} (code: ${d.return_code})`);
    }

    const sell = [];
    const buy = [];
    for (let i = 10; i >= 1; i--) {
      const suffix = i === 1 ? "1st" : i === 2 ? "2nd" : i === 3 ? "3rd" : `${i}th`;
      const sp = d[`sel_${suffix}_pre_bid`] ?? d[`sel_${i}th_pre_bid`];
      const sq = d[`sel_${i}th_pre_req`] ?? d[`sel_${suffix}_pre_req`];
      if (sp) sell.push({ price: Number(absStr(String(sp))), quantity: Number(sq || 0) });
    }
    for (let i = 1; i <= 10; i++) {
      const suffix = i === 1 ? "1st" : i === 2 ? "2nd" : i === 3 ? "3rd" : `${i}th`;
      const bp = d[`buy_${suffix}_pre_bid`] ?? d[`buy_${i}th_pre_bid`];
      const bq = d[`buy_${suffix}_pre_req`] ?? d[`buy_${i}th_pre_req`];
      if (bp) buy.push({ price: Number(absStr(String(bp))), quantity: Number(bq || 0) });
    }

    return { buy, sell, raw: d };
  }

  async getStockChart(stockCode: string, period: string = "D", _bars: number = 250): Promise<any> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    await this.ensureValidToken();

    const baseDate = today();
    let apiId = "ka10081";
    let listKey = "stk_dt_pole_chart_qry";

    if (period === "W") {
      apiId = "ka10082";
      listKey = "stk_stk_pole_chart_qry";
    } else if (period === "M") {
      apiId = "ka10083";
      listKey = "stk_mth_pole_chart_qry";
    }

    const resp = await this.api.post<any>(
      CHART,
      { stk_cd: stockCode, base_dt: baseDate, upd_stkpc_tp: "1" },
      { headers: { "api-id": apiId } }
    );

    const d = resp.data;
    if (d?.return_code !== undefined && d.return_code !== 0 && String(d.return_code) !== "0") {
      throw new Error(`차트조회 실패: ${d.return_msg} (code: ${d.return_code})`);
    }

    const items: any[] = d[listKey] || [];
    return items
      .map((it: any) => ({
        date: String(it.dt || "").substring(0, 8),
        open: Number(absStr(String(it.open_pric || 0))),
        high: Number(absStr(String(it.high_pric || 0))),
        low: Number(absStr(String(it.low_pric || 0))),
        close: Number(absStr(String(it.cur_prc || 0))),
        volume: Number(it.trde_qty || 0),
      }))
      .filter((it) => it.date && it.close > 0);
  }

  async getWatchlistInfo(stockCodes: string[]): Promise<WatchlistStockInfo[]> {
    if (this.stubMode || stockCodes.length === 0) return [];

    await this.ensureValidToken();
    const resp = await this.api.post<any>(
      STKINFO,
      { stk_cd: stockCodes.join("|") },
      { headers: { "api-id": "ka10095" } }
    );

    const list: any[] = resp.data?.atn_stk_infr ?? resp.data?.list ?? resp.data?.output ?? [];
    return list.map((item) => ({
      stockCode: String(item.stk_cd ?? item.stock_code ?? ""),
      stockName: String(item.stk_nm ?? item.stock_name ?? ""),
      currentPrice: String(item.cur_prc ?? item.current_price ?? "0"),
      change: String(item.pred_pre ?? item.change ?? "0"),
      changeSign: String(item.pred_pre_sig ?? item.change_sign ?? "3"),
      changeRate: String(item.flu_rt ?? item.change_rate ?? "0"),
      volume: String(item.trde_qty ?? item.volume ?? "0"),
      high: String(item.high_pric ?? item.high ?? "0"),
      low: String(item.low_pric ?? item.low ?? "0"),
      open: String(item.open_pric ?? item.open ?? "0"),
      sellBid: String(item.sel_bid ?? item.sell_bid ?? "0"),
      buyBid: String(item.buy_bid ?? "0"),
    }));
  }

  async getStockInfo(stockCode: string): Promise<StockInfoResult> {
    if (this.stubMode) {
      return { name: stockCode, marketName: "", state: "" };
    }

    await this.ensureValidToken();
    const resp = await this.api.post<any>(STKINFO, { stk_cd: stockCode }, { headers: { "api-id": "ka10100" } });
    const d = resp.data ?? {};

    const name = String(d.stk_nm ?? d.name ?? "").trim();
    if (!name) {
      throw new Error(`종목정보 조회 실패: ${stockCode}`);
    }

    return {
      name,
      marketName: String(d.mrkt_nm ?? d.market_name ?? ""),
      state: String(d.stk_stat_nm ?? d.state ?? ""),
    };
  }

  async getStockList(marketType: string = "0"): Promise<Array<{ code: string; name: string }>> {
    if (this.stubMode) return [];

    await this.ensureValidToken();
    const resp = await this.api.post<any>(
      STKINFO,
      { mrkt_tp: marketType },
      { headers: { "api-id": "ka10099" } }
    );

    const rows: any[] = resp.data?.stk_list ?? resp.data?.list ?? resp.data?.output ?? [];
    return rows
      .map((row) => ({
        code: String(row.stk_cd ?? row.code ?? "").replace(/^A/, ""),
        name: String(row.stk_nm ?? row.name ?? "").trim(),
      }))
      .filter((row) => row.code && row.name);
  }

  private async ensureStockCache(): Promise<void> {
    const now = new Date();
    if (this.stockCache.length > 0 && this.cacheBuiltAt && now.getTime() - this.cacheBuiltAt.getTime() < 24 * 60 * 60 * 1000) {
      return;
    }

    const [kospi, kosdaq] = await Promise.all([this.getStockList("0"), this.getStockList("10")]);
    this.stockCache = [...kospi, ...kosdaq];
    this.cacheBuiltAt = now;
  }

  async searchStock(keyword: string): Promise<StockSearchResult[]> {
    const q = keyword.trim();
    if (!q) return [];

    if (this.stubMode) return [];

    await this.ensureValidToken();

    if (/^\d{6}$/.test(q)) {
      const resp = await this.api.post<any>(STKINFO, { stk_cd: q }, { headers: { "api-id": "ka10001" } });
      const d = resp.data ?? {};
      if (!d.stk_nm && !d.name) return [];
      return [
        {
          stockCode: String(d.stk_cd ?? q),
          stockName: String(d.stk_nm ?? d.name ?? q),
          currentPrice: String(d.cur_prc ?? "0"),
          marketName: String(d.mrkt_nm ?? ""),
        },
      ];
    }

    try {
      await this.ensureStockCache();
    } catch (error) {
      console.warn("[KiwoomMarket] 종목 캐시 구성 실패:", error);
      return [];
    }

    return this.stockCache
      .filter((stock) => stock.name.includes(q) || stock.code.includes(q))
      .slice(0, 20)
      .map((stock) => ({
        stockCode: stock.code,
        stockName: stock.name,
        currentPrice: "0",
        marketName: "",
      }));
  }

  async getHighVolumeStocks(_market: "ALL" | "KOSPI" | "KOSDAQ" = "ALL"): Promise<HighVolumeStocksResponse> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }
    throw new Error("거래량 상위 조회는 현재 지원하지 않습니다.");
  }

  async getMarketIssues(): Promise<MarketIssuesResponse> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }
    throw new Error("장이슈 조회는 현재 지원하지 않습니다.");
  }

  async getThemeStocks(_themeCode: string): Promise<ThemeStocksResponse> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }
    throw new Error("테마별 종목 조회는 현재 지원하지 않습니다.");
  }
}


