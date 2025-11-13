import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Key, Save, Shield } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/settings'],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('PATCH', '/api/settings', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "설정 저장됨",
        description: "설정이 성공적으로 저장되었습니다",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "설정 저장 실패",
        description: error.message,
      });
    },
  });

  const saveApiKeys = () => {
    if (!appKey || !appSecret) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "APP KEY와 APP SECRET을 모두 입력해주세요",
      });
      return;
    }

    updateSettingsMutation.mutate({
      kiwoomAppKey: appKey,
      kiwoomAppSecret: appSecret,
    });
    setAppKey("");
    setAppSecret("");
    setShowSecret(false);
  };

  const toggleTradingMode = (isReal: boolean) => {
    updateSettingsMutation.mutate({
      tradingMode: isReal ? 'real' : 'mock',
    });
  };

  if (isLoading) {
    return <div className="p-6">로딩중...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-settings-title">설정</h1>
        <p className="text-muted-foreground">계정 및 거래 설정 관리</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            키움증권 API 키 관리
          </CardTitle>
          <CardDescription>
            키움증권 OpenAPI에 연결하려면 APP KEY와 APP SECRET이 필요합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="appKey">APP KEY</Label>
            <Input
              id="appKey"
              type="text"
              placeholder="키움증권 APP KEY"
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
              data-testid="input-app-key"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="appSecret">APP SECRET</Label>
            <Input
              id="appSecret"
              type={showSecret ? "text" : "password"}
              placeholder="키움증권 APP SECRET"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              data-testid="input-app-secret"
            />
            <div className="flex items-center space-x-2">
              <Switch
                checked={showSecret}
                onCheckedChange={setShowSecret}
                data-testid="switch-show-secret"
              />
              <Label className="text-sm text-muted-foreground">비밀번호 표시</Label>
            </div>
          </div>
          <Button 
            onClick={saveApiKeys} 
            disabled={updateSettingsMutation.isPending}
            data-testid="button-save-api-keys"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateSettingsMutation.isPending ? "저장중..." : "API 키 저장"}
          </Button>
          {settings?.hasKiwoomKeys && (
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ API 키가 등록되어 있습니다
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            거래 모드
          </CardTitle>
          <CardDescription>
            모의투자 모드와 실계좌 모드를 전환할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">현재 모드</p>
              <p className="text-sm text-muted-foreground">
                {settings?.tradingMode === 'real' ? '실계좌 거래' : '모의투자'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="trading-mode" className="text-sm">모의투자</Label>
              <Switch
                id="trading-mode"
                checked={settings?.tradingMode === 'real'}
                onCheckedChange={toggleTradingMode}
                data-testid="switch-trading-mode"
              />
              <Label htmlFor="trading-mode" className="text-sm">실계좌</Label>
            </div>
          </div>
          <Separator />
          <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-md border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              ⚠️ 실계좌 모드에서는 실제 자금이 거래됩니다. 신중하게 사용하세요.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>알림 설정</CardTitle>
          <CardDescription>가격 알림 및 거래 알림 설정</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">가격 알림</p>
              <p className="text-sm text-muted-foreground">관심종목의 가격 변동 알림</p>
            </div>
            <Switch
              checked={settings?.priceAlertEnabled}
              onCheckedChange={(checked) => {
                updateSettingsMutation.mutate({ priceAlertEnabled: checked });
              }}
              data-testid="switch-price-alert"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">거래 알림</p>
              <p className="text-sm text-muted-foreground">주문 체결 및 거래 알림</p>
            </div>
            <Switch
              checked={settings?.tradeAlertEnabled}
              onCheckedChange={(checked) => {
                updateSettingsMutation.mutate({ tradeAlertEnabled: checked });
              }}
              data-testid="switch-trade-alert"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
