// SettingsAgentMonitor.tsx — 집 PC 에이전트 ON/OFF 스위치 + 실시간 현황 카드
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, Activity, Loader2, RefreshCw, Download, CheckCircle2, AlertCircle, UploadCloud } from "lucide-react";

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

interface SelfUpdateResponse {
  success: boolean;
  result?: { success: boolean; message: string };
  error?: string;
}

function formatSecondsAgo(sec: number | null): string {
  if (sec === null) return "없음";
  if (sec < 60) return `${sec}초 전`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}분 ${s}초 전`;
}

export function SettingsAgentMonitor() {
  const { toast } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [updateCheckResult, setUpdateCheckResult] = useState<"uptodate" | "outdated" | null>(null);
  const [selfUpdateResult, setSelfUpdateResult] = useState<"success" | "failure" | null>(null);
  const [scriptUrl, setScriptUrl] = useState<string | null>(null);

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

  // 15초마다 강제 refetch (화면이 포커스를 잃어도)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/polling-status"] });
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // 버전 해시가 업데이트되면 updateCheckResult 재계산
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

  const selfUpdateMutation = useMutation({
    mutationFn: async (): Promise<SelfUpdateResponse> =>
      (await apiRequest("POST", "/api/kiwoom-agent/self-update")).json(),
    onSuccess: (data: SelfUpdateResponse) => {
      const agentSuccess = data.success && data.result?.success === true;
      if (agentSuccess) {
        setSelfUpdateResult("success");
        toast({ title: "업데이트 완료", description: "에이전트가 최신 버전으로 업데이트되고 재시작되었습니다." });
        setUpdateCheckResult(null);
        queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/polling-status"] });
        refetchVersion();
      } else {
        setSelfUpdateResult("failure");
        const errMsg = data.error ?? data.result?.message ?? "에이전트가 응답하지 않습니다.";
        toast({ variant: "destructive", title: "업데이트 실패", description: errMsg });
      }
    },
    onError: (e: Error) => {
      setSelfUpdateResult("failure");
      toast({ variant: "destructive", title: "업데이트 실패", description: e.message });
    },
  });

  const handleCheckUpdate = async () => {
    setUpdateCheckResult(null);
    setSelfUpdateResult(null);
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
                  disabled={isVersionLoading}
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

                  {updateCheckResult === "uptodate" && selfUpdateResult === null && (
                    <div
                      data-testid="status-update-uptodate"
                      className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                      최신 버전입니다. 업데이트가 필요하지 않습니다.
                    </div>
                  )}

                  {updateCheckResult === "outdated" && selfUpdateResult === null && (
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
                            onClick={() => selfUpdateMutation.mutate()}
                            disabled={selfUpdateMutation.isPending}
                          >
                            {selfUpdateMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UploadCloud className="h-3.5 w-3.5" />
                            )}
                            {selfUpdateMutation.isPending ? "업데이트 중..." : "지금 업데이트"}
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

              {selfUpdateResult === "success" && (
                <div
                  data-testid="status-self-update-success"
                  className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                  업데이트 완료. 에이전트가 재시작되었습니다.
                </div>
              )}

              {selfUpdateResult === "failure" && (
                <div
                  data-testid="status-self-update-failure"
                  className="space-y-2"
                >
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
                        onClick={() => { setSelfUpdateResult(null); selfUpdateMutation.mutate(); }}
                        disabled={selfUpdateMutation.isPending}
                      >
                        {selfUpdateMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UploadCloud className="h-3.5 w-3.5" />
                        )}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
