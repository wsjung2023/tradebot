// kiwoom.base.ts — 키움증권 API 공통 기반 클래스 (인증, axios 인스턴스, 공유 타입)
import axios, { AxiosInstance } from "axios";

export const KIWOOM_REAL_BASE = "https://api.kiwoom.com";
export const KIWOOM_MOCK_BASE = "https://mockapi.kiwoom.com";

export interface KiwoomConfig {
  appKey: string;
  appSecret: string;
  baseURL?: string;
  accountType?: "real" | "mock";
}

export interface KiwoomBalanceOutput1 {
  tot_evlu_amt: string;
  dnca_tot_amt: string;
  nxdy_excc_amt: string;
  evlu_pfls_smtl_amt: string;
  pchs_amt_smtl_amt: string;
  evlu_amt_smtl_amt: string;
  [key: string]: string;
}

export interface KiwoomBalanceOutput2 {
  acnt_pdno: string;
  prdt_name: string;
  hldg_qty: string;
  pchs_avg_pric: string;
  prpr: string;
  evlu_pfls_amt: string;
  evlu_pfls_rt: string;
  [key: string]: string;
}

export interface AccountBalanceResponse {
  output1: KiwoomBalanceOutput1;
  output2: KiwoomBalanceOutput2[];
  return_code?: number;
  return_msg?: string;
}

export interface StockPriceResponse {
  output: Record<string, string>;
  return_code?: number;
  return_msg?: string;
}

export interface OrderRequest {
  accountNumber: string;
  accountPassword?: string;
  stockCode: string;
  orderType: "buy" | "sell";
  orderQuantity: number;
  orderPrice?: number;
  orderMethod: "market" | "limit";
}

export interface OrderResponse {
  return_code?: number;
  return_msg?: string;
  rt_cd?: string;
  msg_cd?: string;
  msg1?: string;
  output?: Record<string, string>;
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
  protected baseURL: string;

  constructor(config: KiwoomConfig) {
    this.appKey = config.appKey;
    this.appSecret = config.appSecret;

    if (!config.appKey || !config.appSecret || config.appKey === "stub" || config.appSecret === "stub") {
      this.stubMode = true;
      console.log("⚠️  KiwoomService running in STUB mode (no real API calls)");
    }

    const accountType = config.accountType || "real";
    this.baseURL = config.baseURL || (accountType === "mock" ? KIWOOM_MOCK_BASE : KIWOOM_REAL_BASE);

    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: { "Content-Type": "application/json;charset=UTF-8" },
    });

    this.api.interceptors.request.use(async (cfg) => {
      if (this.stubMode) return cfg;
      await this.ensureValidToken();
      if (this.accessToken) {
        cfg.headers.Authorization = `Bearer ${this.accessToken}`;
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
      const response = await axios.post(
        `${this.baseURL}/oauth2/token`,
        {
          grant_type: "client_credentials",
          appkey: this.appKey,
          secretkey: this.appSecret,
        },
        {
          timeout: 10000,
          headers: { "Content-Type": "application/json;charset=UTF-8" },
        }
      );
      const data = response.data as { access_token?: string; token?: string; expires_in?: number; return_code?: number; return_msg?: string };

      if (data.return_code && data.return_code !== 0) {
        throw new Error(`Kiwoom auth error: ${data.return_msg} (code: ${data.return_code})`);
      }

      const token = data.access_token || data.token;
      if (!token) throw new Error(`Kiwoom auth: no token in response. ${JSON.stringify(data)}`);

      this.accessToken = token;
      this.tokenExpiry = Date.now() + ((data.expires_in || 86400) * 1000) - 60000;
      console.log("✅ Kiwoom API 인증 성공");
    } catch (error: any) {
      if (error.code === "ECONNABORTED" || error.message?.includes("timeout") ||
          error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        console.warn("⚠️  Kiwoom API 연결 불가 (네트워크), stub 모드 전환");
        this.stubMode = true;
      }
      throw new Error(`Kiwoom 인증 실패: ${error.message}`);
    }
  }
}
