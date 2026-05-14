import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Monitor, CircleDot, Clock, ArrowDownCircle, ArrowUpCircle, MinusCircle, AlertTriangle, Loader2, Bell, Power, GraduationCap } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface JobInfo {
  id: string;
  name: string;
  status: "running" | "stopped";
  scheduleLabel: string;
  lastRun: string | null;
  nextRun: string | null;
  runCount: number;
  errorCount: number;
  lastError: string | null;
}

interface EngineRun {
  state: string;
  lastCycleAt: string | null;
}

interface CandidateEvaluation {
  confidence?: number;
  themeScore?: number;
  newsScore?: number;
  financialsScore?: number;
  liquidityScore?: number;
}

interface CandidateStock {
  id: number;
  stockCode: string;
  stockName: string;
  scannedLine: number | null;
  scannedAt: string;
  evaluationResult: CandidateEvaluation | null;
  skipReason: string | null;
  evaluatedAt: string | null;
  modelId: number;
}

interface NotificationPayload {
  confidence?: number;
  themeScore?: number;
  newsScore?: number;
  financialsScore?: number;
  liquidityScore?: number;
  institutionalScore?: number;
  skipReason?: string;
  profitLoss?: number;
  confidenceBreakdown?: {
    weights?: {
      theme?: number;
      news?: number;
      financials?: number;
      liquidity?: number;
      institutional?: number;
    };
    scores?: {
      theme?: number;
      news?: number;
      financials?: number;
      liquidity?: number;
      institutional?: number;
    };
    weightedSum?: number;
    denominator?: number;
    calculatedConfidence?: number;
    minAiConfidence?: number;
  };
}

interface EngineNotification {
  id: number;
  type: string;
  severity: string;
  message: string;
  payload: NotificationPayload | null;
  createdAt: string;
  readAt: string | null;
}

interface NotifSummary {
  total: number;
  unreadTotal: number;
  unreadCrit: number;
  unreadWarn: number;
}

interface LearningLatestRecord {
  createdAt: string;
  totalTrades: number;
  winRate: string | number | null;
  avgReturn: string | number | null;
  applied: boolean;
  recommendations: string[];
}

interface LearningModelSummary {
  modelId: number;
  modelName: string;
  isActive: boolean;
  latestRecord: LearningLatestRecord | null;
}

interface LearningSummaryResponse {
  learningEnabled: boolean;
  defaultScheduleTime: string;
  models: LearningModelSummary[];
}

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "-";
  }
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
}

function formatPercent(value: string | number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "-";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return "-";
  return `${n.toFixed(digits)}%`;
}

function JobCard({ job }: { job: JobInfo }) {
  const isRunning = job.status === "running";
  return (
    <Card data-testid={`card-job-${job.id}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{job.name}</span>
          <Badge variant={isRunning ? "default" : "secondary"}>
            <CircleDot className="h-3 w-3 mr-1" />
            {isRunning ? "실행중" : "정지"}
          </Badge>
        </div>
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>마지막: {formatTime(job.lastRun)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1 text-xs text-muted-foreground">
          <span>{job.scheduleLabel}</span>
          <span>실행 {job.runCount}회 / 오류 {job.errorCount}회</span>
        </div>
        {job.lastError && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-1 truncate">{job.lastError}</p>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case "BUY": return <ArrowDownCircle className="h-4 w-4 text-green-500 shrink-0" />;
    case "SELL": return <ArrowUpCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case "SKIP": return <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
    default: return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
  }
}

function typeBadgeVariant(type: string) {
  switch (type) {
    case "BUY": return "default" as const;
    case "SELL": return "destructive" as const;
    default: return "secondary" as const;
  }
}

export default function Monitoring() {
  const { data: jobsData } = useQuery<JobInfo[]>({
    queryKey: ["/api/admin/jobs"],
    refetchInterval: 30_000,
  });

  const { data: engineData } = useQuery<{ initialized: boolean; run: EngineRun | null }>({
    queryKey: ["/api/auto-trading/engine-status"],
    refetchInterval: 30_000,
  });

  const { data: candidatesData, isLoading: candidatesLoading } = useQuery<{ candidates: CandidateStock[] }>({
    queryKey: ["/api/auto-trading/candidates"],
    refetchInterval: 30_000,
  });

  const { data: notifData, isLoading: notifLoading } = useQuery<{ notifications: EngineNotification[] }>({
    queryKey: ["/api/auto-trading/notifications", { limit: 100 }],
    queryFn: async () => {
      const resp = await fetch("/api/auto-trading/notifications?limit=100", { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to fetch notifications");
      return resp.json();
    },
    refetchInterval: 30_000,
  });

  const { data: summaryData } = useQuery<{ summary: NotifSummary }>({
    queryKey: ["/api/auto-trading/notifications/summary"],
    refetchInterval: 30_000,
  });

  const { data: learningSummaryData, isLoading: learningSummaryLoading } = useQuery<LearningSummaryResponse>({
    queryKey: ["/api/ai/learning-summary"],
    refetchInterval: 60_000,
  });

  const jobs = jobsData ?? [];
  const engineRun = engineData?.run;
  const candidates = candidatesData?.candidates ?? [];
  const decisionTypes = new Set(["BUY", "SELL", "SKIP", "ADDITIONAL_BUY", "EXIT_SELL"]);
  const notifications = (notifData?.notifications ?? []).filter((n) => decisionTypes.has(n.type));
  const summary = summaryData?.summary;
  const learningModels = learningSummaryData?.models ?? [];
  const activeLearningModels = learningModels.filter((m) => m.isActive);
  const learningJob = jobs.find((j) => j.id === "learning");

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" data-testid="text-monitoring-title">
            <Monitor className="h-7 w-7" />
            실시간 자동매매 모니터
          </h1>
          <p className="text-muted-foreground mt-1">봇 상태, 후보 종목, 매매 결정을 실시간으로 확인합니다 (30초 자동갱신)</p>
        </div>
        {engineRun && (
          <Badge variant={engineRun.state === "running" ? "default" : "secondary"} data-testid="badge-engine-state">
            <Power className="h-3 w-3 mr-1" />
            엔진: {engineRun.state === "running" ? "가동중" : engineRun.state}
            {engineRun.lastCycleAt && <span className="ml-1">({formatTime(engineRun.lastCycleAt)})</span>}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {jobs.length > 0 ? jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        )) : (
          <>
            {["스캔 잡", "매매 잡", "학습 잡"].map((name) => (
              <Card key={name}>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{name}</span>
                    <Badge variant="secondary">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      로딩중
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      {summary && (
        <Card data-testid="card-notification-summary">
          <CardContent className="pt-3 pb-3 px-4">
            <div className="flex items-center flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Bell className="h-4 w-4" />
                <span className="font-medium">알림 요약</span>
              </div>
              <span>전체: {summary.total}건</span>
              <span>미확인: {summary.unreadTotal}건</span>
              {summary.unreadCrit > 0 && (
                <Badge variant="destructive" className="text-xs">긴급 {summary.unreadCrit}</Badge>
              )}
              {summary.unreadWarn > 0 && (
                <Badge variant="secondary" className="text-xs">경고 {summary.unreadWarn}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-learning-summary">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            학습 요약
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <Badge variant={learningSummaryData?.learningEnabled ? "default" : "secondary"}>
              학습 플래그: {learningSummaryData?.learningEnabled ? "ON" : "OFF"}
            </Badge>
            <Badge variant="outline">기본 실행시각: {learningSummaryData?.defaultScheduleTime ?? "16:00"}</Badge>
            <Badge variant={learningJob?.status === "running" ? "default" : "secondary"}>
              학습 잡: {learningJob?.status === "running" ? "실행중" : "중지"}
            </Badge>
            <Badge variant="outline">다음 실행: {learningJob?.nextRun ? formatDateTime(learningJob.nextRun) : "-"}</Badge>
            <Badge variant="outline">활성 모델: {activeLearningModels.length}개</Badge>
          </div>

          {learningSummaryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : activeLearningModels.length === 0 ? (
            <p className="text-sm text-muted-foreground">활성 모델이 없어서 학습 대상이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {activeLearningModels.map((m) => {
                const rec = m.latestRecord;
                const lastRecommendation = rec?.recommendations?.[0];
                return (
                  <div key={m.modelId} className="rounded-md border border-border/40 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{m.modelName}</p>
                      <Badge variant={rec?.applied ? "default" : "secondary"} className="text-xs">
                        {rec ? (rec.applied ? "자동반영됨" : "추천만 생성") : "학습기록 없음"}
                      </Badge>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>최근 학습: {rec ? formatDateTime(rec.createdAt) : "-"}</span>
                      <span>거래수: {rec?.totalTrades ?? "-"}</span>
                      <span>승률: {formatPercent(rec?.winRate, 1)}</span>
                      <span>평균수익: {formatPercent(rec?.avgReturn, 2)}</span>
                    </div>
                    {lastRecommendation && (
                      <p className="text-xs text-muted-foreground truncate">{lastRecommendation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">후보 종목 ({candidates.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {candidatesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm" data-testid="text-no-candidates">
                후보 종목이 없습니다
              </div>
            ) : (
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>종목</TableHead>
                      <TableHead className="w-[70px]">라인</TableHead>
                      <TableHead className="w-[90px]">스캔시각</TableHead>
                      <TableHead className="w-[80px]">결과</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c) => {
                      const evalResult = c.evaluationResult;
                      const confidence = evalResult?.confidence;
                      return (
                        <TableRow key={c.id} data-testid={`row-candidate-${c.id}`}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{c.stockName}</span>
                              <span className="text-xs text-muted-foreground font-mono">{c.stockCode}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {c.scannedLine != null ? (
                              <Badge variant="outline">{c.scannedLine}%</Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateTime(c.scannedAt)}
                          </TableCell>
                          <TableCell>
                            {c.skipReason ? (
                              <Badge variant="secondary" className="text-xs">{c.skipReason}</Badge>
                            ) : confidence != null ? (
                              <Badge variant="default" className="text-xs">{Number(confidence).toFixed(0)}%</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">대기</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">매매 결정 피드</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {notifLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm" data-testid="text-no-notifications">
                매매 결정 기록이 없습니다
              </div>
            ) : (
              <ScrollArea className="max-h-[500px]">
                <div className="divide-y">
                  {notifications.map((n) => {
                    const payload = n.payload;
                    return (
                      <div key={n.id} className="px-4 py-3 space-y-1" data-testid={`row-notification-${n.id}`}>
                        <div className="flex items-center gap-2">
                          <NotificationIcon type={n.type} />
                          <Badge variant={typeBadgeVariant(n.type)} className="text-xs">{n.type}</Badge>
                          <span className="text-xs text-muted-foreground ml-auto">{formatTime(n.createdAt)}</span>
                        </div>
                        <p className="text-sm">{n.message}</p>
                        {payload && (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {payload.confidence != null && <span>신뢰도: {Number(payload.confidence).toFixed(1)}%</span>}
                              {payload.themeScore != null && <span>테마: {payload.themeScore}</span>}
                              {payload.newsScore != null && <span>뉴스: {payload.newsScore}</span>}
                              {payload.financialsScore != null && <span>재무: {payload.financialsScore}</span>}
                              {payload.liquidityScore != null && <span>유동성: {payload.liquidityScore}</span>}
                              {payload.institutionalScore != null && <span>기관수급: {payload.institutionalScore}</span>}
                              {payload.skipReason && <span className="font-medium">{payload.skipReason}</span>}
                              {payload.profitLoss != null && (
                                <span className={Number(payload.profitLoss) > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                  P/L: {Number(payload.profitLoss) > 0 ? "+" : ""}{Number(payload.profitLoss).toLocaleString()}원
                                </span>
                              )}
                            </div>
                            {payload.confidenceBreakdown?.weights && payload.confidenceBreakdown?.scores && (
                              <div className="text-[11px] text-muted-foreground rounded border px-2 py-1">
                                <span className="font-medium">계산 근거:</span>{" "}
                                {`(${payload.confidenceBreakdown.scores.theme ?? 0}×${payload.confidenceBreakdown.weights.theme ?? 0} + `}
                                {`${payload.confidenceBreakdown.scores.news ?? 0}×${payload.confidenceBreakdown.weights.news ?? 0} + `}
                                {`${payload.confidenceBreakdown.scores.financials ?? 0}×${payload.confidenceBreakdown.weights.financials ?? 0} + `}
                                {`${payload.confidenceBreakdown.scores.liquidity ?? 0}×${payload.confidenceBreakdown.weights.liquidity ?? 0} + `}
                                {`${payload.confidenceBreakdown.scores.institutional ?? 0}×${payload.confidenceBreakdown.weights.institutional ?? 0}) / `}
                                {`${payload.confidenceBreakdown.denominator ?? 100}`}
                                {` = ${(payload.confidenceBreakdown.calculatedConfidence ?? payload.confidence ?? 0).toFixed(2)}%`}
                                {payload.confidenceBreakdown.minAiConfidence != null && (
                                  <span>{` (최소 ${payload.confidenceBreakdown.minAiConfidence}%)`}</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
