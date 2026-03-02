// settings.tsx — 사용자 설정 페이지 (API 키, 거래모드, AI 모델, 알림 설정 통합)
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SettingsKiwoom } from "@/components/settings/SettingsKiwoom";
import { SettingsTrading } from "@/components/settings/SettingsTrading";
import { SettingsAI } from "@/components/settings/SettingsAI";
import { SettingsNotifications } from "@/components/settings/SettingsNotifications";
import { SettingsStockAlerts } from "@/components/settings/SettingsStockAlerts";
import type { Alert } from "@shared/schema";

export default function Settings() {
  const { toast } = useToast();
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [alertStockCode, setAlertStockCode] = useState("");
  const [alertStockName, setAlertStockName] = useState("");
  const [alertType, setAlertType] = useState<"price_above" | "price_below" | "volume_spike" | "ai_signal">("price_above");
  const [alertTargetValue, setAlertTargetValue] = useState("");

  const { data: settings } = useQuery({ queryKey: ["/api/settings"] });
  const { data: alerts = [] } = useQuery<Alert[]>({ queryKey: ["/api/alerts"] });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("PATCH", "/api/settings", data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "설정 저장됨", description: "설정이 성공적으로 저장되었습니다" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "설정 저장 실패", description: e.message }),
  });

  const createAlertMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/alerts", data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setAlertStockCode(""); setAlertStockName(""); setAlertTargetValue("");
      toast({ title: "알림 생성", description: "새로운 알림이 생성되었습니다" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "알림 생성 실패", description: e.message }),
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/alerts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({ title: "알림 삭제", description: "알림이 삭제되었습니다" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "알림 삭제 실패", description: e.message }),
  });

  const saveApiKeys = () => {
    if (!appKey || !appSecret) {
      toast({ variant: "destructive", title: "입력 오류", description: "APP KEY와 APP SECRET을 모두 입력해주세요" });
      return;
    }
    updateSettingsMutation.mutate({ appKey, appSecret });
  };

  const handleCreateAlert = () => {
    if (!alertStockCode || !alertStockName) {
      toast({ variant: "destructive", title: "입력 오류", description: "종목코드와 종목명을 입력해주세요" });
      return;
    }
    createAlertMutation.mutate({
      stockCode: alertStockCode,
      stockName: alertStockName,
      alertType,
      targetValue: alertTargetValue || null,
    });
  };

  const s = settings as any;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">설정</h1>
        <p className="text-muted-foreground mt-1">API 연결, 거래 모드, AI 모델, 알림을 관리하세요</p>
      </div>

      <SettingsKiwoom
        appKey={appKey} appSecret={appSecret} showSecret={showSecret}
        isPending={updateSettingsMutation.isPending} hasKiwoomKeys={s?.hasKiwoomKeys}
        onAppKeyChange={setAppKey} onAppSecretChange={setAppSecret}
        onShowSecretChange={setShowSecret} onSave={saveApiKeys}
      />

      <SettingsTrading
        tradingMode={s?.tradingMode}
        onToggle={() => updateSettingsMutation.mutate({ tradingMode: s?.tradingMode === "real" ? "mock" : "real" })}
      />

      <SettingsAI
        aiModel={s?.aiModel} isPending={updateSettingsMutation.isPending}
        onModelChange={(v) => updateSettingsMutation.mutate({ aiModel: v })}
      />

      <SettingsNotifications
        priceAlertEnabled={s?.priceAlertEnabled} tradeAlertEnabled={s?.tradeAlertEnabled}
        onPriceAlertChange={(v) => updateSettingsMutation.mutate({ priceAlertEnabled: v })}
        onTradeAlertChange={(v) => updateSettingsMutation.mutate({ tradeAlertEnabled: v })}
      />

      <SettingsStockAlerts
        alerts={alerts} alertStockCode={alertStockCode} alertStockName={alertStockName}
        alertType={alertType} alertTargetValue={alertTargetValue}
        isPending={createAlertMutation.isPending} isDeleting={deleteAlertMutation.isPending}
        onStockCodeChange={setAlertStockCode} onStockNameChange={setAlertStockName}
        onAlertTypeChange={setAlertType} onTargetValueChange={setAlertTargetValue}
        onCreate={handleCreateAlert} onDelete={(id) => deleteAlertMutation.mutate(id)}
      />
    </div>
  );
}
