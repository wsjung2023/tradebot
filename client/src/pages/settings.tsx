import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Key, Save, Shield, Bell, Plus, Trash2 } from "lucide-react";
import type { InsertAlert } from "@shared/schema";

interface Alert {
  id: number;
  userId: string;
  stockCode: string;
  stockName: string;
  alertType: 'price_above' | 'price_below' | 'volume_spike' | 'ai_signal';
  targetValue?: string | null;
  isTriggered: boolean;
  isActive: boolean;
  triggeredAt?: string;
  createdAt: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  
  const [alertStockCode, setAlertStockCode] = useState("");
  const [alertStockName, setAlertStockName] = useState("");
  const [alertType, setAlertType] = useState<'price_above' | 'price_below' | 'volume_spike' | 'ai_signal'>('price_above');
  const [alertTargetValue, setAlertTargetValue] = useState("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/settings'],
  });

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['/api/alerts'],
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

  const createAlertMutation = useMutation({
    mutationFn: async (data: Omit<InsertAlert, 'userId'>) => {
      const res = await apiRequest('POST', '/api/alerts', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      setAlertStockCode("");
      setAlertStockName("");
      setAlertTargetValue("");
      toast({
        title: "알림 생성",
        description: "가격 알림이 생성되었습니다",
      });
    },
    onError: (error: any) => {
      const errorMsg = error?.message || error?.error || "알림 생성 중 오류가 발생했습니다";
      toast({
        variant: "destructive",
        title: "알림 생성 실패",
        description: errorMsg,
      });
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/alerts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      toast({
        title: "알림 삭제",
        description: "알림이 삭제되었습니다",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "알림 삭제 실패",
        description: error.message,
      });
    },
  });

  const handleCreateAlert = () => {
    if (!alertStockCode || !alertStockName) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "종목코드와 종목명을 입력해주세요",
      });
      return;
    }

    if (alertType === 'price_above' || alertType === 'price_below') {
      const cleanValue = alertTargetValue.trim().replace(/,/g, '');
      
      if (!/^\d+(\.\d{1,2})?$/.test(cleanValue)) {
        toast({
          variant: "destructive",
          title: "입력 오류",
          description: "숫자만 입력해주세요 (예: 75000 또는 75000.50)",
        });
        return;
      }
      
      const price = parseFloat(cleanValue);
      if (!Number.isFinite(price) || price <= 0 || price >= 1e15) {
        toast({
          variant: "destructive",
          title: "입력 오류",
          description: "유효한 목표 가격을 입력해주세요 (1 ~ 999조)",
        });
        return;
      }
    }

    const data: Omit<InsertAlert, 'userId'> = {
      stockCode: alertStockCode,
      stockName: alertStockName,
      alertType,
      ...(alertTargetValue.trim() && (alertType === 'price_above' || alertType === 'price_below') 
        ? { targetValue: parseFloat(alertTargetValue.trim().replace(/,/g, '')).toFixed(2) } 
        : {}),
      isActive: true,
    };

    createAlertMutation.mutate(data);
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      price_above: '가격 상승',
      price_below: '가격 하락',
      volume_spike: '거래량 급증',
      ai_signal: 'AI 신호',
    };
    return labels[type] || type;
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            가격 알림 관리
          </CardTitle>
          <CardDescription>특정 종목에 대한 가격 알림을 설정하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-medium">새 알림 생성</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>종목코드</Label>
                <Input
                  placeholder="예: 005930"
                  value={alertStockCode}
                  onChange={(e) => setAlertStockCode(e.target.value)}
                  data-testid="input-alert-stock-code"
                />
              </div>
              <div className="space-y-2">
                <Label>종목명</Label>
                <Input
                  placeholder="예: 삼성전자"
                  value={alertStockName}
                  onChange={(e) => setAlertStockName(e.target.value)}
                  data-testid="input-alert-stock-name"
                />
              </div>
              <div className="space-y-2">
                <Label>알림 유형</Label>
                <Select value={alertType} onValueChange={(value: any) => setAlertType(value)}>
                  <SelectTrigger data-testid="select-alert-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price_above">가격 상승</SelectItem>
                    <SelectItem value="price_below">가격 하락</SelectItem>
                    <SelectItem value="volume_spike">거래량 급증</SelectItem>
                    <SelectItem value="ai_signal">AI 신호</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(alertType === 'price_above' || alertType === 'price_below') && (
                <div className="space-y-2">
                  <Label>목표 가격</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="예: 70000"
                    value={alertTargetValue}
                    onChange={(e) => setAlertTargetValue(e.target.value)}
                    data-testid="input-alert-target-value"
                  />
                </div>
              )}
            </div>
            <Button 
              onClick={handleCreateAlert}
              disabled={createAlertMutation.isPending}
              data-testid="button-create-alert"
            >
              <Plus className="h-4 w-4 mr-2" />
              {createAlertMutation.isPending ? "생성 중..." : "알림 생성"}
            </Button>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-medium">활성 알림 목록</h3>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-alerts">
                설정된 알림이 없습니다
              </p>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                    data-testid={`alert-item-${alert.id}`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{alert.stockCode}</span>
                        <span className="text-muted-foreground">{alert.stockName}</span>
                        <Badge variant={alert.isTriggered ? "destructive" : "default"}>
                          {alert.isTriggered ? "발동됨" : "대기중"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{getAlertTypeLabel(alert.alertType)}</span>
                        {alert.targetValue && (
                          <span>목표: {parseFloat(alert.targetValue).toLocaleString()}원</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteAlertMutation.mutate(alert.id)}
                      disabled={deleteAlertMutation.isPending}
                      data-testid={`button-delete-alert-${alert.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
