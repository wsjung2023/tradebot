// kiwoom.base.ts — 키움증권 API 공통 기반 클래스 (인증, axios 인스턴스, 공유 타입)
import axios, { AxiosInstance } from "axios";

export interface KiwoomConfig {
  appKey: string;
  appSecret: string;
  baseURL?: string;
}

export interface AccountBalanceResponse {
  output1: {
    dnca_tot_amt: string;
    nxdy_excc_amt: string;
    prvs_rcdl_excc_amt: string;
    cma_evlu_amt: string;
    tot_evlu_amt: string;
    pchs_amt_smtl_amt: string;
    evlu_amt_smtl_amt: string;
    evlu_pfls_smtl_amt: string;
  };
  output2: Array<{
    pdno: string;
    prdt_name: string;
    hldg_qty: string;
    pchs_avg_pric: string;
    prpr: string;
    evlu_pfls_amt: string;
    evlu_pfls_rt: string;
  }>;
}

export interface StockPriceResponse {
  output: {
    stck_prpr: string;
    prdy_vrss: string;
    prdy_vrss_sign: string;
    prdy_ctrt: string;
    acml_vol: string;
    stck_oprc: string;
    stck_hgpr: string;
    stck_lwpr: string;
  };
}

export interface OrderRequest {
  accountNumber: string;
  stockCode: string;
  orderType: "buy" | "sell";
  orderQuantity: number;
  orderPrice?: number;
  orderMethod: "market" | "limit";
}

export interface OrderResponse {
  rt_cd: string;
  msg_cd: string;
  msg1: string;
  output: {
    KRX_FWDG_ORD_ORGNO: string;
    ODNO: string;
    ORD_TMD: string;
  };
}

export interface ConditionListResponse {
  output: Array<{ condition_name: string; condition_index: number }>;
}

export interface ConditionSearchResultsResponse {
  output1?: Array<{ stck_cd: string; stck_nm: string; stck_prpr: string; prdy_ctrt: string }>;
  output?: Array<{ stock_code: string; stock_name: string; current_price: string; change_rate: string }>;
}

export interface FinancialStatementsResponse {
  output: Array<{
    stac_yymm: string; sale_account: string; sale_cost: string;
    sale_totl_prfi: string; bsop_prti: string; ntin: string;
    total_aset: string; total_lblt: string; cpfn: string;
  }>;
}

export interface FinancialRatiosResponse {
  output: { roe: string; roa: string; debt_ratio: string; reserve_ratio: string; eps: string; per: string; bps: string; pbr: string };
}

export interface MarketIssuesResponse {
  output: Array<{ stock_code: string; stock_name: string; issue_type: string; issue_title: string; current_price: string; change_rate: string; trading_volume: string }>;
}

export interface ThemeStocksResponse {
  output: Array<{ stock_code: string; stock_name: string; current_price: string; change_rate: string; trading_volume: string; market_cap: string }>;
}

export interface HighVolumeStocksResponse {
  output: Array<{ rank: string; stock_code: string; stock_name: string; current_price: string; change_rate: string; trading_volume: string; trading_value: string }>;
}

export class KiwoomBase {
  protected api: AxiosInstance;
  protected accessToken: string | null = null;
  protected tokenExpiry: number = 0;
  protected appKey: string;
  protected appSecret: string;
  protected stubMode: boolean = false;

  constructor(config: KiwoomConfig) {
    this.appKey = config.appKey;
    this.appSecret = config.appSecret;

    if (!config.appKey || !config.appSecret || config.appKey === "stub" || config.appSecret === "stub") {
      this.stubMode = true;
      console.log("⚠️  KiwoomService running in STUB mode (no real API calls)");
    }

    this.api = axios.create({
      baseURL: config.baseURL || "https://openapi.kiwoom.com:9443",
      timeout: 10000,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });

    this.api.interceptors.request.use(async (cfg) => {
      if (this.stubMode) return cfg;
      await this.ensureValidToken();
      if (this.accessToken) {
        cfg.headers.Authorization = `Bearer ${this.accessToken}`;
        cfg.headers.appkey = this.appKey;
        cfg.headers.appsecret = this.appSecret;
      }
      return cfg;
    });
  }

  protected async ensureValidToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return;
    await this.authenticate();
  }

  protected async authenticate(): Promise<void> {
    try {
      const response = await this.api.post("/oauth2/token", {
        grant_type: "client_credentials",
        appkey: this.appKey,
        appsecret: this.appSecret,
      });
      const data = response.data as { access_token: string; expires_in: number };
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + data.expires_in * 1000 - 60000;
    } catch (error: any) {
      throw new Error(`Kiwoom authentication failed: ${error.message}`);
    }
  }
}
