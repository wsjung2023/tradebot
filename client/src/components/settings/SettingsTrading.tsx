// SettingsTrading.tsx — 모의투자/실전투자 거래 모드 전환 + 실계좌 PIN 잠금
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Lock, Unlock } from "lucide-react";
import { useRealAccountLock } from "@/hooks/use-real-account-lock";
import { useToast } from "@/hooks/use-toast";

interface Props {
  tradingMode?: string;
  onToggle: () => void;
}

export function SettingsTrading({ tradingMode, onToggle }: Props) {
  const { toast } = useToast();
  const { enabled, isLocked, enable, disable } = useRealAccountLock();
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const handleEnableLock = () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast({ variant: "destructive", title: "PIN 오류", description: "4자리 숫자를 입력해주세요" });
      return;
    }
    if (newPin !== confirmPin) {
      toast({ variant: "destructive", title: "PIN 불일치", description: "PIN 확인이 일치하지 않습니다" });
      return;
    }
    enable(newPin);
    setNewPin("");
    setConfirmPin("");
    toast({ title: "실계좌 잠금 설정됨", description: "실전 계좌 선택 시 PIN을 입력해야 합니다" });
  };

  const handleDisableLock = () => {
    disable();
    toast({ title: "실계좌 잠금 해제됨" });
  };

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

        <Separator />

        {/* 실계좌 PIN 잠금 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {enabled ? <Lock className="h-4 w-4 text-amber-500" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
            <div>
              <p className="font-medium text-sm">실계좌 자산 잠금</p>
              <p className="text-xs text-muted-foreground">
                활성화 시 실전 계좌 선택 시 PIN을 입력해야 자산 정보가 표시됩니다
              </p>
            </div>
          </div>

          {enabled ? (
            <div className="flex items-center gap-2 ml-6">
              <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                <Lock className="h-3.5 w-3.5" />
                <span>잠금 설정됨</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDisableLock}>
                잠금 해제
              </Button>
            </div>
          ) : (
            <div className="ml-6 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="새 PIN (4자리)"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-36 text-center tracking-widest"
                />
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="PIN 확인"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-36 text-center tracking-widest"
                />
                <Button
                  size="sm"
                  onClick={handleEnableLock}
                  disabled={newPin.length !== 4 || confirmPin.length !== 4}
                >
                  설정
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
