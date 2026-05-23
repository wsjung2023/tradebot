// kiwoom.base.ts — 키움증권 API 공통 기반 클래스 (인증, axios 인스턴스, 공유 타입)
// Agent-less: 서버가 직접 토큰 발급/갱신 (kiwoom-agent.py 의존 없음)
import axios, { AxiosInstance } from "axios";
import fs from "fs";
import path from "path";

const TOKEN_CACHE_FILE = path.resolve(process.cwd(), ".kiwoom_token_cache.json");

function loadTokenCache(): Record<string, { token: string; expiry: number }> {
  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveTokenCache(cache: Record<string, { token: string; expiry: number }>) {
  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch (e) {
    console.warn("⚠️  토큰 캐시 저장 실패:", e);
  }
}

export const KIWOOM_REAL_BASE = "https://api.kiwoom.com";
export const KIWOOM_MOCK_BASE = "https://mockapi.kiwoom.com";

export class KiwoomAuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "KiwoomAuthError";
    Object.setPrototypeOf(this, KiwoomAuthError.prototype);
  }
}

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
  private cacheKey: string = "";

  constructor(config: KiwoomConfig) {
    this.appKey = config.appKey;
    this.appSecret = config.appSecret;

    if (!config.appKey || !config.appSecret || config.appKey === "stub" || config.appSecret === "stub") {
      this.stubMode = true;
      console.log("⚠️  KiwoomService running in STUB mode (no real API calls)");
    }

    const accountType = config.accountType || "real";
    this.baseURL = config.baseURL || (accountType === "mock" ? KIWOOM_MOCK_BASE : KIWOOM_REAL_BASE);
    // 캐시 키: appKey + baseURL 조합 (계정/서버별 독립 캐싱)
    this.cacheKey = `${this.appKey}__${this.baseURL}`;

    // 파일 캐시에서 기존 토큰 복원 (서버 재시작 시 재사용)
    if (!this.stubMode) {
      const cache = loadTokenCache();
      const cached = cache[this.cacheKey];
      if (cached && cached.expiry > Date.now() + 60000) {
        this.accessToken = cached.token;
        this.tokenExpiry = cached.expiry;
        console.log("♻️  Kiwoom 토큰 캐시에서 복원 (유효기간:", new Date(cached.expiry).toLocaleTimeString(), ")");
      }

      // 10분마다 만료 체크 → 만료 1시간 전 자동 갱신 (agent 없이 서버 자체 관리)
      setInterval(async () => {
        try {
          const oneHour = 60 * 60 * 1000;
          if (this.accessToken && this.tokenExpiry - Date.now() < oneHour) {
            console.log(`[KiwoomBase] 토큰 만료 1시간 이내 — 자동 갱신 시작`);
            await this.authenticate();
          }
        } catch (e) {
          console.warn("[KiwoomBase] 토큰 자동 갱신 실패:", (e as any)?.message);
        }
      }, 10 * 60 * 1000);
    }

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

    // 401 응답 시 토큰 강제 리셋 후 1회 재시도
    this.api.interceptors.response.use(
      async (res) => {
        const d = res.data;
        const msg = String(d?.return_msg || d?.msg1 || d?.error || "");
        const code = String(d?.return_code || d?.msg_cd || "");
        const isAuthError = msg.includes("8005") || msg.includes("Token이 유효하지 않습니다") || msg.includes("인증에 실패했습니다") || code === "8005";

        if (isAuthError && !res.config?._retried) {
          console.warn("⚠️  Kiwoom 인증 오류(본문 에러) 감지 — 토큰 강제 갱신 후 재시도");
          this.accessToken = "";
          this.tokenExpiry = 0;
          try {
            await this.ensureValidToken();
            res.config._retried = true;
            if (this.accessToken) {
              res.config.headers.Authorization = `Bearer ${this.accessToken}`;
            }
            return this.api.request(res.config);
          } catch (e) {
            console.error("❌ 토큰 갱신 후 재시도 실패:", e);
          }
        }
        return res;
      },
      async (error) => {
        const status = error?.response?.status;
        const responseData = error?.response?.data;
        const errMsg = typeof responseData?.error === "string" ? responseData.error : error?.message || "";
        const isAuthError = status === 401 || errMsg.includes("8005") || errMsg.includes("Token이 유효하지 않습니다") || errMsg.includes("인증에 실패했습니다");

        if (isAuthError && !error.config?._retried) {
          console.warn("⚠️  Kiwoom 401/인증 오류 감지 — 토큰 강제 갱신 후 재시도");
          this.accessToken = "";
          this.tokenExpiry = 0;
          try {
            await this.ensureValidToken();
            error.config._retried = true;
            if (this.accessToken) {
              error.config.headers.Authorization = `Bearer ${this.accessToken}`;
            }
            return this.api.request(error.config);
          } catch (e) {
            console.error("❌ 토큰 갱신 후 재시도 실패:", e);
          }
        }
        // 429 rate limit 시 최대 3회 재시도 (1초, 2초, 4초 대기)
        if (status === 429 && (error.config?._retryCount ?? 0) < 3) {
          const retryCount = (error.config._retryCount ?? 0) + 1;
          const waitMs = retryCount * 1000;
          console.warn(`⚠️  Kiwoom 429 — ${waitMs}ms 후 재시도 (${retryCount}/3)`);
          await new Promise(r => setTimeout(r, waitMs));
          error.config._retryCount = retryCount;
          return this.api.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  protected async ensureValidToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return;
    await this.authenticate();
  }

  protected async authenticate(): Promise<void> {
    // 429 rate limit 시 최대 2회 재시도 (5초, 15초 대기)
    const maxAttempts = 3;
    let lastError: any;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await this._doAuthenticate(this.baseURL);
        return;
      } catch (error: any) {
        lastError = error;
        const status = error?.response?.status ?? error?.status;
        if (status === 429 && attempt < maxAttempts - 1) {
          const waitMs = (attempt + 1) * 5000;
          console.warn(`[KiwoomAuth] 429 rate limit — ${waitMs / 1000}초 후 재시도 (${attempt + 1}/${maxAttempts - 1})`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        break;
      }
    }
    const error = lastError;
    // 8030: 실전/모의 API 키 불일치 → ACCOUNT_TYPE_MISMATCH 에러 코드
    if (error?.message?.includes("8030")) {
      const serverType = this.baseURL === KIWOOM_REAL_BASE ? "실전" : "모의";
      console.warn(`⚠️  Kiwoom 8030 오류: ${serverType} 서버에 맞지 않는 API 키`);
      throw new KiwoomAuthError("ACCOUNT_TYPE_MISMATCH", `8030: ${serverType} 서버용 API 키가 필요합니다. 계좌번호별 API 키를 확인하세요.`);
    }
    // 8050: 서버 IP 미등록 → IP_NOT_REGISTERED 에러 코드
    if (error?.message?.includes("8050")) {
      console.warn("⚠️  Kiwoom 8050 오류: 서버 IP가 키움 OpenAPI 포털에 미등록됨");
      throw new KiwoomAuthError("IP_NOT_REGISTERED", `8050: 서버 IP가 키움 OpenAPI 포털에 등록되어야 합니다. 설정에서 현재 IP를 확인하고 키움 포털의 지정단말기 IP로 등록하세요.`);
    }
    if (error?.code === "ECONNABORTED" || error?.message?.includes("timeout") ||
        error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND") {
      console.warn("⚠️  Kiwoom API 연결 불가 (네트워크), stub 모드 전환");
      this.stubMode = true;
    }
    throw new Error(`Kiwoom 인증 실패: ${error?.message ?? String(error)}`);
  }

  private summarizeAuthPayload(data: unknown): string {
    const raw = typeof data === "string" ? data : JSON.stringify(data);
    const text = String(raw || "");
    const lower = text.toLowerCase();
    const isHtml = lower.includes("<!doctype") || lower.includes("<html");
    if (!isHtml) return text.slice(0, 300);

    const compact = text.replace(/\s+/g, " ").trim();
    const hasMaintenanceWord = compact.includes("중단") || compact.includes("점검") || compact.includes("시스템 작업");
    const timeMatch = compact.match(/중단\s*일시[^0-9]*(\d{1,2}\/\d{1,2}\([^)]+\)\s*\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2})/);
    const reasonMatch = compact.match(/중단\s*사유[^<\n]*[:：]?\s*([^<\n]+)/);

    if (hasMaintenanceWord) {
      const timeText = timeMatch?.[1] ? `, 중단 일시: ${timeMatch[1]}` : "";
      const reasonText = reasonMatch?.[1] ? `, 사유: ${reasonMatch[1].trim()}` : "";
      return `키움 서버 점검/중단 공지 페이지 응답${timeText}${reasonText}`;
    }

    return "키움 인증 응답이 HTML(공지/오류 페이지)로 반환되었습니다.";
  }

  private async _doAuthenticate(baseURL: string): Promise<void> {
    const response = await axios.post(
      `${baseURL}/oauth2/token`,
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
      console.error(`[Kiwoom Auth FAIL] baseURL=${baseURL} return_code=${data.return_code} return_msg=${data.return_msg}`);
      throw new Error(`Kiwoom auth error: ${data.return_msg} (code: ${data.return_code})`);
    }

    const token = data.access_token || data.token;
    if (!token) {
      const brief = this.summarizeAuthPayload(response.data);
      throw new Error(`Kiwoom auth: no token in response. ${brief}`);
    }

    this.accessToken = token;
    this.tokenExpiry = Date.now() + ((data.expires_in || 86400) * 1000) - 60000;

    // 파일 캐시에 저장 (서버 재시작 시 재사용)
    const cache = loadTokenCache();
    cache[this.cacheKey] = { token, expiry: this.tokenExpiry };
    saveTokenCache(cache);

    console.log(`✅ Kiwoom API 인증 성공 — ${baseURL.includes("mock") ? "모의" : "실전"} 서버 (캐시 저장됨)`);
  }
}
