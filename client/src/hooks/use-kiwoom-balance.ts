// use-kiwoom-balance.ts — 서버사이드 에이전트 프록시를 통한 잔고 조회
import { useState, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";

export interface BalanceResult {
  output1: Record<string, string>;
  output2: Array<Record<string, string>>;
  totalAssets: number;
  todayProfit: number;
  todayProfitRate: number;
  depositAmount: number;
}

type Status = "idle" | "loading" | "success" | "agent_timeout" | "error";

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
    _accountNumber: string,
    _accountType: "mock" | "real"
  ) => {
    setStatus("loading");
    setData(null);   // 계좌 전환 시 이전 데이터 즉시 초기화 (다른 계좌 데이터가 보이는 버그 방지)
    setError(null);
    setErrorCode(null);

    try {
      const res = await window.fetch(`/api/accounts/${accountId}/fetch-balance`);
      const body = await res.json();

      if (!res.ok) {
        const code = body.errorCode || "UNKNOWN";
        const msg = body.error || "잔고 조회 중 오류가 발생했습니다.";
        if (res.status === 503 || code === "AGENT_TIMEOUT") {
          setStatus("agent_timeout");
        } else {
          setStatus("error");
        }
        setError(msg);
        setErrorCode(code);
        setData(null);
        return;
      }

      setData({
        output1: body.output1 || {},
        output2: body.output2 || [],
        totalAssets: body.totalAssets ?? 0,
        todayProfit: body.todayProfit ?? 0,
        todayProfitRate: body.todayProfitRate ?? 0,
        depositAmount: body.depositAmount ?? 0,
      });
      setStatus("success");
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "holdings"] });
    } catch (e: any) {
      setStatus("error");
      setError(e.message || "잔고 조회 중 오류가 발생했습니다.");
      setErrorCode("UNKNOWN");
      setData(null);
    }
  }, []);

  return { status, data, error, errorCode, fetch: fetchBalance };
}
