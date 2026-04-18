// SettingsAgentAlerts.tsx — 에이전트 연결 끊김 시 이메일/웹훅 알림 설정 카드
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Mail, Globe, SendHorizonal, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Label } from "@/components/ui/label";

interface AgentAlertConfig {
  enabled: boolean;
  email: string;
  webhookUrl?: string;
  disconnectThresholdMinutes: number;
}

interface AlertSettingsResponse {
  agentAlert: AgentAlertConfig;
  smtpConfigured: boolean;
}

interface PatchAlertBody {
  enabled?: boolean;
  email?: string;
  webhookUrl?: string;
  disconnectThresholdMinutes?: number;
}

interface TestAlertResponse {
  ok: boolean;
  message?: string;
  error?: string;
}

export function SettingsAgentAlerts() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<AlertSettingsResponse>({
    queryKey: ["/api/kiwoom-agent/alert-settings"],
  });

  const [email, setEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [threshold, setThreshold] = useState(3);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.agentAlert) {
      setEmail(data.agentAlert.email || "");
      setWebhookUrl(data.agentAlert.webhookUrl || "");
      setThreshold(data.agentAlert.disconnectThresholdMinutes || 3);
    }
  }, [data]);

  const patchMutation = useMutation({
    mutationFn: async (body: PatchAlertBody) =>
      (await apiRequest("PATCH", "/api/kiwoom-agent/alert-settings", body)).json() as Promise<AlertSettingsResponse>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/alert-settings"] });
      setDirty(false);
      toast({ title: "설정 저장됨", description: "알림 설정이 저장되었습니다" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "저장 실패", description: e.message }),
  });

  const testMutation = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/kiwoom-agent/alert-settings/test", {})).json() as Promise<TestAlertResponse>,
    onSuccess: (result) => {
      toast({ title: "테스트 알림 발송됨", description: result.message ?? "발송 완료" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "발송 실패", description: e.message }),
  });

  const handleToggle = (enabled: boolean) => {
    patchMutation.mutate({ enabled });
  };

  const handleSave = () => {
    if (!email.trim() && !webhookUrl.trim()) {
      toast({ variant: "destructive", title: "입력 오류", description: "이메일 또는 웹훅 URL 중 하나를 입력하세요" });
      return;
    }
    patchMutation.mutate({
      email: email.trim(),
      webhookUrl: webhookUrl.trim(),
      disconnectThresholdMinutes: threshold,
    });
  };

  const enabled = data?.agentAlert?.enabled ?? false;
  const smtpConfigured = data?.smtpConfigured ?? false;
  const hasChannel = !!(email.trim() || webhookUrl.trim() || data?.agentAlert?.email || data?.agentAlert?.webhookUrl);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            {enabled ? (
              <Bell className="h-4 w-4 text-primary" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            에이전트 연결 끊김 알림
          </CardTitle>
          <CardDescription>
            집 PC 에이전트가 일정 시간 응답 없을 때 즉시 외부 알림 받기
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-sm font-medium text-muted-foreground">
            {enabled ? "ON" : "OFF"}
          </span>
          <Switch
            data-testid="switch-agent-alerts"
            checked={enabled}
            disabled={isLoading || patchMutation.isPending}
            onCheckedChange={handleToggle}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {!smtpConfigured && (
            <div
              data-testid="banner-smtp-not-configured"
              className="flex items-start gap-2 text-sm bg-muted/50 rounded-md px-3 py-2.5"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium text-foreground">SMTP 미설정</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  이메일 알림: <code className="bg-muted px-1 py-0.5 rounded text-xs">SMTP_HOST</code>{", "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">SMTP_USER</code>{", "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">SMTP_PASS</code> 시크릿 필요
                </p>
              </div>
            </div>
          )}
          {smtpConfigured && (
            <div
              data-testid="banner-smtp-configured"
              className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
              <span>SMTP 설정됨 — 이메일 발송 가능</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="alert-email" className="text-sm font-medium flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              이메일 주소
            </Label>
            <Input
              id="alert-email"
              data-testid="input-alert-email"
              type="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setDirty(true); }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alert-webhook" className="text-sm font-medium flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              웹훅 URL
              <Badge variant="secondary" className="text-xs font-normal">Slack / Discord / 카카오웍스 등</Badge>
            </Label>
            <Input
              id="alert-webhook"
              data-testid="input-alert-webhook"
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={webhookUrl}
              onChange={(e) => { setWebhookUrl(e.target.value); setDirty(true); }}
            />
            <p className="text-xs text-muted-foreground">
              Slack Incoming Webhook, Discord Webhook, 카카오웍스 등 POST를 지원하는 URL
            </p>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="alert-threshold" className="text-sm font-medium">
              연결 끊김 판정 기준 시간 (분)
            </Label>
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                id="alert-threshold"
                data-testid="input-alert-threshold"
                type="number"
                min={1}
                max={60}
                className="w-24"
                value={threshold}
                onChange={(e) => { setThreshold(parseInt(e.target.value) || 3); setDirty(true); }}
              />
              <p className="text-sm text-muted-foreground">
                마지막 폴링 이후 이 시간이 지나면 알림 발송
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Button
              data-testid="button-save-alert-settings"
              variant="default"
              size="sm"
              disabled={!dirty || patchMutation.isPending}
              onClick={handleSave}
            >
              저장
            </Button>

            <Button
              data-testid="button-test-alert"
              variant="outline"
              size="sm"
              disabled={!hasChannel || testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              <SendHorizonal className="h-3.5 w-3.5" />
              테스트 발송
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>에이전트가 임계 시간 이상 응답 없으면 연결 끊김 알림을 발송합니다.</p>
            <p>에이전트가 다시 연결되면 복구 알림도 자동 발송됩니다.</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <Badge variant="secondary" className="text-xs font-normal">이메일</Badge>
              <Badge variant="secondary" className="text-xs font-normal">웹훅</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
