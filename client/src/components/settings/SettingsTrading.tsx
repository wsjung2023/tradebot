// SettingsTrading.tsx — 모의투자/실전투자 거래 모드 전환 설정 카드
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Shield } from "lucide-react";

interface Props {
  tradingMode?: string;
  onToggle: () => void;
}

export function SettingsTrading({ tradingMode, onToggle }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />거래 설정</CardTitle>
        <CardDescription>모의투자와 실전투자 모드를 전환할 수 있습니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">거래 모드</p>
            <p className="text-sm text-muted-foreground">{tradingMode === "real" ? "실전투자" : "모의투자"}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="trading-mode" className="text-sm">모의투자</Label>
            <Switch id="trading-mode" checked={tradingMode === "real"} onCheckedChange={onToggle} data-testid="switch-trading-mode" />
            <Label htmlFor="trading-mode" className="text-sm">실전</Label>
          </div>
        </div>
        <Separator />
        <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-md border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200">⚠️ 실전 모드에서는 실제 자금이 거래됩니다. 신중하게 사용하세요.</p>
        </div>
      </CardContent>
    </Card>
  );
}
