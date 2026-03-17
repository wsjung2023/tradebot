// SettingsKiwoom.tsx — 키움증권 API KEY 입력 및 저장 설정 카드
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Key, Save, Server } from "lucide-react";

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

export function SettingsKiwoom({ appKey, appSecret, showSecret, isPending, hasKiwoomKeys, onAppKeyChange, onAppSecretChange, onShowSecretChange, onSave }: Props) {
  const [serverIP, setServerIP] = useState<string | null>(null);

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
    // 5분마다 갱신
    const interval = setInterval(fetchServerIP, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
