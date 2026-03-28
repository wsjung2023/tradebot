// SettingsKiwoom.tsx — 키움증권 API KEY 입력 및 저장 설정 카드
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Key, Save, Server, Wifi, WifiOff, Copy, Check, RefreshCw } from "lucide-react";

interface Props {
  appKey: string;
  appSecret: string;
  showSecret: boolean;
  isPending: boolean;
  hasKiwoomKeys?: boolean;
  onAppKeyChange: (v: string) => void;
  onAppSecretChange: (v: string) => void;
  onShowSecretChange: (v: boolean) => void;
  onSave: () => void;
}

interface ConnectionInfo {
  serverUrl: string;
  agentKeyConfigured: boolean;
  agentLastSeen: string | null;
  agentLastSeenSecondsAgo: number | null;
  isAgentActive: boolean;
  pollCount: number;
}

function formatSecondsAgo(sec: number | null): string {
  if (sec === null) return "연결 기록 없음";
  if (sec < 60) return `${sec}초 전`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}

export function SettingsKiwoom({ appKey, appSecret, showSecret, isPending, hasKiwoomKeys, onAppKeyChange, onAppSecretChange, onShowSecretChange, onSave }: Props) {
  const [serverIP, setServerIP] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: connInfo, refetch: refetchConnInfo, isFetching: connFetching } = useQuery<ConnectionInfo>({
    queryKey: ["/api/kiwoom-agent/connection-info"],
    refetchInterval: 10000,
  });

  useEffect(() => {
    const fetchServerIP = async () => {
      try {
        const res = await fetch("/api/server-info");
        if (res.ok) {
          const data = await res.json();
          setServerIP(data.serverIP);
        }
      } catch (e) {
        console.error("[SettingsKiwoom] IP 조회 실패:", e);
      }
    };
    fetchServerIP();
    const interval = setInterval(fetchServerIP, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyUrl = () => {
    if (connInfo?.serverUrl) {
      navigator.clipboard.writeText(connInfo.serverUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Key className="h-4 w-4 md:h-5 md:w-5" />
          키움증권 API 키 설정
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          키움증권 OpenAPI에 연결하려면 APP KEY와 APP SECRET이 필요합니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="appKey">APP KEY</Label>
          <Input id="appKey" type="text" placeholder="키움증권 APP KEY" value={appKey} onChange={(e) => onAppKeyChange(e.target.value)} data-testid="input-app-key" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="appSecret">APP SECRET</Label>
          <Input id="appSecret" type={showSecret ? "text" : "password"} placeholder="키움증권 APP SECRET" value={appSecret} onChange={(e) => onAppSecretChange(e.target.value)} data-testid="input-app-secret" />
          <div className="flex items-center space-x-2">
            <Switch checked={showSecret} onCheckedChange={onShowSecretChange} data-testid="switch-show-secret" />
            <Label className="text-sm text-muted-foreground">비밀번호 표시</Label>
          </div>
        </div>
        <Button onClick={onSave} disabled={isPending} data-testid="button-save-api-keys">
          <Save className="h-4 w-4 mr-2" />
          {isPending ? "저장중..." : "API 키 저장"}
        </Button>
        {hasKiwoomKeys && <p className="text-sm text-green-600 dark:text-green-400">✓ API 키가 등록되어 있습니다</p>}

        {/* 에이전트 연결 정보 */}
        <div className="border-t pt-4 mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {connInfo?.isAgentActive
                ? <Wifi className="h-4 w-4 text-green-500" />
                : <WifiOff className="h-4 w-4 text-destructive" />}
              <span className="text-sm font-semibold">집 PC 에이전트 연결</span>
            </div>
            <div className="flex items-center gap-2">
              {connInfo && (
                <Badge
                  variant={connInfo.isAgentActive ? "default" : "destructive"}
                  data-testid="badge-agent-status"
                >
                  {connInfo.isAgentActive ? "연결됨" : "미연결"}
                </Badge>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => refetchConnInfo()}
                disabled={connFetching}
                data-testid="button-refresh-agent-status"
              >
                <RefreshCw className={`h-3 w-3 ${connFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {connInfo && !connInfo.isAgentActive && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-2">
              <p className="text-xs font-medium text-destructive">
                에이전트가 폴링하지 않고 있습니다. 집 PC의 <code className="font-mono bg-destructive/10 px-1 rounded">agent/.env</code>의 <code className="font-mono bg-destructive/10 px-1 rounded">REPLIT_URLS</code>를 아래 현재 서버 URL로 업데이트하세요.
              </p>
            </div>
          )}

          {/* 현재 서버 URL */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">현재 서버 URL (agent/.env → REPLIT_URLS)</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={connInfo?.serverUrl ?? "로딩중..."}
                className="font-mono text-xs"
                data-testid="input-server-url"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopyUrl}
                disabled={!connInfo?.serverUrl}
                data-testid="button-copy-server-url"
              >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* 마지막 폴링 시각 */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-md text-sm">
            <span className="text-muted-foreground">마지막 폴링</span>
            <span
              className={connInfo?.agentLastSeenSecondsAgo !== null && connInfo!.agentLastSeenSecondsAgo! > 60
                ? "text-destructive font-medium"
                : "text-foreground"}
              data-testid="text-agent-last-seen"
            >
              {connInfo
                ? connInfo.agentLastSeen
                  ? formatSecondsAgo(connInfo.agentLastSeenSecondsAgo)
                  : "서버 시작 후 폴링 없음"
                : "조회중..."}
            </span>
          </div>

          {connInfo && connInfo.pollCount > 0 && (
            <p className="text-xs text-muted-foreground">
              서버 시작 후 총 <strong>{connInfo.pollCount.toLocaleString()}</strong>회 폴링
            </p>
          )}
        </div>

        {/* 서버 정보 */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">서버 정보</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-muted rounded-md">
              <span className="text-sm text-muted-foreground">공인 IP</span>
              {serverIP ? (
                <Badge variant="secondary" className="font-mono" data-testid="badge-server-ip">
                  {serverIP}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">조회중...</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              이 IP를 키움 OpenAPI 포털의 <strong>지정단말기 IP</strong>로 등록해야 실계좌 API 접속이 가능합니다.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
