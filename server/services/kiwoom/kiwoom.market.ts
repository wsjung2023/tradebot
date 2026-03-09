// kiwoom.market.ts — 키움증권 REST API 시세·차트·호가 조회 (공식 api-id 사용)
// 시세(ka10007), 호가(ka10004), 일봉(ka10081), 주봉(ka10082), 월봉(ka10083)
// 기본정보(ka10001) — 모두 POST 방식, api-id 헤더로 구분
import { KiwoomBase, type StockPriceResponse, type MarketIssuesResponse, type ThemeStocksResponse, type HighVolumeStocksResponse } from "./kiwoom.base";

const MRKCOND = "/api/dostk/mrkcond";
const CHART   = "/api/dostk/chart";
const STKINFO = "/api/dostk/stkinfo";

function today(): string {
  return new Date().toISOString().split("T")[0].replace(/-/g, "");
}

function absStr(v: string | undefined): string {
  if (!v) return "0";
  return String(v).replace(/^-/, "");
}

export class KiwoomMarket extends KiwoomBase {

  // ───────────── 현재가 시세 ─────────────
  async getStockPrice(stockCode: string): Promise<StockPriceResponse> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    await this.ensureValidToken();

    const resp = await this.api.post<any>(
      MRKCOND,
      { stk_cd: stockCode },
      { headers: { "api-id": "ka10007" } }
    );
    const d = resp.data;
    if (d?.return_code !== undefined && d.return_code !== 0 && String(d.return_code) !== "0") {
      throw new Error(`시세조회 실패: ${d.return_msg} (code: ${d.return_code})`);
    }

    // ka10007 응답 필드 → StockPriceResponse.output 형식으로 정규화
    const cur = absStr(d.cur_prc);
    const predClose = absStr(d.pred_close_pric || "0");
    const predRt = d.pred_rt || "0";
    const fluRt = d.flu_rt || "0";
    const sign = d.smbol || "3"; // 2=상승, 5=하락, 3=보합

    return {
      output: {
        stck_prpr:      cur,
        prdy_vrss:      absStr(predRt),
        prdy_vrss_sign: sign,
        prdy_ctrt:      String(fluRt).replace(/^-/, ""),
        acml_vol:       d.acc_trde_qty || d.trde_qty || "0",
        stck_oprc:      absStr(d.open_pric),
        stck_hgpr:      absStr(d.high_pric),
        stck_lwpr:      absStr(d.low_pric),
        stck_nm:        d.stk_nm || "",
      },
      return_code: 0,
    };
  }

  // ───────────── 호가창 ─────────────
  async getStockOrderbook(stockCode: string): Promise<any> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    await this.ensureValidToken();

    const resp = await this.api.post<any>(
      MRKCOND,
      { stk_cd: stockCode },
      { headers: { "api-id": "ka10004" } }
    );
    const d = resp.data;
    if (d?.return_code !== undefined && d.return_code !== 0 && String(d.return_code) !== "0") {
      throw new Error(`호가조회 실패: ${d.return_msg} (code: ${d.return_code})`);
    }

    // 매도호가: sel_10th_pre_bid ~ sel_1st_pre_bid (높은 순)
    // 매수호가: buy_1st_pre_bid ~ buy_10th_pre_bid (높은 순)
    const sell = [];
    const buy  = [];
    for (let i = 10; i >= 1; i--) {
      const sp = d[`sel_${i}th_pre_bid`] ?? d[`sel_${i === 1 ? '1st' : i === 2 ? '2nd' : i === 3 ? '3rd' : `${i}th`}_pre_bid`];
      const sq = d[`sel_${i}th_pre_req`];
      if (sp) sell.push({ price: Number(absStr(String(sp))), quantity: Number(sq || 0) });
    }
    for (let i = 1; i <= 10; i++) {
      const bp = d[`buy_${i}th_pre_bid`];
      const bq = d[`buy_${i}th_pre_req`];
      if (bp) buy.push({ price: Number(absStr(String(bp))), quantity: Number(bq || 0) });
    }

    return { buy, sell, raw: d };
  }

  // ───────────── 차트 ─────────────
  async getStockChart(stockCode: string, period: string = "D", bars: number = 250): Promise<any> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    await this.ensureValidToken();

    const baseDate = today();
    let apiId: string;
    let listKey: string;

    if (period === "W") {
      apiId = "ka10082";
      listKey = "stk_stk_pole_chart_qry";
    } else if (period === "M") {
      apiId = "ka10083";
      listKey = "stk_mth_pole_chart_qry";
    } else {
      // 일봉 기본
      apiId = "ka10081";
      listKey = "stk_dt_pole_chart_qry";
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
    return items.map((it: any) => ({
      date:   String(it.dt || "").substring(0, 8),
      open:   Number(absStr(String(it.open_pric || 0))),
      high:   Number(absStr(String(it.high_pric || 0))),
      low:    Number(absStr(String(it.low_pric || 0))),
      close:  Number(absStr(String(it.cur_prc || 0))),
      volume: Number(it.trde_qty || 0),
    })).filter(it => it.date && it.close > 0);
  }

  // ───────────── 종목 기본정보 (검색) ─────────────
  async searchStock(keyword: string): Promise<any> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    await this.ensureValidToken();

    try {
      const resp = await this.api.post<any>(
        STKINFO,
        { stk_cd: keyword, dt: "", qry_tp: "1" },
        { headers: { "api-id": "ka10001" } }
      );
      return resp.data;
    } catch (error) {
      console.error("종목검색 실패:", error);
      throw error;
    }
  }

  // ───────────── 거래량 상위 (미지원 → 에러) ─────────────
  async getHighVolumeStocks(_market: 'ALL' | 'KOSPI' | 'KOSDAQ' = 'ALL'): Promise<HighVolumeStocksResponse> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }
    // 거래량상위는 /api/dostk/rkinfo 계열이지만 현재 구현 보류
    throw new Error("거래량 상위 조회는 현재 지원하지 않습니다.");
  }

  // ───────────── 장이슈 (미지원 → 에러) ─────────────
  async getMarketIssues(): Promise<MarketIssuesResponse> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }
    throw new Error("장이슈 조회는 현재 지원하지 않습니다.");
  }

  // ───────────── 테마별 종목 (미지원 → 에러) ─────────────
  async getThemeStocks(_themeCode: string): Promise<ThemeStocksResponse> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }
    throw new Error("테마별 종목 조회는 현재 지원하지 않습니다.");
  }
}
