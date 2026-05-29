import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bot, Cpu, Database, Gauge, Monitor, RefreshCw, ShieldAlert, ShieldCheck, Siren, Wifi, WifiOff } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

type Severity = "info" | "warn" | "crit";
type ThresholdField = keyof MonitorThresholds;

interface MonitorThresholds {
  minRequestCountForRateAlert: number;
  http5xxRateWarnPct: number;
  engineStatus401WarnPerMin: number;
  aiMinCallsForAlert: number;
  aiErrorRateWarnPct: number;
  aiAvgLatencyWarnMs: number;
  anomalyCooldownMs: number;
}

interface MonitorSnapshot {
  measuredAt: string;
  db: { ok: boolean; latencyMs: number | null; error: string | null };
  runtime: {
    uptimeSec: number;
    memoryRssMb: number;
    memoryHeapUsedMb: number;
    memoryHeapTotalMb: number;
  };
  httpLast1m: {
    requestCount: number;
    status2xx: number;
    status3xx: number;
    status4xx: number;
    status5xx: number;
    error5xxRatePct: number;
    p95LatencyMs: number;
    engineStatus401Count: number;
  };
  aiLast5m: {
    callCount: number;
    successCount: number;
    errorCount: number;
    errorRatePct: number;
    avgLatencyMs: number;
  };
  jobs: Array<{
    id: string;
    name: string;
    status: "running" | "stopped";
    lastRun: string | null;
    nextRun: string | null;
    errorCount: number;
    lastError: string | null;
  }>;
}

interface SituationResponse {
  monitorJob: {
    running: boolean;
    intervalSec: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
  };
  current: MonitorSnapshot | null;
  history: MonitorSnapshot[];
  anomalies: Array<{
    id: number;
    detectedAt: string;
    severity: Severity;
    kind: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
  ai: {
    recentCalls5m: number;
    recentErrors5m: number;
    recentSuccessRatePct: number;
    avgLatencyMs5m: number;
    traces: Array<{
      id: number;
      timestamp: string;
      source: string;
      model: string;
      success: boolean;
      durationMs: number;
      promptPreview: string;
      contextPreview: string;
      responsePreview: string | null;
      errorMessage: string | null;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }>;
  };
  notificationSummary: {
    total: number;
    unreadTotal: number;
    unreadCrit: number;
    unreadWarn: number;
  };
  recentEngineNotifications: Array<{
    id: number;
    severity: Severity;
    type: string;
    message: string;
    createdAt: string;
  }>;
  thresholds: MonitorThresholds;
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR");
}

function fmtDurationSec(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function severityBadgeVariant(severity: Severity): "default" | "secondary" | "destructive" {
  if (severity === "crit") return "destructive";
  if (severity === "warn") return "secondary";
  return "default";
}

function toEditableThresholds(input: MonitorThresholds) {
  return {
    minRequestCountForRateAlert: String(input.minRequestCountForRateAlert),
    http5xxRateWarnPct: String(input.http5xxRateWarnPct),
    engineStatus401WarnPerMin: String(input.engineStatus401WarnPerMin),
    aiMinCallsForAlert: String(input.aiMinCallsForAlert),
    aiErrorRateWarnPct: String(input.aiErrorRateWarnPct),
    aiAvgLatencyWarnMs: String(input.aiAvgLatencyWarnMs),
    anomalyCooldownMs: String(input.anomalyCooldownMs),
  };
}

export default function MonitoringPage() {
  const { toast } = useToast();
  const [live, setLive] = useState<SituationResponse | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [thresholdForm, setThresholdForm] = useState<Record<ThresholdField, string> | null>(null);

  const query = useQuery<SituationResponse>({
    queryKey: ["/api/monitoring/situation-room"],
    queryFn: async () => {
      const res = await fetch("/api/monitoring/situation-room?historyLimit=120&anomalyLimit=120&traceLimit=80&notificationLimit=80", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`failed_to_load_situation_room (${res.status})`);
      return res.json();
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/monitoring/live");
      es.addEventListener("snapshot", (evt: MessageEvent) => {
        try {
          const payload = JSON.parse(evt.data) as SituationResponse;
          setLive(payload);
          setSseConnected(true);
          setStreamError(null);
        } catch {
          // ignore malformed payload
        }
      });
      es.onerror = () => {
        setSseConnected(false);
        setStreamError("실시간 스트림 연결이 불안정합니다.");
      };
    } catch (e: any) {
      setSseConnected(false);
      setStreamError(e?.message || "스트림 초기화 실패");
    }
    return () => {
      es?.close();
    };
  }, []);

  const data = live ?? query.data ?? null;
  const current = data?.current ?? null;

  useEffect(() => {
    if (!data?.thresholds) return;
    setThresholdForm((prev) => prev ?? toEditableThresholds(data.thresholds));
  }, [data?.thresholds]);

  const updateThresholdField = (field: ThresholdField, value: string) => {
    setThresholdForm((prev) => {
      const base = prev ?? toEditableThresholds(data?.thresholds ?? {
        minRequestCountForRateAlert: 20,
        http5xxRateWarnPct: 8,
        engineStatus401WarnPerMin: 12,
        aiMinCallsForAlert: 3,
        aiErrorRateWarnPct: 30,
        aiAvgLatencyWarnMs: 9000,
        anomalyCooldownMs: 120000,
      });
      return { ...base, [field]: value };
    });
  };

  const saveThresholdMutation = useMutation({
    mutationFn: async () => {
      if (!thresholdForm) throw new Error("임계치 값이 없습니다.");
      const payload = {
        minRequestCountForRateAlert: Number(thresholdForm.minRequestCountForRateAlert),
        http5xxRateWarnPct: Number(thresholdForm.http5xxRateWarnPct),
        engineStatus401WarnPerMin: Number(thresholdForm.engineStatus401WarnPerMin),
        aiMinCallsForAlert: Number(thresholdForm.aiMinCallsForAlert),
        aiErrorRateWarnPct: Number(thresholdForm.aiErrorRateWarnPct),
        aiAvgLatencyWarnMs: Number(thresholdForm.aiAvgLatencyWarnMs),
        anomalyCooldownMs: Number(thresholdForm.anomalyCooldownMs),
      };
      const values = Object.values(payload);
      if (values.some((v) => !Number.isFinite(v))) {
        throw new Error("숫자 형식으로 입력해주세요.");
      }
      const res = await apiRequest("PATCH", "/api/monitoring/config", payload);
      return res.json();
    },
    onSuccess: async (json: any) => {
      const next = json?.thresholds as MonitorThresholds | undefined;
      if (next) {
        setThresholdForm(toEditableThresholds(next));
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/monitoring/situation-room"] });
      await query.refetch();
      toast({ title: "모니터링 임계치 저장 완료" });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "모니터링 임계치 저장 실패",
        description: err?.message || "요청 처리 중 오류가 발생했습니다.",
      });
    },
  });

  const health = useMemo(() => {
    if (!current) return { level: "unknown" as const, message: "데이터 대기중" };
    if (!current.db.ok) return { level: "crit" as const, message: "DB 연결 이상" };
    if (current.httpLast1m.error5xxRatePct >= 8 || current.aiLast5m.errorRatePct >= 30) {
      return { level: "warn" as const, message: "주의 필요" };
    }
    return { level: "ok" as const, message: "정상" };
  }, [current]);

  const thresholdFields: Array<{
    key: ThresholdField;
    label: string;
    suffix: string;
  }> = [
    { key: "minRequestCountForRateAlert", label: "HTTP 에러율 최소 요청 수", suffix: "req" },
    { key: "http5xxRateWarnPct", label: "HTTP 5xx 경고 비율", suffix: "%" },
    { key: "engineStatus401WarnPerMin", label: "engine-status 401 경고 수", suffix: "count/1m" },
    { key: "aiMinCallsForAlert", label: "AI 경고 최소 호출 수", suffix: "calls/5m" },
    { key: "aiErrorRateWarnPct", label: "AI 에러율 경고", suffix: "%" },
    { key: "aiAvgLatencyWarnMs", label: "AI 평균 지연 경고", suffix: "ms" },
    { key: "anomalyCooldownMs", label: "이상감지 중복 억제", suffix: "ms" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" data-testid="text-monitoring-title">
            <Monitor className="w-7 h-7" />
            운영 실시간 상황실
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            배치 상태, 이상탐지, AI 프롬프트/컨텍스트 트레이스, 엔진 알림을 실시간으로 확인합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={sseConnected ? "default" : "secondary"} data-testid="badge-stream-status">
            {sseConnected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
            {sseConnected ? "Live 연결됨" : "Live 끊김"}
          </Badge>
          <Badge variant={data?.monitorJob.running ? "default" : "secondary"} data-testid="badge-monitor-job">
            {data?.monitorJob.running ? "모니터 잡 ON" : "모니터 잡 OFF"}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => query.refetch()} data-testid="button-refresh-situation-room">
            <RefreshCw className="w-3 h-3 mr-1" />
            새로고침
          </Button>
        </div>
      </div>

      {streamError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-sm">
          {streamError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card data-testid="card-system-health">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              시스템 상태
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Badge variant={health.level === "crit" ? "destructive" : health.level === "warn" ? "secondary" : "default"}>
              {health.message}
            </Badge>
            <div className="text-xs text-muted-foreground">
              마지막 수집: {fmtDateTime(current?.measuredAt)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-db-health">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4" />
              DB 헬스
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>{current?.db.ok ? "정상" : "실패"}</div>
            <div className="text-xs text-muted-foreground">지연: {current?.db.latencyMs ?? "-"} ms</div>
            {current?.db.error && <div className="text-xs text-destructive break-all">{current.db.error}</div>}
          </CardContent>
        </Card>

        <Card data-testid="card-http-health">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              HTTP 1분
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>요청 {current?.httpLast1m.requestCount ?? 0}건</div>
            <div className="text-xs text-muted-foreground">
              5xx 비율 {current?.httpLast1m.error5xxRatePct ?? 0}% / P95 {current?.httpLast1m.p95LatencyMs ?? 0}ms
            </div>
            <div className="text-xs text-muted-foreground">
              engine-status 401: {current?.httpLast1m.engineStatus401Count ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-ai-health">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI 5분
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>호출 {data?.ai.recentCalls5m ?? 0}건</div>
            <div className="text-xs text-muted-foreground">
              성공률 {data?.ai.recentSuccessRatePct ?? 0}% / 평균 {data?.ai.avgLatencyMs5m ?? 0}ms
            </div>
            <div className="text-xs text-muted-foreground">
              에러 {data?.ai.recentErrors5m ?? 0}건
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-monitoring-thresholds">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">이상감지 임계치 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            {thresholdFields.map((field) => (
              <label key={field.key} className="text-xs text-muted-foreground space-y-1">
                <span className="block">{field.label}</span>
                <div className="flex items-center gap-2">
                  <Input
                    value={thresholdForm?.[field.key] ?? ""}
                    onChange={(e) => updateThresholdField(field.key, e.target.value)}
                    data-testid={`input-threshold-${field.key}`}
                  />
                  <span className="text-[11px] whitespace-nowrap">{field.suffix}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => saveThresholdMutation.mutate()}
              disabled={saveThresholdMutation.isPending || !thresholdForm}
              data-testid="button-save-thresholds"
            >
              {saveThresholdMutation.isPending ? "저장 중..." : "임계치 저장"}
            </Button>
            <span className="text-xs text-muted-foreground">
              저장 후 즉시 탐지 로직에 반영되고, 재시작 후에도 유지됩니다.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card data-testid="card-anomalies">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Siren className="w-4 h-4" />
              이상탐지 로그
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[360px]">
              <div className="divide-y">
                {(data?.anomalies ?? []).length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">탐지된 이상징후가 없습니다.</div>
                )}
                {(data?.anomalies ?? []).map((a) => (
                  <div key={a.id} className="p-3 space-y-1" data-testid={`row-anomaly-${a.id}`}>
                    <div className="flex items-center gap-2">
                      <Badge variant={severityBadgeVariant(a.severity)}>{a.severity.toUpperCase()}</Badge>
                      <span className="text-xs text-muted-foreground">{a.kind}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{fmtDateTime(a.detectedAt)}</span>
                    </div>
                    <div className="text-sm">{a.message}</div>
                    {a.details && (
                      <pre className="text-[11px] text-muted-foreground bg-muted rounded p-2 overflow-auto">
                        {JSON.stringify(a.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card data-testid="card-engine-notifications">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              엔진 알림
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">전체 {data?.notificationSummary?.total ?? 0}</Badge>
              <Badge variant="outline">미확인 {data?.notificationSummary?.unreadTotal ?? 0}</Badge>
              {(data?.notificationSummary?.unreadCrit ?? 0) > 0 && (
                <Badge variant="destructive">CRIT {data?.notificationSummary?.unreadCrit}</Badge>
              )}
              {(data?.notificationSummary?.unreadWarn ?? 0) > 0 && (
                <Badge variant="secondary">WARN {data?.notificationSummary?.unreadWarn}</Badge>
              )}
            </div>
            <ScrollArea className="h-[300px] border rounded">
              <div className="divide-y">
                {(data?.recentEngineNotifications ?? []).map((n) => (
                  <div key={n.id} className="p-3" data-testid={`row-engine-notification-${n.id}`}>
                    <div className="flex items-center gap-2">
                      <Badge variant={severityBadgeVariant(n.severity)}>{n.type}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">{fmtDateTime(n.createdAt)}</span>
                    </div>
                    <div className="text-sm mt-1">{n.message}</div>
                  </div>
                ))}
                {(data?.recentEngineNotifications ?? []).length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">표시할 알림이 없습니다.</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-ai-traces">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4" />
            AI 호출 트레이스 (프롬프트/컨텍스트/응답)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[460px]">
            <div className="divide-y">
              {(data?.ai.traces ?? []).length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">아직 AI 호출 기록이 없습니다.</div>
              )}
              {(data?.ai.traces ?? []).map((t) => (
                <div key={t.id} className="p-3 space-y-2" data-testid={`row-ai-trace-${t.id}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={t.success ? "default" : "destructive"}>{t.success ? "SUCCESS" : "ERROR"}</Badge>
                    <Badge variant="outline">{t.model}</Badge>
                    <Badge variant="secondary">{t.source}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {fmtDateTime(t.timestamp)} / {t.durationMs}ms / tokens {t.totalTokens}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-2 text-[12px]">
                    <div className="border rounded p-2 bg-muted/20">
                      <div className="font-medium mb-1">Prompt</div>
                      <pre className="whitespace-pre-wrap break-words">{t.promptPreview || "-"}</pre>
                    </div>
                    <div className="border rounded p-2 bg-muted/20">
                      <div className="font-medium mb-1">Context</div>
                      <pre className="whitespace-pre-wrap break-words">{t.contextPreview || "-"}</pre>
                    </div>
                    <div className="border rounded p-2 bg-muted/20">
                      <div className="font-medium mb-1">Response / Error</div>
                      <pre className="whitespace-pre-wrap break-words">
                        {t.success ? t.responsePreview || "-" : t.errorMessage || "-"}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card data-testid="card-job-runtime">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            배치 잡 런타임
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <Badge variant={data?.monitorJob.running ? "default" : "secondary"}>
              모니터 잡: {data?.monitorJob.running ? "ON" : "OFF"}
            </Badge>
            <Badge variant="outline">주기: {data?.monitorJob.intervalSec ?? 0}초</Badge>
            <Badge variant="outline">마지막: {fmtDateTime(data?.monitorJob.lastRunAt)}</Badge>
            <Badge variant="outline">다음: {fmtDateTime(data?.monitorJob.nextRunAt)}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {(current?.jobs ?? []).map((j) => (
              <div key={j.id} className="border rounded-md p-3 text-sm" data-testid={`card-job-runtime-${j.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{j.name}</span>
                  <Badge variant={j.status === "running" ? "default" : "secondary"}>{j.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">last: {fmtDateTime(j.lastRun)}</div>
                <div className="text-xs text-muted-foreground">next: {fmtDateTime(j.nextRun)}</div>
                {j.errorCount > 0 && (
                  <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    오류 {j.errorCount}회
                  </div>
                )}
              </div>
            ))}
            {(current?.jobs ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground">잡 데이터가 아직 없습니다.</div>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            서버 업타임: {current ? fmtDurationSec(current.runtime.uptimeSec) : "-"} / 메모리 RSS {current?.runtime.memoryRssMb ?? "-"}MB
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
