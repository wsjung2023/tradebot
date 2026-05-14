// SettingsAppInfo.tsx — 앱 정보 카드 (서버 버전 업데이트 가능 여부 실시간 표시)
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Server } from "lucide-react";

interface HealthResponse {
  ok: boolean;
  serverStartTime: string;
  latestBuildTime: string | null;
  buildTime: string | null;
  buildCommit: string | null;
  nodeEnv: string;
  updateAvailable: boolean;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function SettingsAppInfo() {
  const { data, isLoading } = useQuery<HealthResponse>({
    queryKey: ["/api/health"],
    refetchInterval: 30_000,
    staleTime: 30_000,
  });

  const buildTime = data?.buildTime ?? data?.latestBuildTime ?? null;

  return (
    <Card data-testid="card-app-info">
      <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-4 w-4" />
              앱 정보
            </CardTitle>
            {!isLoading && data?.updateAvailable && (
              <Badge
                data-testid="badge-update-available"
                variant="default"
                className="gap-1.5 bg-amber-500 dark:bg-amber-600 text-white"
              >
                <RefreshCw className="h-3 w-3" />
                새 버전 사용 가능
              </Badge>
            )}
            {!isLoading && data && !data.updateAvailable && (
              <Badge
                data-testid="badge-app-uptodate"
                variant="secondary"
                className="gap-1.5"
              >
                최신 버전
              </Badge>
            )}
          </div>
          <CardDescription>
            현재 실행 중인 서버 버전과 배포된 최신 빌드를 비교합니다
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>버전 정보 조회 중...</span>
          </div>
        ) : data ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="text-muted-foreground">서버 기동 시각</div>
              <div data-testid="text-server-start-time" className="font-medium tabular-nums">
                {formatDateTime(data.serverStartTime)}
              </div>

              <div className="text-muted-foreground">최신 빌드 시각</div>
              <div data-testid="text-latest-build-time" className="font-medium tabular-nums">
                {buildTime ? formatDateTime(buildTime) : "—"}
              </div>

              {data.buildCommit && (
                <>
                  <div className="text-muted-foreground">빌드 커밋</div>
                  <div data-testid="text-build-commit" className="font-mono text-xs font-medium">
                    {data.buildCommit}
                  </div>
                </>
              )}

              <div className="text-muted-foreground">실행 환경</div>
              <div data-testid="text-node-env" className="font-medium">
                {data.nodeEnv}
              </div>
            </div>

            {data.updateAvailable && (
              <p
                data-testid="text-update-notice"
                className="text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2"
              >
                새 버전이 배포되었습니다. 서버를 재시작하면 최신 버전이 적용됩니다.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">버전 정보를 가져올 수 없습니다.</p>
        )}
      </CardContent>
    </Card>
  );
}
