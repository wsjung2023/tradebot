import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Coins, RefreshCw, DollarSign, Bot, Calendar } from "lucide-react";

const KRW_RATE = 1380;

interface UsageRow {
  id: number;
  usageDate: string;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: string;
}

function formatUSD(v: number) { return `$${(v || 0).toFixed(4)}`; }
function formatKRW(usd: number) { return `₩${Math.round((usd || 0) * KRW_RATE).toLocaleString()}`; }
function formatTokens(n: number) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function AiUsage() {
  const { toast } = useToast();
  const { data: budgetData, isLoading: bLoading } = useQuery<{ budgetUsd: number }>({
    queryKey: ["/api/ai/budget"],
    queryFn: () => apiRequest("GET", "/api/ai/budget").then(r => r.json()),
  });

  const { data: rows, isLoading: rLoading, refetch } = useQuery<UsageRow[]>({
    queryKey: ["/api/ai/usage-daily"],
    queryFn: () => apiRequest("GET", `/api/ai/usage-daily?scopeType=login&limit=30`).then(r => r.json()),
  });

  const budgetUsd = budgetData?.budgetUsd ?? 0;
  const dataRows = Array.isArray(rows) ? rows : [];

  const totalCost = useMemo(() => {
    return dataRows.reduce((s, r) => s + parseFloat(r.costUsd || "0"), 0);
  }, [dataRows]);

  if (bLoading || rLoading) {
    return <div className="p-10 text-center">AI 사용량 데이터를 불러오는 중...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Coins className="w-6 h-6 text-violet-500" /> AI 사용량 현황
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">이번 달 누적 비용</div>
            <div className="text-2xl font-bold text-violet-600">{formatUSD(totalCost)}</div>
            <div className="text-xs text-muted-foreground">{formatKRW(totalCost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">설정 예산</div>
            <div className="text-2xl font-bold">{formatUSD(budgetUsd)}</div>
            <div className="text-xs text-muted-foreground">월 한도</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">일별 내역</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2">날짜</th>
                  <th className="text-right py-2">호출</th>
                  <th className="text-right py-2">토큰 합계</th>
                  <th className="text-right py-2">비용(USD)</th>
                </tr>
              </thead>
              <tbody>
                {dataRows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 font-mono">{r.usageDate}</td>
                    <td className="py-2 text-right">{r.requestCount}</td>
                    <td className="py-2 text-right">{formatTokens(r.totalTokens)}</td>
                    <td className="py-2 text-right font-mono">{formatUSD(parseFloat(r.costUsd))}</td>
                  </tr>
                ))}
                {dataRows.length === 0 && (
                  <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">기록이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => refetch()} variant="outline">
        <RefreshCw className="w-4 h-4 mr-2" /> 새로고침
      </Button>
    </div>
  );
}
