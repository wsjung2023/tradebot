// use-kiwoom-balance.ts — 서버사이드 Kiwoom API 프록시 호출 (CORS 없음)
import { useState, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";

export interface BalanceResult {
  output1: Record<string, string>;
  output2: Array<Record<string, string>>;
  totalAssets: number;
  todayProfit: number;
  todayProfitRate: number;
}

type Status = "idle" | "loading" | "success" | "network_blocked" | "error";

interface UseKiwoomBalanceResult {
  status: Status;
  data: BalanceResult | null;
  error: string | null;
  fetch: (accountId: number, accountType: "mock" | "real") => Promise<void>;
}

export function useKiwoomBalance(): UseKiwoomBalanceResult {
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<BalanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async (accountId: number, _accountType: "mock" | "real") => {
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch(`/api/accounts/${accountId}/fetch-balance`);
      const body = await res.json();

      if (!res.ok) {
        if (body.error === "KIWOOM_NETWORK_BLOCKED") {
          setStatus("network_blocked");
          setError(body.message || "서버에서 Kiwoom API 포트(9443)에 접근 불가합니다. 한국 서버 배포가 필요합니다.");
        } else {
          setStatus("error");
          setError(body.error || body.message || `HTTP ${res.status}`);
        }
        setData(null);
        return;
      }

      setData(body);
      setStatus("success");
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "holdings"] });
    } catch (e: any) {
      setStatus("error");
      setError(e.message || "네트워크 오류");
      setData(null);
    }
  }, []);

  return { status, data, error, fetch: fetchBalance };
}
