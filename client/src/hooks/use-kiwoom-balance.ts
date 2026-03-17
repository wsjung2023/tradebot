// use-kiwoom-balance.ts — 서버사이드 프록시 우선, 실패 시 브라우저 직접 호출 폴백
import { useState, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { fetchKiwoomBalance } from "@/lib/kiwoom-client";

export interface BalanceResult {
  output1: Record<string, string>;
  output2: Array<Record<string, string>>;
  totalAssets: number;
  todayProfit: number;
  todayProfitRate: number;
}

type Status = "idle" | "loading" | "success" | "network_blocked" | "cors_blocked" | "error";

interface UseKiwoomBalanceResult {
  status: Status;
  data: BalanceResult | null;
  error: string | null;
  errorCode: string | null;
  fetch: (accountId: number, accountNumber: string, accountType: "mock" | "real") => Promise<void>;
}

export function useKiwoomBalance(): UseKiwoomBalanceResult {
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<BalanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const fetchBalance = useCallback(async (
    accountId: number,
    accountNumber: string,
    accountType: "mock" | "real"
  ) => {
    setStatus("loading");
    setError(null);
    setErrorCode(null);

    // 1단계: 서버사이드 프록시 시도
    try {
      const res = await fetch(`/api/accounts/${accountId}/fetch-balance`);
      const body = await res.json();

      if (res.ok) {
        setData(body);
        setStatus("success");
        queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "holdings"] });
        return;
      }

      // 서버가 네트워크 차단 에러를 반환한 경우 → 브라우저 직접 호출 폴백
      const errCode = body.errorCode || "";
      if (errCode !== "SERVER_UNREACHABLE" && body.error !== "KIWOOM_NETWORK_BLOCKED") {
        setStatus("error");
        setError(body.error || body.message || `HTTP ${res.status}`);
        setErrorCode(errCode || null);
        setData(null);
        return;
      }
    } catch {
      // 서버 자체 에러 → 폴백 진행
    }

    // 2단계: 브라우저에서 Kiwoom API 직접 호출 (한국 IP에서 CORS 가능성)
    console.log("[Kiwoom] 서버 프록시 실패 → 브라우저 직접 호출 시도...");
    try {
      const result = await fetchKiwoomBalance(accountNumber, accountType);
      setData(result);
      setStatus("success");
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "holdings"] });

      // 서버에 결과 동기화
      try {
        await fetch(`/api/accounts/${accountId}/sync-balance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ output1: result.output1, output2: result.output2 }),
        });
      } catch { /* 동기화 실패해도 화면 표시는 유지 */ }
    } catch (e: any) {
      if (e.message === "CORS_BLOCKED") {
        setStatus("cors_blocked");
        setError(
          "서버(미국)와 브라우저 모두 Kiwoom API 접근 불가. " +
          "한국 서버에 배포하거나 설정에서 API 키를 확인해주세요."
        );
        setErrorCode("CORS_BLOCKED");
      } else {
        setStatus("error");
        setError(e.message || "Kiwoom API 연결 오류");
        setErrorCode("UNKNOWN");
      }
      setData(null);
    }
  }, []);

  return { status, data, error, errorCode, fetch: fetchBalance };
}
