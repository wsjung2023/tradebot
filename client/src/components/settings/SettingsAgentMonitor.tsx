// SettingsAgentMonitor.tsx — 집 PC 에이전트 ON/OFF 스위치 + 실시간 현황 카드
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Wifi, WifiOff, Activity, Loader2, RefreshCw, Download, CheckCircle2, AlertCircle, UploadCloud, History, Trash2, Circle, Clock } from "lucide-react";

const POLL_INTERVAL_MS = 15_000;

interface PollingStatus {
  enabled: boolean;
  isAgentConnected: boolean;
  agentLastSeenSecondsAgo: number | null;
  todayPollCount: number;
  todayDispatchCount: number;
  agentVersionHash: string | null;
}

interface AgentVersion {
  serverHash: string;
  size: number;
  scriptUrl: string;
}

interface UpdateStep {
  step: string;
  message: string;
  ts: number;
}

interface AgentUpdateRecord {
  id: number;
  timestamp: string;
  success: boolean;
  agentHashBefore: string | null;
  serverHash: string | null;
  errorMessage: string | null;
}

interface UpdateHistoryResponse {
  history: AgentUpdateRecord[];
  total: number;
}

const STEP_LABELS: Record<string, string> = {
  downloading: "다운로드",
  replacing: "파일 교체",
  restarting: "재시작",
};

const STEP_ORDER = ["downloading", "replacing", "restarting"];

function formatSecondsAgo(sec: number | null): string {
  if (sec === null) return "없음";
  if (sec < 60) return `${sec}초 전`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}분 ${s}초 전`;
}

function UpdateProgressDisplay({ steps, isUpdating }: { steps: UpdateStep[]; isUpdating: boolean }) {
  const completedSteps = new Set(steps.map((s) => s.step));
  const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;

  return (
    <div data-testid="update-progress-display" className="space-y-2 bg-muted/50 rounded-md px-3 py-3">
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">
          {lastStep ? lastStep.message : "에이전트에 업데이트 명령 전송 중..."}
        </span>
      </div>
      <div className="flex items-center gap-0">
        {STEP_ORDER.map((step, idx) => {
          const isDone = completedSteps.has(step);
          const isCurrent = isUpdating && lastStep?.step === step;
          const isUpcoming = !isDone && !isCurrent;

          return (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  data-testid={`update-step-${step}`}
                  className={[
                    "flex items-center justify-center rounded-full transition-colors",
                    "h-7 w-7 shrink-0",
                    isDone
                      ? "bg-green-600 dark:bg-green-500 text-white"
                      : isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground border border-border",
                  ].join(" ")}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                <span
                  className={[
                    "text-xs whitespace-nowrap",
                    isDone
                      ? "text-green-700 dark:text-green-400 font-medium"
                      : isCurrent
                      ? "text-foreground font-medium"
                      : "text-muted-foreground",
                  ].join(" ")}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>
              {idx < STEP_ORDER.length - 1 && (
                <div
                  className={[
                    "h-0.5 w-8 mx-1 mb-4 transition-colors",
                    isDone ? "bg-green-500 dark:bg-green-400" : "bg-border",
                  ].join(" ")}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsAgentMonitor() {
  const { toast } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [updateCheckResult, setUpdateCheckResult] = useState<"uptodate" | "outdated" | null>(null);
  const [selfUpdateResult, setSelfUpdateResult] = useState<"success" | "failure" | null>(null);
  const [scriptUrl, setScriptUrl] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSteps, setUpdateSteps] = useState<UpdateStep[]>([]);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [isWaitingReconnect, setIsWaitingReconnect] = useState(false);
  const [reconnectTargetHash, setReconnectTargetHash] = useState<string | null>(null);
  const [reconnectResult, setReconnectResult] = useState<"confirmed" | "timeout" | null>(null);
  const [reconnectCountdown, setReconnectCountdown] = useState(30);
  const reconnectPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: status, isLoading } = useQuery<PollingStatus>({
    queryKey: ["/api/kiwoom-agent/polling-status"],
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });

  const { data: serverVersion, isLoading: isVersionLoading, refetch: refetchVersion } = useQuery<AgentVersion>({
    queryKey: ["/api/kiwoom-agent/version"],
    staleTime: 60_000,
    enabled: false,
    retry: false,
  });

  const { data: historyData, refetch: refetchHistory } = useQuery<UpdateHistoryResponse>({
    queryKey: ["/api/kiwoom-agent/update-history", historyLimit],
    queryFn: async () => {
      const res = await fetch(`/api/kiwoom-agent/update-history?limit=${historyLimit}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    staleTime: 0,
  });

  // 15초마다 강제 refetch (화면이 포커스를 잃어도)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/polling-status"] });
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (serverVersion) {
      setScriptUrl(serverVersion.scriptUrl);
      if (status?.agentVersionHash) {
        setUpdateCheckResult(
          status.agentVersionHash === serverVersion.serverHash ? "uptodate" : "outdated"
        );
      }
    }
  }, [serverVersion, status?.agentVersionHash]);

  // 컴포넌트 언마운트 시 SSE 연결 및 재연결 타이머 정리
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      if (reconnectPollRef.current) clearInterval(reconnectPollRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (reconnectIntervalRef.current) clearInterval(reconnectIntervalRef.current);
    };
  }, []);

  // 재연결 대기 중일 때 2초마다 polling-status 를 갱신해 해시 변경을 감지
  useEffect(() => {
    if (!isWaitingReconnect || !reconnectTargetHash) return;

    reconnectPollRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/polling-status"] });
    }, 2_000);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (reconnectPollRef.current) clearInterval(reconnectPollRef.current);
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      setIsWaitingReconnect(false);
      setReconnectResult("timeout");
    }, 30_000);

    return () => {
      if (reconnectPollRef.current) clearInterval(reconnectPollRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [isWaitingReconnect, reconnectTargetHash]);

  // 재연결 대기 카운트다운 타이머 (1초마다 감소)
  useEffect(() => {
    if (!isWaitingReconnect) return;

    setReconnectCountdown(30);
    reconnectIntervalRef.current = setInterval(() => {
      setReconnectCountdown((prev) => {
        if (prev <= 1) {
          if (reconnectIntervalRef.current) {
            clearInterval(reconnectIntervalRef.current);
            reconnectIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
    };
  }, [isWaitingReconnect]);

  // polling-status 의 agentVersionHash 가 목표 해시로 바뀌면 재연결 확인
  useEffect(() => {
    if (!isWaitingReconnect || !reconnectTargetHash) return;
    if (status?.agentVersionHash === reconnectTargetHash) {
      if (reconnectPollRef.current) clearInterval(reconnectPollRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      setIsWaitingReconnect(false);
      setReconnectResult("confirmed");
      setSelfUpdateResult("success");
      setUpdateCheckResult(null);
      toast({ title: "업데이트 완료", description: "에이전트가 최신 버전으로 업데이트되고 재연결되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/polling-status"] });
      refetchVersion();
    }
  }, [status?.agentVersionHash, isWaitingReconnect, reconnectTargetHash]);

  const switchMutation = useMutation({
    mutationFn: async (enabled: boolean) =>
      (await apiRequest("POST", "/api/kiwoom-agent/polling-switch", { enabled })).json(),
    onSuccess: (data: { enabled: boolean }) => {
      queryClient.setQueryData(["/api/kiwoom-agent/polling-status"], (old: PollingStatus | undefined) =>
        old ? { ...old, enabled: data.enabled } : old
      );
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/polling-status"] });
      toast({
        title: data.enabled ? "에이전트 폴링 ON" : "에이전트 폴링 OFF",
        description: data.enabled
          ? "에이전트가 잡을 가져갈 수 있습니다"
          : "에이전트 요청을 즉시 반환합니다 (DB 쿼리 없음)",
      });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "스위치 변경 실패", description: e.message }),
  });

  const deleteHistoryMutation = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/kiwoom-agent/update-history/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/update-history"] });
      toast({ title: "이력 삭제", description: "업데이트 이력 항목이 삭제되었습니다." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "이력 삭제 실패", description: e.message }),
  });

  function closeEventSource() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }

  function clearReconnectTimers() {
    if (reconnectPollRef.current) { clearInterval(reconnectPollRef.current); reconnectPollRef.current = null; }
    if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
    if (reconnectIntervalRef.current) { clearInterval(reconnectIntervalRef.current); reconnectIntervalRef.current = null; }
  }

  async function handleSelfUpdate() {
    setIsUpdating(true);
    setUpdateSteps([]);
    setSelfUpdateResult(null);
    setIsWaitingReconnect(false);
    setReconnectResult(null);
    setReconnectTargetHash(null);
    clearReconnectTimers();
    closeEventSource();

    try {
      // 1. 업데이트 job 생성
      const resp = await apiRequest("POST", "/api/kiwoom-agent/self-update");
      const { jobId, error } = await resp.json();
      if (!jobId || error) {
        throw new Error(error ?? "업데이트 job 생성 실패");
      }

      // 2. SSE 연결로 진행 상황 구독
      const es = new EventSource(`/api/kiwoom-agent/self-update-progress/${jobId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "step") {
            setUpdateSteps((prev) => [...prev, { step: data.step, message: data.message, ts: data.ts }]);
          } else if (data.type === "done") {
            closeEventSource();
            setIsUpdating(false);
            refetchHistory();
            if (data.success) {
              // 재시작 완료 → 에이전트 재연결 대기 단계로 진입
              const targetHash = serverVersion?.serverHash ?? null;
              setReconnectTargetHash(targetHash);
              setIsWaitingReconnect(true);
              queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/polling-status"] });
              toast({ title: "재시작 완료", description: "에이전트가 재시작되었습니다. 재연결을 기다립니다..." });
            } else {
              setSelfUpdateResult("failure");
              const errMsg = data.error ?? "에이전트가 응답하지 않습니다.";
              toast({ variant: "destructive", title: "업데이트 실패", description: errMsg });
            }
          } else if (data.type === "timeout") {
            closeEventSource();
            setIsUpdating(false);
            setIsWaitingReconnect(false);
            if (reconnectPollRef.current) clearInterval(reconnectPollRef.current);
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            setReconnectResult("timeout");
            refetchHistory();
            toast({ variant: "destructive", title: "재연결 시간 초과", description: "에이전트가 30초 내에 재연결하지 않았습니다. 수동으로 파일을 교체해 주세요." });
          } else if (data.type === "error") {
            closeEventSource();
            setIsUpdating(false);
            setSelfUpdateResult("failure");
            refetchHistory();
            const errMsg = data.error ?? "업데이트 중 오류가 발생했습니다.";
            toast({ variant: "destructive", title: "업데이트 실패", description: errMsg });
          }
        } catch {
          // JSON 파싱 오류 무시
        }
      };

      es.onerror = () => {
        closeEventSource();
        if (isUpdating) {
          setIsUpdating(false);
          setSelfUpdateResult("failure");
          toast({ variant: "destructive", title: "연결 오류", description: "서버와의 연결이 끊겼습니다." });
        }
      };
    } catch (e: any) {
      setIsUpdating(false);
      setSelfUpdateResult("failure");
      refetchHistory();
      toast({ variant: "destructive", title: "업데이트 실패", description: e.message });
    }
  }

  const clearHistoryMutation = useMutation({
    mutationFn: async () =>
      (await apiRequest("DELETE", "/api/kiwoom-agent/update-history")).json(),
    onSuccess: () => {
      setHistoryLimit(20);
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/update-history"] });
      toast({ title: "이력 초기화", description: "업데이트 이력이 모두 삭제되었습니다." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "이력 초기화 실패", description: e.message }),
  });


  const handleCheckUpdate = async () => {
    setUpdateCheckResult(null);
    setSelfUpdateResult(null);
    setUpdateSteps([]);
    setIsWaitingReconnect(false);
    setReconnectResult(null);
    setReconnectTargetHash(null);
    clearReconnectTimers();
    const result = await refetchVersion();
    if (result.error) {
      toast({ variant: "destructive", title: "버전 확인 실패", description: "서버에서 버전 정보를 가져오지 못했습니다" });
    }
  };

  const connected = status?.isAgentConnected ?? false;
  const enabled = status?.enabled ?? true;
  const agentHash = status?.agentVersionHash ?? null;

  return (
    <Card data-testid="card-agent-monitor">
      <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <CardTitle className="text-lg">집 PC 에이전트</CardTitle>
          <CardDescription>
            에이전트 폴링을 켜거나 끄고 현재 연결 상태를 확인합니다
          </CardDescription>
        </div>
        <div className="flex items-center gap-3 pt-1">
          {switchMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
          <span className="text-sm font-medium text-muted-foreground">
            {enabled ? "ON" : "OFF"}
          </span>
          <Switch
            data-testid="switch-agent-polling"
            checked={enabled}
            disabled={isLoading || switchMutation.isPending}
            onCheckedChange={(v) => switchMutation.mutate(v)}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>현황 조회 중...</span>
          </div>
        ) : (
          <>
            {/* 연결 상태 배지 */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge
                data-testid="badge-agent-connection"
                variant={connected ? "default" : "secondary"}
                className="gap-1.5"
              >
                {connected ? (
                  <Wifi className="h-3 w-3" />
                ) : (
                  <WifiOff className="h-3 w-3" />
                )}
                {connected ? "연결됨" : "연결 끊김"}
              </Badge>

              {!enabled && (
                <Badge variant="secondary" data-testid="badge-polling-off">
                  폴링 중단 중
                </Badge>
              )}
            </div>

            {/* 상세 수치 */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="text-muted-foreground">마지막 연결</div>
              <div
                data-testid="text-agent-last-seen"
                className={connected ? "font-medium" : "text-muted-foreground"}
              >
                {formatSecondsAgo(status?.agentLastSeenSecondsAgo ?? null)}
              </div>

              <div className="text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" />
                폴링 횟수 (이번 서버 기동)
              </div>
              <div data-testid="text-today-poll-count" className="font-medium tabular-nums">
                {(status?.todayPollCount ?? 0).toLocaleString()}회
              </div>

              <div className="text-muted-foreground">전달된 잡</div>
              <div data-testid="text-today-dispatch-count" className="font-medium tabular-nums">
                {(status?.todayDispatchCount ?? 0).toLocaleString()}건
              </div>

              <div className="text-muted-foreground">에이전트 버전</div>
              <div data-testid="text-agent-version-hash" className="font-medium tabular-nums font-mono text-xs">
                {agentHash ?? (connected ? "—" : "미연결")}
              </div>
            </div>

            {/* 버전 업데이트 확인 섹션 */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium">에이전트 업데이트 확인</span>
                <Button
                  data-testid="button-check-update"
                  variant="outline"
                  size="sm"
                  onClick={handleCheckUpdate}
                  disabled={isVersionLoading || isUpdating}
                >
                  {isVersionLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  업데이트 확인
                </Button>
              </div>

              {serverVersion && (
                <div className="text-sm space-y-2">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                    <div className="text-muted-foreground">서버 최신 버전</div>
                    <div
                      data-testid="text-server-version-hash"
                      className="font-mono text-xs font-medium"
                    >
                      {serverVersion.serverHash}
                    </div>
                    <div className="text-muted-foreground">에이전트 버전</div>
                    <div className="font-mono text-xs font-medium">
                      {agentHash ?? "미연결"}
                    </div>
                  </div>

                  {/* 업데이트 진행 중 */}
                  {isUpdating && (
                    <UpdateProgressDisplay steps={updateSteps} isUpdating={isUpdating} />
                  )}

                  {/* 재시작 후 에이전트 재연결 대기 중 */}
                  {isWaitingReconnect && (
                    <div
                      data-testid="status-reconnect-waiting"
                      className="space-y-2"
                    >
                      {updateSteps.length > 0 && (
                        <UpdateProgressDisplay steps={updateSteps} isUpdating={false} />
                      )}
                      <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                        <span>
                          에이전트 재연결 대기 중...{" "}
                          <span
                            data-testid="text-reconnect-countdown"
                            className="tabular-nums font-medium"
                          >
                            ({reconnectCountdown}초 남음)
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 재연결 시간 초과 */}
                  {reconnectResult === "timeout" && !isWaitingReconnect && (
                    <div
                      data-testid="status-reconnect-timeout"
                      className="space-y-2"
                    >
                      {updateSteps.length > 0 && (
                        <UpdateProgressDisplay steps={updateSteps} isUpdating={false} />
                      )}
                      <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
                        <Clock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>에이전트가 30초 내에 재연결하지 않았습니다. 파일을 직접 교체하거나 다시 시도해 주세요.</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          data-testid="button-retry-reconnect"
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setReconnectResult(null);
                            setSelfUpdateResult(null);
                            setUpdateSteps([]);
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          다시 시도
                        </Button>
                        {scriptUrl && (
                          <Button
                            data-testid="button-download-agent-reconnect-timeout"
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a href={scriptUrl} download="kiwoom-agent.py">
                              <Download className="h-3.5 w-3.5" />
                              수동 다운로드
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {updateCheckResult === "uptodate" && selfUpdateResult === null && !isUpdating && !isWaitingReconnect && (
                    <div
                      data-testid="status-update-uptodate"
                      className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                      최신 버전입니다. 업데이트가 필요하지 않습니다.
                    </div>
                  )}

                  {updateCheckResult === "outdated" && selfUpdateResult === null && !isUpdating && !isWaitingReconnect && (
                    <div
                      data-testid="status-update-outdated"
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>
                          {connected
                            ? "새 버전이 있습니다. 버튼을 눌러 에이전트를 자동으로 업데이트하세요."
                            : "새 버전이 있습니다. 에이전트가 연결되면 원클릭 업데이트가 가능합니다."}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {connected && (
                          <Button
                            data-testid="button-self-update-agent"
                            variant="default"
                            size="sm"
                            onClick={handleSelfUpdate}
                            disabled={isUpdating}
                          >
                            <UploadCloud className="h-3.5 w-3.5" />
                            지금 업데이트
                          </Button>
                        )}
                        <Button
                          data-testid="button-download-agent"
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a href={serverVersion.scriptUrl} download="kiwoom-agent.py">
                            <Download className="h-3.5 w-3.5" />
                            수동 다운로드
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                  {!agentHash && updateCheckResult === null && (
                    <p className="text-xs text-muted-foreground">
                      에이전트가 연결되면 버전 비교가 가능합니다.
                    </p>
                  )}
                </div>
              )}

              {selfUpdateResult === "success" && !isUpdating && !isWaitingReconnect && (
                <div
                  data-testid="status-self-update-success"
                  className="space-y-2"
                >
                  {updateSteps.length > 0 && (
                    <UpdateProgressDisplay steps={updateSteps} isUpdating={false} />
                  )}
                  <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                    {reconnectResult === "confirmed"
                      ? "업데이트 완료. 에이전트가 새 버전으로 재연결되었습니다."
                      : "업데이트 완료. 에이전트가 재시작되었습니다."}
                  </div>
                </div>
              )}

              {selfUpdateResult === "failure" && !isUpdating && (
                <div
                  data-testid="status-self-update-failure"
                  className="space-y-2"
                >
                  {updateSteps.length > 0 && (
                    <UpdateProgressDisplay steps={updateSteps} isUpdating={false} />
                  )}
                  <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                    업데이트에 실패했습니다. 다시 시도하거나 수동으로 파일을 교체해 주세요.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {connected && (
                      <Button
                        data-testid="button-retry-self-update"
                        variant="default"
                        size="sm"
                        onClick={() => { setSelfUpdateResult(null); handleSelfUpdate(); }}
                        disabled={isUpdating}
                      >
                        <UploadCloud className="h-3.5 w-3.5" />
                        다시 시도
                      </Button>
                    )}
                    {scriptUrl && (
                      <Button
                        data-testid="button-download-agent-fallback"
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a href={scriptUrl} download="kiwoom-agent.py">
                          <Download className="h-3.5 w-3.5" />
                          수동 다운로드
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* OFF 상태 안내 */}
            {!enabled && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                폴링이 꺼진 상태입니다. 에이전트가 연결해도 잡을 받지 못합니다.
                서버 재시작 시 자동으로 ON으로 돌아옵니다.
              </p>
            )}

            {/* 업데이트 이력 */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">업데이트 이력</span>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      data-testid="button-clear-update-history"
                      variant="outline"
                      size="sm"
                      disabled={clearHistoryMutation.isPending || !historyData?.history?.length}
                    >
                      {clearHistoryMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      전체 삭제
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>업데이트 이력을 모두 삭제하시겠습니까?</AlertDialogTitle>
                      <AlertDialogDescription>
                        전체 업데이트 이력이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-clear-history-cancel">취소</AlertDialogCancel>
                      <AlertDialogAction
                        data-testid="button-clear-history-confirm"
                        onClick={() => clearHistoryMutation.mutate()}
                      >
                        전체 삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              {!historyData || historyData.history.length === 0 ? (
                <p
                  data-testid="text-update-history-empty"
                  className="text-xs text-muted-foreground px-1"
                >
                  업데이트 이력이 없습니다.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5" data-testid="list-update-history">
                    {historyData.history.map((record) => (
                      <div
                        key={record.id}
                        data-testid={`row-update-history-${record.id}`}
                        className="flex items-start gap-2 text-xs bg-muted/40 rounded-md px-3 py-2"
                      >
                        <div className="mt-0.5 shrink-0">
                          {record.success ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {record.success ? "성공" : "실패"}
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(record.timestamp).toLocaleString("ko-KR", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap text-muted-foreground font-mono">
                            {record.agentHashBefore && (
                              <span>이전: {record.agentHashBefore}</span>
                            )}
                            {record.serverHash && (
                              <span>서버: {record.serverHash}</span>
                            )}
                          </div>
                          {!record.success && record.errorMessage && (
                            <p className="text-destructive truncate">{record.errorMessage}</p>
                          )}
                        </div>
                        <Button
                          data-testid={`button-delete-history-${record.id}`}
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground"
                          onClick={() => setDeleteConfirmId(record.id)}
                          disabled={deleteHistoryMutation.isPending}
                        >
                          {deleteHistoryMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                  {historyData.total > historyLimit && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground">
                        {historyLimit}건 표시 중 / 전체 {historyData.total}건
                      </span>
                      <Button
                        data-testid="button-load-more-history"
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryLimit((prev) => prev + 20)}
                      >
                        더 보기
                      </Button>
                    </div>
                  )}
                  {historyData.total <= historyLimit && historyData.total > 0 && (
                    <p className="text-xs text-muted-foreground pt-1">
                      전체 {historyData.total}건 모두 표시됨
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이력을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 업데이트 이력 항목을 삭제합니다. 이 작업은 취소할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-history-cancel">취소</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-delete-history-confirm"
              onClick={() => {
                if (deleteConfirmId !== null) {
                  deleteHistoryMutation.mutate(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
