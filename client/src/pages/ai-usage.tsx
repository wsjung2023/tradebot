import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Coins, TrendingUp, Zap, AlertTriangle, RefreshCw, DollarSign,
  Bot, Calendar,
} from "lucide-react";

// ── 모델별 단가 (per 1M tokens, USD) ──────────────────────────────────────────
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5-mini":       { input: 1.25,  output: 2.0  },
  "gpt-4.1":          { input: 2.0,   output: 8.0  },
  "gpt-5.1":          { input: 1.25,  output: 10.0 },
  "gpt-5.1-chat-latest": { input: 1.25, output: 10.0 },
  "gpt-4o":           { input: 2.5,   output: 10.0 },
  "claude-sonnet-4":  { input: 3.0,   output: 15.0 },
};

const PIE_COLORS = [
  "#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa",
];

const KRW_RATE = 1380; // 대략적 환율 (실시간 아님)

interface UsageRow {
  id: number;
  usageDate: string;
  userId: string;
  scopeType: "login" | "account";
  scopeKey: string;
  accountId: number | null;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: string;
  createdAt: string;
  updatedAt: string;
}

function formatUSD(v: number) {
  return `$${v.toFixed(4)}`;
}
function formatKRW(usd: number) {
  return `₩${Math.round(usd * KRW_RATE).toLocaleString()}`;
}
function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// 날짜 범위 헬퍼
function kstToday() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}
function monthStart(offset = 0) {
  const d = new Date(Date.now() + 9 * 3600_000);
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 10);
}

export default function AiUsage() {
  const { toast } = useToast();
  const { data: budgetData, refetch: refetchBudget } = useQuery<{ budgetUsd: number }>({
    queryKey: ["/api/ai/budget"],
    queryFn: () => apiRequest("GET", "/api/ai/budget"),
  });

  const [budgetEdit, setBudgetEdit] = useState("");
  const [editingBudget, setEditingBudget] = useState(false);

  const budgetUsd = budgetData?.budgetUsd ?? 0;

  const saveBudgetMutation = useMutation({
    mutationFn: async (val: number) => {
      return await apiRequest("POST", "/api/ai/budget", { budgetUsd: val });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/budget"] });
      setEditingBudget(false);
      toast({ title: "예산 설정이 저장되었습니다." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "저장 실패", description: err.message });
    },
  });

  // 이번 달 데이터
  const fromDate = monthStart(0);
  const toDate = kstToday();

  const { data: rows = [], isLoading, refetch } = useQuery<UsageRow[]>({
    queryKey: ["/api/ai/usage-daily", fromDate, toDate],
    queryFn: () =>
      apiRequest("GET", `/api/ai/usage-daily?fromDate=${fromDate}&toDate=${toDate}&scopeType=login&limit=60`),
    refetchInterval: 60_000,
  });

  // 지난 달 데이터 (전달 대비 비교용)
  const prevFrom = monthStart(-1);
  const prevTo = new Date(new Date(fromDate).getTime() - 86400_000).toISOString().slice(0, 10);
  const { data: prevRows = [] } = useQuery<UsageRow[]>({
    queryKey: ["/api/ai/usage-daily", prevFrom, prevTo],
    queryFn: () =>
      apiRequest("GET", `/api/ai/usage-daily?fromDate=${prevFrom}&toDate=${prevTo}&scopeType=login&limit=60`),
  });

  // ── 집계 계산 ─────────────────────────────────────────────────────────────
  const thisMonthTotal = useMemo(() => {
    return rows.reduce((sum, r) => sum + parseFloat(r.costUsd || "0"), 0);
  }, [rows]);

  const prevMonthTotal = useMemo(() => {
    return prevRows.reduce((sum, r) => sum + parseFloat(r.costUsd || "0"), 0);
  }, [prevRows]);

  const thisMonthTokens = useMemo(() => {
    return rows.reduce((sum, r) => sum + (r.totalTokens || 0), 0);
  }, [rows]);

  const thisMonthRequests = useMemo(() => {
    return rows.reduce((sum, r) => sum + (r.requestCount || 0), 0);
  }, [rows]);

  const monthDiff = prevMonthTotal > 0
    ? ((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100
    : 0;

  const budgetNum = budgetUsd;
  const budgetUsedPct = budgetNum > 0 ? (thisMonthTotal / budgetNum) * 100 : 0;
  const overBudget = budgetNum > 0 && thisMonthTotal > budgetNum;

  // ── 일별 바 차트 데이터 ───────────────────────────────────────────────────
  const dailyChart = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const r of rows) {
      byDate.set(r.usageDate, (byDate.get(r.usageDate) || 0) + parseFloat(r.costUsd || "0"));
    }
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, cost]) => ({
        date: date.slice(5),   // MM-DD
        cost: parseFloat(cost.toFixed(6)),
        costKRW: Math.round(cost * KRW_RATE),
      }));
  }, [rows]);

  // ── scopeKey 기반 모델 파이 (실제 모델별 분류는 scope_key를 못 쓰므로 단순 집계) ─
  const pieData = useMemo(() => {
    // scopeKey = "login:{userId}" → 단일 사용자이므로 날짜별 그룹
    if (dailyChart.length === 0) return [];
    // 대신 주/비주 비율로 시각화 (데이터 구조상 모델 분류 없음 → 요청 수 비례로 표시)
    return [
      { name: "AI 분석 호출", value: thisMonthRequests },
    ];
  }, [dailyChart, thisMonthRequests]);

  // ── 예산 저장 ─────────────────────────────────────────────────────────────
  const saveBudget = () => {
    const v = parseFloat(budgetEdit);
    if (isNaN(v) || v < 0) {
      toast({ variant: "destructive", title: "0 이상의 금액을 입력하세요 (USD)" });
      return;
    }
    saveBudgetMutation.mutate(v);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="w-6 h-6 text-violet-500" />
            AI 사용량 모니터
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            이번 달({fromDate} ~ {toDate}) AI API 토큰 사용량 및 비용 현황
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      {/* 예산 초과 경고 */}
      {overBudget && (
        <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>
            이번 달 AI 비용({formatUSD(thisMonthTotal)})이 설정한 예산({formatUSD(budgetNum)})을 초과했습니다!
          </span>
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> 이번 달 비용
            </div>
            <div className="text-xl font-bold text-violet-600">{formatUSD(thisMonthTotal)}</div>
            <div className="text-xs text-muted-foreground">{formatKRW(thisMonthTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> 전달 대비
            </div>
            <div className={`text-xl font-bold ${monthDiff > 0 ? "text-red-500" : "text-green-600"}`}>
              {monthDiff > 0 ? "+" : ""}{monthDiff.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">전달 {formatUSD(prevMonthTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Zap className="w-3 h-3" /> 총 토큰
            </div>
            <div className="text-xl font-bold text-cyan-600">{formatTokens(thisMonthTokens)}</div>
            <div className="text-xs text-muted-foreground">입출력 합산</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Bot className="w-3 h-3" /> 총 호출 수
            </div>
            <div className="text-xl font-bold text-amber-600">{thisMonthRequests.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">API 요청</div>
          </CardContent>
        </Card>
      </div>

      {/* 예산 설정 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            월 예산 한도 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {budgetNum > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>사용량: {formatUSD(thisMonthTotal)}</span>
                <span>한도: {formatUSD(budgetNum)}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${overBudget ? "bg-red-500" : budgetUsedPct > 80 ? "bg-amber-400" : "bg-violet-500"}`}
                  style={{ width: `${Math.min(budgetUsedPct, 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground text-right">{budgetUsedPct.toFixed(1)}% 사용</div>
            </div>
          )}
          <div className="flex items-center gap-2">
            {editingBudget ? (
              <>
                <Input
                  className="w-36 h-8 text-sm"
                  type="number"
                  min="0"
                  step="0.5"
                  value={budgetEdit}
                  onChange={(e) => setBudgetEdit(e.target.value)}
                  placeholder="예: 5.00"
                  autoFocus
                />
                <span className="text-xs text-muted-foreground">USD/월</span>
                <Button size="sm" onClick={saveBudget}>저장</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingBudget(false)}>취소</Button>
              </>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">
                  {budgetNum > 0 ? `현재 한도: ${formatUSD(budgetNum)}/월` : "예산 한도 미설정"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBudgetEdit(budgetUsd);
                    setEditingBudget(true);
                  }}
                >
                  {budgetNum > 0 ? "수정" : "설정"}
                </Button>
                {budgetNum > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => {
                      saveBudgetMutation.mutate(0);
                    }}
                  >
                    제거
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 일별 비용 바 차트 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-500" />
            일별 AI 비용 추이 (USD)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyChart.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              이번 달 데이터가 없습니다
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `$${v.toFixed(3)}`}
                  width={60}
                />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(6)}  (₩${Math.round(value * KRW_RATE).toLocaleString()})`, "비용"]}
                  labelStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="cost" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 모델별 단가 참고표 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-cyan-500" />
            모델별 단가 참고 (per 1M tokens)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-1 pr-4">모델</th>
                  <th className="text-right py-1 pr-4">입력 (Input)</th>
                  <th className="text-right py-1">출력 (Output)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(MODEL_PRICING).map(([model, price]) => (
                  <tr key={model} className="border-b last:border-0">
                    <td className="py-1.5 pr-4 font-mono text-xs">{model}</td>
                    <td className="py-1.5 pr-4 text-right text-green-600">${price.input}/1M</td>
                    <td className="py-1.5 text-right text-amber-600">${price.output}/1M</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 일별 상세 테이블 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">일별 상세 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              이번 달 AI 사용 기록이 없습니다.<br />
              자동매매 또는 AI 분석을 실행하면 여기에 기록됩니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-1 pr-3">날짜</th>
                    <th className="text-right py-1 pr-3">호출</th>
                    <th className="text-right py-1 pr-3">입력 토큰</th>
                    <th className="text-right py-1 pr-3">출력 토큰</th>
                    <th className="text-right py-1 pr-3">합계</th>
                    <th className="text-right py-1 pr-3">비용 (USD)</th>
                    <th className="text-right py-1">비용 (KRW)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const cost = parseFloat(row.costUsd || "0");
                    return (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-1.5 pr-3 font-mono text-xs">{row.usageDate}</td>
                        <td className="py-1.5 pr-3 text-right">{row.requestCount.toLocaleString()}</td>
                        <td className="py-1.5 pr-3 text-right text-green-600">{formatTokens(row.promptTokens)}</td>
                        <td className="py-1.5 pr-3 text-right text-amber-600">{formatTokens(row.completionTokens)}</td>
                        <td className="py-1.5 pr-3 text-right">{formatTokens(row.totalTokens)}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">{formatUSD(cost)}</td>
                        <td className="py-1.5 text-right text-muted-foreground">{formatKRW(cost)}</td>
                      </tr>
                    );
                  })}
                  {/* 합계 행 */}
                  <tr className="border-t-2 font-semibold bg-muted/20">
                    <td className="py-2 pr-3">합계</td>
                    <td className="py-2 pr-3 text-right">{thisMonthRequests.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right text-green-600">
                      {formatTokens(rows.reduce((s, r) => s + r.promptTokens, 0))}
                    </td>
                    <td className="py-2 pr-3 text-right text-amber-600">
                      {formatTokens(rows.reduce((s, r) => s + r.completionTokens, 0))}
                    </td>
                    <td className="py-2 pr-3 text-right">{formatTokens(thisMonthTokens)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-violet-600">{formatUSD(thisMonthTotal)}</td>
                    <td className="py-2 text-right text-muted-foreground">{formatKRW(thisMonthTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
