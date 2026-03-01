// SettingsKiwoom.tsx — 키움증권 API KEY 입력 및 저장 설정 카드
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Key, Save } from "lucide-react";

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
      </CardContent>
    </Card>
  );
}
