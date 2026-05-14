// use-kiwoom-balance.ts — 서버사이드 에이전트 프록시를 통한 잔고 조회
import { useState, useCallback, useRef } from "react";
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
  fetchedAccountId: number | null;
  fetch: (accountId: number, accountNumber: string, accountType: "mock" | "real") => Promise<void>;
}

export function useKiwoomBalance(): UseKiwoomBalanceResult {
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<BalanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fetchedAccountId, setFetchedAccountId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchBalance = useCallback(async (
    accountId: number,
    _accountNumber: string,
    _accountType: "mock" | "real"
  ) => {
    // 이전 진행 중인 요청 취소 (계좌 전환 시 스테일 응답 방지)
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setData(null);
    setError(null);
    setErrorCode(null);
    setFetchedAccountId(accountId);

    try {
      const res = await window.fetch(`/api/accounts/${accountId}/fetch-balance`, {
        signal: controller.signal,
      });
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
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "balance"] });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setStatus("error");
      setError(e.message || "잔고 조회 중 오류가 발생했습니다.");
      setErrorCode("UNKNOWN");
      setData(null);
    }
  }, []);

  return { status, data, error, errorCode, fetchedAccountId, fetch: fetchBalance };
}
