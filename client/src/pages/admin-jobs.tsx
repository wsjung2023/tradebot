import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, RotateCcw, Clock, Activity, AlertCircle, Info, Check } from "lucide-react";

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
}

const NO_RUN_NOW = new Set(["agent-watcher"]);

/** 분을 4자리 0패딩 문자열로 표시: 5 → "0005", 90 → "0090" */
function padMinutes(n: number): string {
  return String(n).padStart(4, "0");
}

/** 4자리 문자열을 분으로 파싱: "0090" → 90 */
function parseMinutes(s: string): number | null {
  const n = parseInt(s.replace(/^0+/, "") || "0", 10);
  if (isNaN(n) || n < 1 || n > 10080) return null;
  return n;
}

function IntervalEditor({ job, onSaved }: { job: JobInfo; onSaved: () => void }) {
  const { toast } = useToast();

  const [minutesVal, setMinutesVal] = useState(() => padMinutes(job.intervalMinutes));
  const [secondsVal, setSecondsVal] = useState(() => String(job.intervalSeconds));
  const [timeVal, setTimeVal] = useState(() => job.scheduleTime || "16:00");

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("PATCH", `/api/admin/jobs/${job.id}`, body),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: data?.message || "주기 변경 완료" });
      onSaved();
    },
    onError: (err: any) => toast({ variant: "destructive", title: err?.message || "주기 변경 실패" }),
  });

  const handleApply = () => {
    if (job.intervalType === "time-of-day") {
      if (!/^\d{1,2}:\d{2}$/.test(timeVal)) {
        toast({ variant: "destructive", title: "HH:MM 형식으로 입력하세요 (예: 16:00)" });
        return;
      }
      patchMutation.mutate({ scheduleTime: timeVal });
    } else if (job.intervalType === "seconds") {
      const s = parseInt(secondsVal, 10);
      if (isNaN(s) || s < 10 || s > 3600) {
        toast({ variant: "destructive", title: "10~3600초 사이로 입력하세요" });
        return;
      }
      patchMutation.mutate({ intervalSeconds: s });
    } else {
      const m = parseMinutes(minutesVal);
      if (m === null) {
        toast({ variant: "destructive", title: "1~10080 사이의 분 값을 입력하세요" });
        return;
      }
      patchMutation.mutate({ intervalMinutes: m });
    }
  };

  if (job.intervalType === "time-of-day") {
    return (
      <div className="flex items-center gap-2" data-testid={`interval-editor-${job.id}`}>
        <span className="text-xs text-muted-foreground shrink-0">실행 시각</span>
        <Input
          className="w-24 h-11 text-sm font-mono text-center md:h-8"
          value={timeVal}
          onChange={(e) => setTimeVal(e.target.value)}
          placeholder="16:00"
          maxLength={5}
          data-testid={`input-interval-${job.id}`}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleApply}
          disabled={patchMutation.isPending}
          data-testid={`button-apply-interval-${job.id}`}
        >
          <Check className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  if (job.intervalType === "seconds") {
    return (
      <div className="flex items-center gap-2" data-testid={`interval-editor-${job.id}`}>
        <span className="text-xs text-muted-foreground shrink-0">감시 주기</span>
        <Input
          className="w-20 h-11 text-sm font-mono text-center md:h-8"
          value={secondsVal}
          onChange={(e) => setSecondsVal(e.target.value.replace(/\D/g, ""))}
          placeholder="60"
          maxLength={4}
          data-testid={`input-interval-${job.id}`}
        />
        <span className="text-xs text-muted-foreground shrink-0">초</span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleApply}
          disabled={patchMutation.isPending}
          data-testid={`button-apply-interval-${job.id}`}
        >
          <Check className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  // 분 단위
  return (
    <div className="flex items-center gap-2" data-testid={`interval-editor-${job.id}`}>
      <span className="text-xs text-muted-foreground shrink-0">주기</span>
      <Input
        className="w-20 h-11 text-sm font-mono text-center tracking-widest md:h-8"
        value={minutesVal}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
          setMinutesVal(raw);
        }}
        onBlur={(e) => {
          const n = parseInt(e.target.value.replace(/^0+/, "") || "0", 10);
          if (!isNaN(n) && n >= 1) setMinutesVal(padMinutes(n));
        }}
        placeholder="0005"
        maxLength={6}
        data-testid={`input-interval-${job.id}`}
      />
      <span className="text-xs text-muted-foreground shrink-0">분</span>
      <Button
        size="sm"
        variant="outline"
        onClick={handleApply}
        disabled={patchMutation.isPending}
        data-testid={`button-apply-interval-${job.id}`}
      >
        <Check className="w-3 h-3" />
      </Button>
    </div>
  );
}

export default function AdminJobs() {
  const { toast } = useToast();

  const { data: jobs = [], isLoading, refetch } = useQuery<JobInfo[]>({
    queryKey: ["/api/admin/jobs"],
    refetchInterval: 10000,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/jobs/${id}/start`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: `[${id}] 시작됨`, description: "서버 재시작 후에도 유지됩니다." });
    },
    onError: () => toast({ variant: "destructive", title: "시작 실패" }),
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/jobs/${id}/stop`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: `[${id}] 중지됨`, description: "서버 재시작 후에도 중지 상태가 유지됩니다." });
    },
    onError: () => toast({ variant: "destructive", title: "중지 실패" }),
  });

  const runNowMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/jobs/${id}/run`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: `[${id}] 즉시 실행 완료` });
    },
    onError: (_err, id) => toast({ variant: "destructive", title: `[${id}] 즉시 실행 실패` }),
  });

  const formatDate = (iso: string | null) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("ko-KR");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">배치잡 관리</h1>
          <p className="text-muted-foreground mt-1">
            자동매매, 학습, 잔고 갱신, 에이전트 감시 등 모든 백그라운드 작업을 제어합니다.
          </p>
        </div>
        <Button
          variant="outline"
          size="default"
          onClick={() => refetch()}
          disabled={isLoading}
          data-testid="button-refresh-jobs"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 rounded-md px-4 py-3">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          시작/중지 상태와 <strong>주기 설정</strong>이 DB에 저장되어{" "}
          <strong>서버 재시작 후에도 유지</strong>됩니다.
        </span>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-28" />
            </Card>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
            <AlertCircle className="w-5 h-5" />
            <span>등록된 배치잡이 없습니다.</span>
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
                  <Badge
                    variant={job.status === "running" ? "default" : "secondary"}
                    data-testid={`status-job-${job.id}`}
                  >
                    {job.status === "running" ? "실행 중" : "중지됨"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{job.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>마지막 실행: {formatDate(job.lastRun)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>다음 실행: {formatDate(job.nextRun)}</span>
                  </div>
                  {job.runCount > 0 && (
                    <div className="text-xs">
                      실행 {job.runCount}회
                      {job.errorCount > 0 && (
                        <span className="text-destructive ml-2">오류 {job.errorCount}회</span>
                      )}
                    </div>
                  )}
                </div>

                {job.lastError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{job.lastError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {job.status !== "running" ? (
                    <Button
                      size="sm"
                      onClick={() => startMutation.mutate(job.id)}
                      disabled={startMutation.isPending}
                      data-testid={`button-start-${job.id}`}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      시작
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => stopMutation.mutate(job.id)}
                      disabled={stopMutation.isPending}
                      data-testid={`button-stop-${job.id}`}
                    >
                      <Square className="w-3 h-3 mr-1" />
                      중지
                    </Button>
                  )}
                  {!NO_RUN_NOW.has(job.id) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runNowMutation.mutate(job.id)}
                      disabled={runNowMutation.isPending}
                      data-testid={`button-runnow-${job.id}`}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      즉시 실행
                    </Button>
                  )}

                  <div className="ml-auto">
                    <IntervalEditor
                      job={job}
                      onSaved={() => refetch()}
                    />
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
