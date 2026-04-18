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
import { Bell, BellOff, Mail, Globe, SendHorizonal, AlertTriangle, CheckCircle2, Info, XCircle, Clock, ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type EmailProvider = "smtp" | "sendgrid" | "resend" | "auto";

interface AgentAlertConfig {
  enabled: boolean;
  email: string;
  webhookUrl?: string;
  disconnectThresholdMinutes: number;
  emailProvider?: EmailProvider;
}

interface EmailProviderStatuses {
  smtp: boolean;
  sendgrid: boolean;
  resend: boolean;
}

interface AlertSettingsResponse {
  agentAlert: AgentAlertConfig;
  smtpConfigured: boolean;
  emailProviders?: EmailProviderStatuses;
}

interface PatchAlertBody {
  enabled?: boolean;
  email?: string;
  webhookUrl?: string;
  disconnectThresholdMinutes?: number;
  emailProvider?: EmailProvider;
}

interface TestAlertResponse {
  ok: boolean;
  message?: string;
  error?: string;
}

interface AgentAlertLog {
  id: number;
  userId: string;
  sentAt: string;
  toEmail: string | null;
  alertType: string;
  success: boolean;
  errorMessage: string | null;
}

interface AlertLogsResponse {
  logs: AgentAlertLog[];
}

function alertTypeLabel(type: string): string {
  if (type === "disconnect") return "연결 끊김";
  if (type === "recovery") return "복구";
  if (type === "test") return "테스트";
  return type;
}

function formatSentAt(sentAt: string): string {
  const d = new Date(sentAt);
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const PROVIDER_LABELS: Record<EmailProvider, string> = {
  auto: "자동 선택",
  smtp: "SMTP",
  sendgrid: "SendGrid",
  resend: "Resend",
};

export function SettingsAgentAlerts() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<AlertSettingsResponse>({
    queryKey: ["/api/kiwoom-agent/alert-settings"],
  });

  const { data: logsData, isLoading: logsLoading } = useQuery<AlertLogsResponse>({
    queryKey: ["/api/kiwoom-agent/alert-logs"],
  });

  const [email, setEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [threshold, setThreshold] = useState(3);
  const [emailProvider, setEmailProvider] = useState<EmailProvider>("auto");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.agentAlert) {
      setEmail(data.agentAlert.email || "");
      setWebhookUrl(data.agentAlert.webhookUrl || "");
      setThreshold(data.agentAlert.disconnectThresholdMinutes || 3);
      setEmailProvider(data.agentAlert.emailProvider || "auto");
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
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/alert-logs"] });
      toast({ title: "테스트 알림 발송됨", description: result.message ?? "발송 완료" });
    },
    onError: (e: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/alert-logs"] });
      toast({ variant: "destructive", title: "발송 실패", description: e.message });
    },
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
      emailProvider,
    });
  };

  const enabled = data?.agentAlert?.enabled ?? false;
  const providerStatuses = data?.emailProviders;
  const hasAnyEmailProvider = !!(providerStatuses?.smtp || providerStatuses?.sendgrid || providerStatuses?.resend);
  const hasChannel = !!(email.trim() || webhookUrl.trim() || data?.agentAlert?.email || data?.agentAlert?.webhookUrl);
  const logs = logsData?.logs ?? [];

  // build list of available (configured) providers for display
  const configuredProviders: Array<{ key: EmailProvider; label: string }> = [];
  if (providerStatuses?.sendgrid) configuredProviders.push({ key: "sendgrid", label: "SendGrid" });
  if (providerStatuses?.resend) configuredProviders.push({ key: "resend", label: "Resend" });
  if (providerStatuses?.smtp) configuredProviders.push({ key: "smtp", label: "SMTP" });

  // Available options for the dropdown = configured providers + auto
  const providerOptions: Array<{ key: EmailProvider; label: string }> = [
    { key: "auto", label: "자동 선택" },
    ...configuredProviders,
  ];

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
        {/* 이메일 공급자 상태 배너 */}
        <div className="space-y-2">
          {!hasAnyEmailProvider && (
            <div
              data-testid="banner-smtp-not-configured"
              className="flex items-start gap-2 text-sm bg-muted/50 rounded-md px-3 py-2.5"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium text-foreground">이메일 공급자 미설정</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  아래 중 하나를 설정하면 이메일 알림을 받을 수 있습니다:
                </p>
                <ul className="text-muted-foreground text-xs mt-1 space-y-0.5 list-disc list-inside">
                  <li>
                    <strong>SendGrid</strong>: <code className="bg-muted px-1 py-0.5 rounded text-xs">SENDGRID_API_KEY</code>
                    {" "}+ 선택: <code className="bg-muted px-1 py-0.5 rounded text-xs">SENDGRID_FROM</code>
                  </li>
                  <li>
                    <strong>Resend</strong>: <code className="bg-muted px-1 py-0.5 rounded text-xs">RESEND_API_KEY</code>
                    {" "}+ 선택: <code className="bg-muted px-1 py-0.5 rounded text-xs">RESEND_FROM</code>
                  </li>
                  <li>
                    <strong>SMTP</strong>: <code className="bg-muted px-1 py-0.5 rounded text-xs">SMTP_HOST</code>{", "}
                    <code className="bg-muted px-1 py-0.5 rounded text-xs">SMTP_USER</code>{", "}
                    <code className="bg-muted px-1 py-0.5 rounded text-xs">SMTP_PASS</code>
                  </li>
                </ul>
              </div>
            </div>
          )}
          {hasAnyEmailProvider && (
            <div
              data-testid="banner-smtp-configured"
              className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
              <span className="text-muted-foreground">이메일 발송 가능 —</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {configuredProviders.map((p) => (
                  <Badge key={p.key} variant="secondary" className="text-xs font-normal" data-testid={`badge-provider-${p.key}`}>
                    {p.label}
                  </Badge>
                ))}
              </div>
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

          {/* 이메일 발송 방식 선택 — 이메일이 입력된 경우에만 표시 */}
          {(email.trim() || data?.agentAlert?.email) && hasAnyEmailProvider && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                이메일 발송 방식
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="select-email-provider"
                    className="w-48 justify-between"
                  >
                    <span>{PROVIDER_LABELS[emailProvider]}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup
                    value={emailProvider}
                    onValueChange={(v) => { setEmailProvider(v as EmailProvider); setDirty(true); }}
                  >
                    {providerOptions.map((opt) => (
                      <DropdownMenuRadioItem
                        key={opt.key}
                        value={opt.key}
                        data-testid={`option-provider-${opt.key}`}
                      >
                        {opt.label}
                        {opt.key === "auto" && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({configuredProviders[0]?.label ?? "미설정"} 우선)
                          </span>
                        )}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {emailProvider !== "auto" && providerStatuses && !providerStatuses[emailProvider] ? (
                <div
                  data-testid="banner-provider-not-configured"
                  className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {PROVIDER_LABELS[emailProvider]}이 설정되지 않았습니다. 자동 선택으로 변경하거나 해당 API 키를 설정하세요.
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {emailProvider === "auto"
                    ? "설정된 공급자 중 SendGrid → Resend → SMTP 순으로 자동 선택됩니다"
                    : `${PROVIDER_LABELS[emailProvider]}을 통해 이메일을 발송합니다`}
                </p>
              )}
            </div>
          )}

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

        {/* 알림 이력 */}
        <div className="space-y-2" data-testid="section-alert-logs">
          <p className="text-sm font-medium">최근 알림 이력</p>
          {logsLoading ? (
            <div className="text-xs text-muted-foreground py-2">불러오는 중...</div>
          ) : logs.length === 0 ? (
            <div
              data-testid="text-alert-logs-empty"
              className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2.5"
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>아직 발송된 알림이 없습니다</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log) => (
                <div
                  key={log.id}
                  data-testid={`row-alert-log-${log.id}`}
                  className="flex items-start gap-2.5 rounded-md bg-muted/40 px-3 py-2"
                >
                  {log.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />
                  )}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs font-normal">
                        {alertTypeLabel(log.alertType)}
                      </Badge>
                      {log.toEmail && (
                        <span className="text-xs text-muted-foreground truncate">{log.toEmail}</span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">{formatSentAt(log.sentAt)}</span>
                    </div>
                    {!log.success && log.errorMessage && (
                      <p className="text-xs text-destructive truncate">{log.errorMessage}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>에이전트가 임계 시간 이상 응답 없으면 연결 끊김 알림을 발송합니다.</p>
            <p>에이전트가 다시 연결되면 복구 알림도 자동 발송됩니다.</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <Badge variant="secondary" className="text-xs font-normal">이메일</Badge>
              <Badge variant="secondary" className="text-xs font-normal">SMTP</Badge>
              <Badge variant="secondary" className="text-xs font-normal">SendGrid</Badge>
              <Badge variant="secondary" className="text-xs font-normal">Resend</Badge>
              <Badge variant="secondary" className="text-xs font-normal">웹훅</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
