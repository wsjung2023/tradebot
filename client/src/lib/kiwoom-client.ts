// kiwoom-client.ts — 브라우저에서 직접 키움 API 호출 (클라이언트 IP 사용)

const CORS_ERROR_MSG = "CORS_BLOCKED";

interface KiwoomCredentials {
  appKey: string;
  appSecret: string;
  baseUrl: string;
  mockBaseUrl: string;
}

interface TokenCache {
  token: string;
  expiry: number;
}

// 탭 내 메모리 캐시 (보안상 localStorage 미사용)
const tokenCache: Record<string, TokenCache> = {};

async function fetchCredentials(): Promise<KiwoomCredentials> {
  const res = await fetch("/api/kiwoom/credentials");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "API 키 조회 실패");
  }
  return res.json();
}

async function getToken(creds: KiwoomCredentials, isMock: boolean): Promise<string> {
  const cacheKey = `${creds.appKey}_${isMock}`;
  const cached = tokenCache[cacheKey];
  if (cached && Date.now() < cached.expiry) return cached.token;

  const baseUrl = isMock ? creds.mockBaseUrl : creds.baseUrl;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/oauth2/tokenP`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: creds.appKey,
        appsecret: creds.appSecret,
      }),
    });
  } catch (e: any) {
    if (e.message?.includes("Failed to fetch") || e.name === "TypeError") {
      throw new Error(CORS_ERROR_MSG);
    }
    throw e;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`인증 실패 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error("토큰 응답 오류: " + JSON.stringify(data));

  tokenCache[cacheKey] = {
    token: data.access_token,
    expiry: Date.now() + (data.expires_in || 86400) * 1000 - 60000,
  };
  return data.access_token;
}

async function kiwoomGet(baseUrl: string, path: string, token: string, appKey: string, appSecret: string, params: Record<string, string>) {
  const url = new URL(`${baseUrl}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        appkey: appKey,
        appsecret: appSecret,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (e: any) {
    if (e.message?.includes("Failed to fetch") || e.name === "TypeError") {
      throw new Error(CORS_ERROR_MSG);
    }
    throw e;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API 오류 (${res.status}): ${text}`);
  }
  return res.json();
}

export interface BalanceResult {
  output1: Record<string, string>;
  output2: Array<Record<string, string>>;
  totalAssets: number;
  todayProfit: number;
  todayProfitRate: number;
  assetHistory: Array<{ date: string; totalAssets: number; profit: number }>;
}

export async function fetchKiwoomBalance(accountNumber: string, accountType: "mock" | "real"): Promise<BalanceResult> {
  const creds = await fetchCredentials();
  const isMock = accountType === "mock";
  const baseUrl = isMock ? creds.mockBaseUrl : creds.baseUrl;

  const token = await getToken(creds, isMock);

  const data = await kiwoomGet(
    baseUrl,
    "/uapi/domestic-stock/v1/trading/inquire-balance",
    token,
    creds.appKey,
    creds.appSecret,
    {
      CANO: accountNumber.slice(0, 8),
      ACNT_PRDT_CD: accountNumber.slice(8) || "01",
      AFHR_FLPR_YN: "N",
      OFL_YN: "N",
      INQR_DVSN: "01",
      UNPR_DVSN: "01",
      FUND_STTL_ICLD_YN: "N",
      FNCG_AMT_AUTO_RDPT_YN: "N",
      PRCS_DVSN: "00",
      CTX_AREA_FK100: "",
      CTX_AREA_NK100: "",
      tr_id: isMock ? "VTTC8434R" : "TTTC8434R",
    }
  );

  const output1 = data.output1 || {};
  const output2 = data.output2 || [];

  const totalAssets = parseFloat(output1.tot_evlu_amt || "0");
  const todayProfit = parseFloat(output1.evlu_pfls_smtl_amt || "0");

  return {
    output1,
    output2,
    totalAssets,
    todayProfit,
    todayProfitRate: totalAssets > 0 ? (todayProfit / totalAssets) * 100 : 0,
    assetHistory: [],
  };
}

export { CORS_ERROR_MSG };
