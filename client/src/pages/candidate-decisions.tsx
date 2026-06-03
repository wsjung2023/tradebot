import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardList, Loader2 } from "lucide-react";

interface AiModelSummary {
  id: number;
  modelName: string;
}

interface CandidateDecisionLogRow {
  id: number;
  modelId: number;
  modelName: string;
  modelType: string;
  stockCode: string;
  stockName: string;
  accepted: boolean;
  rejectReason: string | null;
  aiDecision: Record<string, any> | null;
  decidedAt: string;
  decidedAtKst?: string | null;
}

interface CandidateDecisionResponse {
  total: number;
  logs: CandidateDecisionLogRow[];
  dailySummary: Array<{ date: string; total: number; accepted: number; rejected: number }>;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    const [datePart, timePart] = value.split(" ");
    const [, month, day] = datePart.split("-");
    return `${month}.${day} ${timePart}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatQuantitative(quantitative: Record<string, unknown> | null | undefined): string {
  if (!quantitative || typeof quantitative !== "object") return "-";
  const entries = Object.entries(quantitative).slice(0, 4);
  if (entries.length === 0) return "-";
  return entries.map(([k, v]) => `${k}:${typeof v === "number" ? v.toFixed(2) : String(v)}`).join(" | ");
}

export default function CandidateDecisions() {
  const now = useMemo(() => new Date(), []);
  const weekAgo = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }, [now]);

  const [fromDate, setFromDate] = useState(toDateInputValue(weekAgo));
  const [toDate, setToDate] = useState(toDateInputValue(now));
  const [modelId, setModelId] = useState("all");
  const [acceptedFilter, setAcceptedFilter] = useState<"all" | "accepted" | "rejected">("all");

  const { data: models = [] } = useQuery<AiModelSummary[]>({
    queryKey: ["/api/ai/models"],
  });

  const { data, isLoading, refetch, isFetching } = useQuery<CandidateDecisionResponse>({
    queryKey: ["/api/auto-trading/candidate-decisions", fromDate, toDate, modelId, acceptedFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (modelId !== "all") params.set("modelId", modelId);
      if (acceptedFilter !== "all") params.set("accepted", acceptedFilter === "accepted" ? "true" : "false");
      params.set("limit", "300");
      const res = await fetch(`/api/auto-trading/candidate-decisions?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("failed_to_fetch_candidate_decisions");
      return res.json();
    },
  });

  const logs = data?.logs ?? [];
  const dailySummary = data?.dailySummary ?? [];

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" data-testid="text-candidate-decisions-title">
          <ClipboardList className="h-7 w-7" />
          종목 선정/탈락 이력
        </h1>
        <p className="text-muted-foreground mt-1">
          일자별 종목 선정/탈락 판단 이력과 정성·정량 사유, 모델/설정 스냅샷을 확인합니다.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">조회 조건</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            data-testid="input-decision-from-date"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            data-testid="input-decision-to-date"
          />
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger data-testid="select-decision-model">
              <SelectValue placeholder="전체 모델" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 모델</SelectItem>
              {models.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.modelName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={acceptedFilter} onValueChange={(v: "all" | "accepted" | "rejected") => setAcceptedFilter(v)}>
            <SelectTrigger data-testid="select-decision-status">
              <SelectValue placeholder="결과" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="rejected">탈락</SelectItem>
              <SelectItem value="accepted">선정</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => refetch()} disabled={isFetching} data-testid="button-decision-refetch">
            {isFetching ? "조회 중..." : "새로고침"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">일별 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            요약은 선택 기간/모델 기준 전체(선정+탈락)를 집계합니다. 우측 결과 필터는 아래 상세 로그에만 적용됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
          {dailySummary.length === 0 ? (
            <span className="text-sm text-muted-foreground">조회 범위 내 데이터가 없습니다.</span>
          ) : (
            dailySummary.slice(0, 14).map((d) => (
              <Badge key={d.date} variant="outline" className="text-xs">
                {d.date} / 전체 {d.total} / 선정 {d.accepted} / 탈락 {d.rejected}
              </Badge>
            ))
          )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">상세 로그 ({data?.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm" data-testid="text-no-candidate-decisions">
              로그가 없습니다.
            </div>
          ) : (
            <>
            <div className="md:hidden space-y-3 p-3" data-testid="mobile-candidate-decisions">
              {logs.map((log) => {
                const aiDecision = log.aiDecision ?? {};
                const qualitativeReason = typeof aiDecision.qualitativeReason === "string" ? aiDecision.qualitativeReason : "-";
                const quantitativeReason = (aiDecision.quantitativeReason as Record<string, unknown> | undefined) ?? null;
                const settingsSnapshot = (aiDecision.settingsSnapshot as Record<string, any> | undefined) ?? null;
                const cooldownMode = settingsSnapshot?.aiEntryPolicy?.candidateDecisionCooldownMode ?? "-";

                return (
                  <div key={log.id} className="rounded-xl border bg-card p-3 space-y-2" data-testid={`mobile-row-candidate-decision-${log.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{log.stockName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{log.stockCode} · {formatDateTime(log.decidedAtKst ?? log.decidedAt)}</div>
                      </div>
                      {log.accepted ? (
                        <Badge className="shrink-0">선정</Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">{log.rejectReason || "탈락"}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{log.modelName}</span> · {log.modelType}
                    </div>
                    <div className="rounded-md bg-muted/40 px-3 py-2 text-sm leading-relaxed">
                      {qualitativeReason}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>정량: {formatQuantitative(quantitativeReason)}</div>
                      <div>최소 신뢰도: {String(settingsSnapshot?.minAiConfidence ?? "-")} · 쿨다운: {String(cooldownMode)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block overflow-x-auto">
            <Table data-testid="table-candidate-decisions">
              <TableHeader>
                <TableRow>
                  <TableHead>시각</TableHead>
                  <TableHead>종목</TableHead>
                  <TableHead>모델</TableHead>
                  <TableHead>결과</TableHead>
                  <TableHead>정성 사유</TableHead>
                  <TableHead>정량 사유</TableHead>
                  <TableHead>스냅샷</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const aiDecision = log.aiDecision ?? {};
                  const qualitativeReason = typeof aiDecision.qualitativeReason === "string" ? aiDecision.qualitativeReason : "-";
                  const quantitativeReason = (aiDecision.quantitativeReason as Record<string, unknown> | undefined) ?? null;
                  const modelSnapshot = (aiDecision.modelSnapshot as Record<string, any> | undefined) ?? null;
                  const settingsSnapshot = (aiDecision.settingsSnapshot as Record<string, any> | undefined) ?? null;
                  const cooldownMode = settingsSnapshot?.aiEntryPolicy?.candidateDecisionCooldownMode;
                  const cooldownModeLabel =
                    cooldownMode === "daily_three_slots"
                      ? "하루 3회 (09:10/13:30/15:10)"
                      : cooldownMode === "daily_once"
                        ? "하루 1회"
                        : cooldownMode === "interval_30m"
                          ? "30분"
                          : cooldownMode === "interval_60m"
                            ? "60분"
                        : cooldownMode === "interval_120m"
                          ? "120분"
                          : "-";
                  return (
                    <TableRow key={log.id} data-testid={`row-candidate-decision-${log.id}`}>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(log.decidedAtKst ?? log.decidedAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{log.stockName}</span>
                          <span className="font-mono text-xs text-muted-foreground">{log.stockCode}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{log.modelName}</span>
                          <span className="text-xs text-muted-foreground">{log.modelType}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.accepted ? (
                          <Badge>선정</Badge>
                        ) : (
                          <Badge variant="secondary">{log.rejectReason || "탈락"}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{qualitativeReason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatQuantitative(quantitativeReason)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>AI 모델: {modelSnapshot?.aiModelId ?? "-"}</div>
                        <div>최소 신뢰도: {String(settingsSnapshot?.minAiConfidence ?? "-")}</div>
                        <div>시장 이슈 필수: {String(settingsSnapshot?.requireMarketIssue ?? "-")}</div>
                        <div>재평가 쿨다운: {cooldownModeLabel}</div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
