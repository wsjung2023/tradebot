// use-kiwoom-balance.ts — 브라우저가 직접 Kiwoom API 호출 후 서버에 동기화
import { useState, useCallback } from "react";
import { fetchKiwoomBalance, BalanceResult, CORS_ERROR_MSG } from "@/lib/kiwoom-client";
import { queryClient } from "@/lib/queryClient";

type Status = "idle" | "loading" | "success" | "cors_error" | "error";

interface UseKiwoomBalanceResult {
  status: Status;
  data: BalanceResult | null;
  error: string | null;
  fetch: (accountId: number, accountNumber: string, accountType: "mock" | "real") => Promise<void>;
}

export function useKiwoomBalance(): UseKiwoomBalanceResult {
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<BalanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async (
    accountId: number,
    accountNumber: string,
    accountType: "mock" | "real"
  ) => {
    setStatus("loading");
    setError(null);

    try {
      const result = await fetchKiwoomBalance(accountNumber, accountType);
      setData(result);
      setStatus("success");

      // 결과를 서버에 동기화 (보유종목 DB 저장)
      try {
        await fetch(`/api/accounts/${accountId}/sync-balance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ output1: result.output1, output2: result.output2 }),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "holdings"] });
      } catch {
        // 동기화 실패해도 화면 표시는 유지
      }
    } catch (e: any) {
      if (e.message === CORS_ERROR_MSG) {
        setStatus("cors_error");
        setError("Kiwoom API 직접 연결 불가 — 브라우저 CORS 정책 또는 네트워크 차단. 서버사이드 프록시가 필요합니다.");
      } else {
        setStatus("error");
        setError(e.message || "알 수 없는 오류");
      }
      setData(null);
    }
  }, []);

  return { status, data, error, fetch: fetchBalance };
}
