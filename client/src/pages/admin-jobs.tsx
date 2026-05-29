import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Activity, AlertCircle, Check, Clock, Info, Play, RefreshCw, RotateCcw, Square } from "lucide-react";

interface JobInfo {
  id: string;
  name: string;
  description: string;
  status: "running" | "stopped";
  lastRun: string | null;
  nextRun: string | null;
  intervalType: "minutes" | "time-of-day" | "seconds";
  intervalMinutes: number;
  intervalSeconds: number;
  scheduleTime: string;
  scheduleLabel: string;
  runCount: number;
  errorCount: number;
  lastError: string | null;
  isCurrentlyExecuting: boolean;
  learningRuntime?: {
    featureEnabled: boolean;
    lastTriggeredAt: string | null;
    lastCompletedAt: string | null;
    lastOutcome: "executed" | "skipped" | "error" | null;
    lastReason: string | null;
    lastError: string | null;
    lastActiveModelCount: number | null;
    lastOptimizedModelCount: number | null;
  };
}

const NO_RUN_NOW = new Set<string>();

function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR");
}

function clampInt(value: string, min: number, max: number): number | null {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function IntervalEditor({ job, onSaved }: { job: JobInfo; onSaved: () => void }) {
  const { toast } = useToast();
  const [minutesVal, setMinutesVal] = useState(String(job.intervalMinutes || 1));
  const [secondsVal, setSecondsVal] = useState(String(job.intervalSeconds || 15));
  const [timeVal, setTimeVal] = useState(job.scheduleTime || "16:00");

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("PATCH", `/api/admin/jobs/${job.id}`, body),
    onSuccess: async (res) => {
      const json = await res.json().catch(() => ({}));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: json?.message || "주기 변경 완료" });
      onSaved();
    },
    onError: (err: any) => toast({ variant: "destructive", title: err?.message || "주기 변경 실패" }),
  });

  const onApply = () => {
    if (job.intervalType === "time-of-day") {
      if (!/^\d{1,2}:\d{2}$/.test(timeVal)) {
        toast({ variant: "destructive", title: "시간 형식은 HH:MM 이어야 합니다." });
        return;
      }
      patchMutation.mutate({ scheduleTime: timeVal });
      return;
    }

    if (job.intervalType === "seconds") {
      const sec = clampInt(secondsVal, 2, 3600);
      if (sec == null) {
        toast({ variant: "destructive", title: "초 단위는 2~3600 범위여야 합니다." });
        return;
      }
      patchMutation.mutate({ intervalSeconds: sec });
      return;
    }

    const min = clampInt(minutesVal, 1, 10080);
    if (min == null) {
      toast({ variant: "destructive", title: "분 단위는 1~10080 범위여야 합니다." });
      return;
    }
    patchMutation.mutate({ intervalMinutes: min });
  };

  if (job.intervalType === "time-of-day") {
    return (
      <div className="flex items-center gap-2" data-testid={`interval-editor-${job.id}`}>
        <span className="text-xs text-muted-foreground">실행시간</span>
        <Input
          className="w-24 h-9 font-mono text-center"
          value={timeVal}
          onChange={(e) => setTimeVal(e.target.value)}
          maxLength={5}
          data-testid={`input-interval-${job.id}`}
        />
        <Button size="sm" variant="outline" onClick={onApply} disabled={patchMutation.isPending} data-testid={`button-apply-interval-${job.id}`}>
          <Check className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  if (job.intervalType === "seconds") {
    return (
      <div className="flex items-center gap-2" data-testid={`interval-editor-${job.id}`}>
        <span className="text-xs text-muted-foreground">주기</span>
        <Input
          className="w-20 h-9 font-mono text-center"
          value={secondsVal}
          onChange={(e) => setSecondsVal(e.target.value.replace(/\D/g, "").slice(0, 4))}
          data-testid={`input-interval-${job.id}`}
        />
        <span className="text-xs text-muted-foreground">초</span>
        <Button size="sm" variant="outline" onClick={onApply} disabled={patchMutation.isPending} data-testid={`button-apply-interval-${job.id}`}>
          <Check className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" data-testid={`interval-editor-${job.id}`}>
      <span className="text-xs text-muted-foreground">주기</span>
      <Input
        className="w-20 h-9 font-mono text-center"
        value={minutesVal}
        onChange={(e) => setMinutesVal(e.target.value.replace(/\D/g, "").slice(0, 5))}
        data-testid={`input-interval-${job.id}`}
      />
      <span className="text-xs text-muted-foreground">분</span>
      <Button size="sm" variant="outline" onClick={onApply} disabled={patchMutation.isPending} data-testid={`button-apply-interval-${job.id}`}>
        <Check className="w-3 h-3" />
      </Button>
    </div>
  );
}

export default function AdminJobs() {
  const { toast } = useToast();
  const { data: jobs = [], isLoading, refetch } = useQuery<JobInfo[]>({
    queryKey: ["/api/admin/jobs"],
    refetchInterval: 10_000,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/jobs/${id}/start`),
    onSuccess: async (_res, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: `[${id}] 시작 완료` });
    },
    onError: () => toast({ variant: "destructive", title: "시작 실패" }),
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/jobs/${id}/stop`),
    onSuccess: async (_res, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: `[${id}] 중지 완료` });
    },
    onError: () => toast({ variant: "destructive", title: "중지 실패" }),
  });

  const runNowMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/jobs/${id}/run`),
    onSuccess: async (_res, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: `[${id}] 즉시 실행 완료` });
    },
    onError: (_err, id) => toast({ variant: "destructive", title: `[${id}] 즉시 실행 실패` }),
  });

  const stats = useMemo(() => {
    return {
      total: jobs.length,
      running: jobs.filter((j) => j.status === "running").length,
      stopped: jobs.filter((j) => j.status === "stopped").length,
    };
  }, [jobs]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">배치 잡 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">운영 배치의 시작/중지, 주기 조정, 즉시 실행을 제어합니다.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading} data-testid="button-refresh-jobs">
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-md px-4 py-3">
        <Info className="w-4 h-4 shrink-0" />
        <span>총 {stats.total}개 잡 중 실행 {stats.running}개, 중지 {stats.stopped}개</span>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((v) => (
            <Card key={v} className="animate-pulse">
              <CardContent className="h-28" />
            </Card>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-8 flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span>등록된 잡이 없습니다.</span>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <Card key={job.id} data-testid={`card-job-${job.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-base">{job.name}</CardTitle>
                    <span className="text-xs text-muted-foreground">({job.scheduleLabel})</span>
                  </div>
                  <Badge variant={job.status === "running" ? "default" : "secondary"} data-testid={`status-job-${job.id}`}>
                    {job.status === "running" ? "실행중" : "중지"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{job.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>마지막 실행: {formatDate(job.lastRun)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>다음 실행: {formatDate(job.nextRun)}</span>
                  </div>
                  <div>실행 {job.runCount}회 / 오류 {job.errorCount}회</div>
                </div>

                {job.lastError && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{job.lastError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {job.status === "running" ? (
                    <Button size="sm" variant="destructive" onClick={() => stopMutation.mutate(job.id)} data-testid={`button-stop-${job.id}`}>
                      <Square className="w-3 h-3 mr-1" />
                      중지
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => startMutation.mutate(job.id)} data-testid={`button-start-${job.id}`}>
                      <Play className="w-3 h-3 mr-1" />
                      시작
                    </Button>
                  )}

                  {!NO_RUN_NOW.has(job.id) && (
                    <Button size="sm" variant="outline" onClick={() => runNowMutation.mutate(job.id)} data-testid={`button-runnow-${job.id}`}>
                      <RotateCcw className="w-3 h-3 mr-1" />
                      즉시 실행
                    </Button>
                  )}

                  <div className="ml-auto">
                    <IntervalEditor job={job} onSaved={() => refetch()} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
