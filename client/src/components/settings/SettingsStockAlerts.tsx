// SettingsStockAlerts.tsx — 종목별 가격/거래량/AI 신호 알림 생성 및 목록 관리 카드
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Plus, Trash2 } from "lucide-react";
import type { Alert } from "@shared/schema";

interface Props {
  alerts: Alert[];
  alertStockCode: string;
  alertStockName: string;
  alertType: "price_above" | "price_below" | "volume_spike" | "ai_signal";
  alertTargetValue: string;
  isPending: boolean;
  isDeleting: boolean;
  onStockCodeChange: (v: string) => void;
  onStockNameChange: (v: string) => void;
  onAlertTypeChange: (v: any) => void;
  onTargetValueChange: (v: string) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  price_above: "가격 상승",
  price_below: "가격 하락",
  volume_spike: "거래량 급증",
  ai_signal: "AI 신호",
};

export function SettingsStockAlerts({
  alerts, alertStockCode, alertStockName, alertType, alertTargetValue,
  isPending, isDeleting, onStockCodeChange, onStockNameChange,
  onAlertTypeChange, onTargetValueChange, onCreate, onDelete,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />종목 알림 설정</CardTitle>
        <CardDescription>특정 종목에 대한 가격 알림을 설정하세요</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-medium">새 알림 설정</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>종목코드</Label>
              <Input placeholder="예: 005930" value={alertStockCode} onChange={(e) => onStockCodeChange(e.target.value)} data-testid="input-alert-stock-code" />
            </div>
            <div className="space-y-2">
              <Label>종목명</Label>
              <Input placeholder="예: 삼성전자" value={alertStockName} onChange={(e) => onStockNameChange(e.target.value)} data-testid="input-alert-stock-name" />
            </div>
            <div className="space-y-2">
              <Label>알림 유형</Label>
              <Select value={alertType} onValueChange={onAlertTypeChange}>
                <SelectTrigger data-testid="select-alert-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_above">가격 상승</SelectItem>
                  <SelectItem value="price_below">가격 하락</SelectItem>
                  <SelectItem value="volume_spike">거래량 급증</SelectItem>
                  <SelectItem value="ai_signal">AI 신호</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(alertType === "price_above" || alertType === "price_below") && (
              <div className="space-y-2">
                <Label>목표 가격</Label>
                <Input type="number" min="0" step="1000" placeholder="예: 70000" value={alertTargetValue} onChange={(e) => onTargetValueChange(e.target.value)} data-testid="input-alert-target-value" />
              </div>
            )}
          </div>
          <Button onClick={onCreate} disabled={isPending} data-testid="button-create-alert">
            <Plus className="h-4 w-4 mr-2" />
            {isPending ? "생성 중..." : "알림 생성"}
          </Button>
        </div>
        <Separator />
        <div className="space-y-4">
          <h3 className="font-medium">활성 알림 목록</h3>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-alerts">등록된 알림이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg hover-elevate" data-testid={`alert-item-${alert.id}`}>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{alert.stockCode}</span>
                      <span className="text-muted-foreground">{alert.stockName}</span>
                      <Badge variant={alert.isTriggered ? "destructive" : "default"}>{alert.isTriggered ? "발동됨" : "대기중"}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{ALERT_TYPE_LABELS[alert.alertType] || alert.alertType}</span>
                      {alert.targetValue && <span>목표: {parseFloat(alert.targetValue).toLocaleString()}원</span>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(alert.id)} disabled={isDeleting} data-testid={`button-delete-alert-${alert.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
