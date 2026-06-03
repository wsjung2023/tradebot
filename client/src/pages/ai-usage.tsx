import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coins, RefreshCw, Calendar } from "lucide-react";

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

function formatUSD(value: number) {
  return `$${(value || 0).toFixed(4)}`;
}

function formatKRW(usd: number) {
  return `₩${Math.round((usd || 0) * KRW_RATE).toLocaleString("ko-KR")}`;
}

function formatTokens(value: number) {
  if (!value) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function todayKst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatDateKst(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function thisMonthStartKst(): string {
  const now = new Date();
  return formatDateKst(new Date(now.getFullYear(), now.getMonth(), 1));
}

export default function AiUsage() {
  const [fromDate, setFromDate] = useState(thisMonthStartKst());
  const [toDate, setToDate] = useState(todayKst());

  const { data: budgetData, isLoading: budgetLoading } = useQuery<{ budgetUsd: number }>({
    queryKey: ["/api/ai/budget"],
    queryFn: () => apiRequest("GET", "/api/ai/budget").then((response) => response.json()),
  });

  const { data: rows, isLoading: rowsLoading, refetch } = useQuery<UsageRow[]>({
    queryKey: ["/api/ai/usage-daily", fromDate, toDate],
    queryFn: () => {
      const params = new URLSearchParams({
        scopeType: "login",
        fromDate,
        toDate,
        limit: "1000",
      });
      return apiRequest("GET", `/api/ai/usage-daily?${params.toString()}`).then((response) => response.json());
    },
  });

  const budgetUsd = budgetData?.budgetUsd ?? 0;
  const dataRows = Array.isArray(rows) ? rows : [];

  const totals = useMemo(() => {
    return dataRows.reduce(
      (summary, row) => ({
        requestCount: summary.requestCount + Number(row.requestCount || 0),
        totalTokens: summary.totalTokens + Number(row.totalTokens || 0),
        costUsd: summary.costUsd + Number.parseFloat(row.costUsd || "0"),
      }),
      { requestCount: 0, totalTokens: 0, costUsd: 0 },
    );
  }, [dataRows]);

  const applyThisMonth = () => {
    setFromDate(thisMonthStartKst());
    setToDate(todayKst());
  };

  const applyLastThreeMonths = () => {
    const now = new Date();
    setFromDate(formatDateKst(addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -2)));
    setToDate(todayKst());
  };

  const applyLastThirtyDays = () => {
    const start = new Date();
    start.setDate(start.getDate() - 29);
    setFromDate(formatDateKst(start));
    setToDate(todayKst());
  };

  if (budgetLoading || rowsLoading) {
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
            <div className="text-sm text-muted-foreground">선택 기간 누적 비용</div>
            <div className="text-2xl font-bold text-violet-600">{formatUSD(totals.costUsd)}</div>
            <div className="text-xs text-muted-foreground">{formatKRW(totals.costUsd)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">선택 기간 호출</div>
            <div className="text-2xl font-bold">{totals.requestCount.toLocaleString("ko-KR")}</div>
            <div className="text-xs text-muted-foreground">{formatTokens(totals.totalTokens)} tokens</div>
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
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-4 h-4" /> 조회 필터
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={applyThisMonth} data-testid="button-ai-usage-this-month">
              이번달
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={applyLastThreeMonths} data-testid="button-ai-usage-last-3-months">
              지난 3개월
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={applyLastThirtyDays} data-testid="button-ai-usage-last-30-days">
              최근 30일
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="aiUsageFromDate">시작일</Label>
              <Input
                id="aiUsageFromDate"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                data-testid="input-ai-usage-from-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aiUsageToDate">종료일</Label>
              <Input
                id="aiUsageToDate"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                data-testid="input-ai-usage-to-date"
              />
            </div>
            <Button onClick={() => refetch()} variant="outline" data-testid="button-ai-usage-refresh">
              <RefreshCw className="w-4 h-4 mr-2" /> 조회
            </Button>
          </div>
        </CardContent>
      </Card>

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
                {dataRows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 font-mono">{row.usageDate}</td>
                    <td className="py-2 text-right">{row.requestCount}</td>
                    <td className="py-2 text-right">{formatTokens(row.totalTokens)}</td>
                    <td className="py-2 text-right font-mono">{formatUSD(Number.parseFloat(row.costUsd))}</td>
                  </tr>
                ))}
                {dataRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-muted-foreground">기록이 없습니다.</td>
                  </tr>
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
