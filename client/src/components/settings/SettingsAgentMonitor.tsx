// SettingsAgentMonitor.tsx — 집 PC 에이전트 ON/OFF 스위치 + 실시간 현황 카드
import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Activity, Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 15_000;

interface PollingStatus {
  enabled: boolean;
  isAgentConnected: boolean;
  agentLastSeenSecondsAgo: number | null;
  todayPollCount: number;
  todayDispatchCount: number;
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

  const { data: status, isLoading } = useQuery<PollingStatus>({
    queryKey: ["/api/kiwoom-agent/polling-status"],
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
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
    onError: (e: any) =>
      toast({ variant: "destructive", title: "스위치 변경 실패", description: e.message }),
  });

  const connected = status?.isAgentConnected ?? false;
  const enabled = status?.enabled ?? true;

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
