// SettingsNotifications.tsx — 가격 알림 및 거래 알림 on/off 설정 카드
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface Props {
  priceAlertEnabled?: boolean;
  tradeAlertEnabled?: boolean;
  onPriceAlertChange: (v: boolean) => void;
  onTradeAlertChange: (v: boolean) => void;
}

export function SettingsNotifications({ priceAlertEnabled, tradeAlertEnabled, onPriceAlertChange, onTradeAlertChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>알림 설정</CardTitle>
        <CardDescription>가격 알림 및 거래 알림 설정</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">가격 알림</p>
            <p className="text-sm text-muted-foreground">목표가격에 도달하면 알림</p>
          </div>
          <Switch checked={priceAlertEnabled} onCheckedChange={onPriceAlertChange} data-testid="switch-price-alert" />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">거래 알림</p>
            <p className="text-sm text-muted-foreground">주문 체결 시 거래 알림</p>
          </div>
          <Switch checked={tradeAlertEnabled} onCheckedChange={onTradeAlertChange} data-testid="switch-trade-alert" />
        </div>
      </CardContent>
    </Card>
  );
}
