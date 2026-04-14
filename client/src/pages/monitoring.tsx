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
import { Monitor, CircleDot, Clock, ArrowDownCircle, ArrowUpCircle, MinusCircle, AlertTriangle, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EngineRun {
  state: string;
  lastCycleAt?: string;
  scanJobLastRun?: string;
  tradingJobLastRun?: string;
  learningJobLastRun?: string;
  scanJobState?: string;
  tradingJobState?: string;
  learningJobState?: string;
}

interface CandidateStock {
  id: number;
  stockCode: string;
  stockName: string;
  scannedLine: number | null;
  scannedAt: string;
  evaluationResult: any;
  skipReason: string | null;
  evaluatedAt: string | null;
  modelId: number;
}

interface EngineNotification {
  id: number;
  type: string;
  severity: string;
  message: string;
  payload: any;
  createdAt: string;
  readAt: string | null;
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

function JobCard({ title, state, lastRun }: { title: string; state?: string; lastRun?: string }) {
  const isRunning = state === "running" || state === "active";
  return (
    <Card data-testid={`card-job-${title}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{title}</span>
          <Badge variant={isRunning ? "default" : "secondary"}>
            <CircleDot className="h-3 w-3 mr-1" />
            {isRunning ? "실행중" : state || "정지"}
          </Badge>
        </div>
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>마지막: {formatTime(lastRun)}</span>
        </div>
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

  const run = engineData?.run;
  const candidates = candidatesData?.candidates ?? [];
  const notifications = notifData?.notifications ?? [];

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" data-testid="text-monitoring-title">
          <Monitor className="h-7 w-7" />
          실시간 자동매매 모니터
        </h1>
        <p className="text-muted-foreground mt-1">봇 상태, 후보 종목, 매매 결정을 실시간으로 확인합니다 (30초 자동갱신)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <JobCard
          title="스캔 잡"
          state={run?.scanJobState || (run?.state === "running" ? "running" : undefined)}
          lastRun={run?.scanJobLastRun || run?.lastCycleAt}
        />
        <JobCard
          title="매매 잡"
          state={run?.tradingJobState || (run?.state === "running" ? "running" : undefined)}
          lastRun={run?.tradingJobLastRun || run?.lastCycleAt}
        />
        <JobCard
          title="학습 잡"
          state={run?.learningJobState || (run?.state === "running" ? "running" : undefined)}
          lastRun={run?.learningJobLastRun || run?.lastCycleAt}
        />
      </div>

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
                      const evalResult = c.evaluationResult as any;
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
                              <Badge variant="default" className="text-xs">{confidence.toFixed(0)}%</Badge>
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
                    const payload = n.payload as any;
                    return (
                      <div key={n.id} className="px-4 py-3 space-y-1" data-testid={`row-notification-${n.id}`}>
                        <div className="flex items-center gap-2">
                          <NotificationIcon type={n.type} />
                          <Badge variant={typeBadgeVariant(n.type)} className="text-xs">{n.type}</Badge>
                          <span className="text-xs text-muted-foreground ml-auto">{formatTime(n.createdAt)}</span>
                        </div>
                        <p className="text-sm">{n.message}</p>
                        {payload && (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {payload.confidence != null && <span>신뢰도: {Number(payload.confidence).toFixed(1)}%</span>}
                            {payload.themeScore != null && <span>테마: {payload.themeScore}</span>}
                            {payload.newsScore != null && <span>뉴스: {payload.newsScore}</span>}
                            {payload.financialsScore != null && <span>재무: {payload.financialsScore}</span>}
                            {payload.liquidityScore != null && <span>유동성: {payload.liquidityScore}</span>}
                            {payload.skipReason && <span className="font-medium">{payload.skipReason}</span>}
                            {payload.profitLoss != null && (
                              <span className={Number(payload.profitLoss) > 0 ? "text-green-600" : "text-red-600"}>
                                P/L: {Number(payload.profitLoss) > 0 ? "+" : ""}{Number(payload.profitLoss).toLocaleString()}원
                              </span>
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
