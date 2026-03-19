// use-kiwoom-balance.ts — 클라이언트 job 등록 방식 (에이전트 폴링)
import { useState, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { useAgentJob } from "./use-agent-job";
import { fetchKiwoomBalance } from "@/lib/kiwoom-client";

export interface BalanceResult {
  output1: Record<string, string>;
  output2: Array<Record<string, string>>;
  totalAssets: number;
  todayProfit: number;
  todayProfitRate: number;
}

type Status = "idle" | "loading" | "success" | "network_blocked" | "cors_blocked" | "error" | "agent_timeout";

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
  const agentJob = useAgentJob();

  const fetchBalance = useCallback(async (
    accountId: number,
    accountNumber: string,
    accountType: "mock" | "real"
  ) => {
    setStatus("loading");
    setError(null);
    setErrorCode(null);

    // 1단계: 집 PC 에이전트를 통해 키움 API 호출
    try {
      const result = await agentJob.submitJob(
        "balance.get",
        { accountNumber, accountType },
        30000
      );

      // submitJob이 완료되었고 결과가 있음
      if (result?.status === "done" && result.result) {
        const agentResult = result.result;
        // 에이전트 응답을 BalanceResult 형식으로 변환
        const balanceResult: BalanceResult = {
          output1: agentResult.output1 || {},
          output2: agentResult.output2 || [],
          totalAssets: parseFloat(agentResult.totalEvaluationAmount || "0"),
          todayProfit: parseFloat(agentResult.todayProfit || "0"),
          todayProfitRate: parseFloat(agentResult.todayProfitRate || "0"),
        };
        setData(balanceResult);
        setStatus("success");
        queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "holdings"] });
        return;
      }

      // 에이전트 에러 발생
      setStatus("error");
      setError(result?.errorMessage || "에이전트 처리 중 오류 발생");
      setErrorCode("AGENT_ERROR");
      setData(null);
      return;
    } catch (e: any) {
      // 에이전트 실패 → 폴백: 브라우저 직접 호출
      console.log("[Kiwoom] 에이전트 실패 → 브라우저 직접 호출 시도...", e.message);
    }

    // 2단계: 브라우저에서 Kiwoom API 직접 호출 (폴백)
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
  }, [agentJob]);

  return { status, data, error, errorCode, fetch: fetchBalance };
}
