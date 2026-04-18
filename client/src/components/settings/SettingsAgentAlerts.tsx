// SettingsAgentAlerts.tsx — 에이전트 연결 끊김 시 이메일/웹훅/카카오 알림톡 설정 카드
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
import { Bell, BellOff, Mail, Globe, SendHorizonal, AlertTriangle, CheckCircle2, Info, XCircle, Clock, ChevronDown, Key, Eye, EyeOff, Trash2, MessageCircle, ChevronUp } from "lucide-react";
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
  kakaoEnabled?: boolean;
  kakaoApiKey?: string;
  kakaoUserId?: string;
  kakaoSenderKey?: string;
  kakaoPhoneFrom?: string;
  kakaoPhoneTo?: string;
  kakaoDisconnectTemplateCode?: string;
  kakaoRecoveryTemplateCode?: string;
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
  kakaoEnabled?: boolean;
  kakaoApiKey?: string;
  kakaoUserId?: string;
  kakaoSenderKey?: string;
  kakaoPhoneFrom?: string;
  kakaoPhoneTo?: string;
  kakaoDisconnectTemplateCode?: string;
  kakaoRecoveryTemplateCode?: string;
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

interface EmailApiKeysResponse {
  sendgridApiKey: string | null;
  resendApiKey: string | null;
  hasSendgridKey: boolean;
  hasResendKey: boolean;
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

function ApiKeyField({
  label,
  providerKey,
  maskedValue,
  hasSavedKey,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  label: string;
  providerKey: "sendgrid" | "resend";
  maskedValue: string | null;
  hasSavedKey: boolean;
  onSave: (key: string) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}) {
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    if (inputValue.trim()) {
      onSave(inputValue.trim());
      setInputValue("");
      setShowInput(false);
    }
  };

  if (hasSavedKey && !showInput) {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Key className="h-3.5 w-3.5 text-muted-foreground" />
          {label} API 키
        </Label>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-3 py-1.5 text-sm font-mono text-muted-foreground min-w-0">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
            <span data-testid={`text-${providerKey}-key-masked`} className="truncate">
              {showKey ? maskedValue : "••••••••••••••••••••"}
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            data-testid={`button-toggle-${providerKey}-key-visibility`}
            onClick={() => setShowKey(!showKey)}
            title={showKey ? "숨기기" : "마스킹된 키 보기"}
          >
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid={`button-change-${providerKey}-key`}
            onClick={() => setShowInput(true)}
          >
            변경
          </Button>
          <Button
            size="icon"
            variant="ghost"
            data-testid={`button-delete-${providerKey}-key`}
            onClick={onDelete}
            disabled={isDeleting}
            title="키 삭제"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          저장된 키가 환경 변수보다 우선 적용됩니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`input-${providerKey}-key`} className="text-sm font-medium flex items-center gap-1.5">
        <Key className="h-3.5 w-3.5 text-muted-foreground" />
        {label} API 키
      </Label>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          id={`input-${providerKey}-key`}
          data-testid={`input-${providerKey}-api-key`}
          type="password"
          placeholder={providerKey === "sendgrid" ? "SG.xxxxxxxx..." : "re_xxxxxxxx..."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-xs"
          autoComplete="off"
        />
        <Button
          size="sm"
          variant="default"
          data-testid={`button-save-${providerKey}-key`}
          disabled={!inputValue.trim() || isSaving}
          onClick={handleSave}
        >
          저장
        </Button>
        {hasSavedKey && (
          <Button
            size="sm"
            variant="ghost"
            data-testid={`button-cancel-${providerKey}-key`}
            onClick={() => { setShowInput(false); setInputValue(""); }}
          >
            취소
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {providerKey === "sendgrid"
          ? "SendGrid 대시보드 → Settings → API Keys에서 생성"
          : "Resend 대시보드 → API Keys에서 생성"}
      </p>
    </div>
  );
}

export function SettingsAgentAlerts() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<AlertSettingsResponse>({
    queryKey: ["/api/kiwoom-agent/alert-settings"],
  });

  const { data: logsData, isLoading: logsLoading } = useQuery<AlertLogsResponse>({
    queryKey: ["/api/kiwoom-agent/alert-logs"],
  });

  const { data: apiKeysData, isLoading: apiKeysLoading } = useQuery<EmailApiKeysResponse>({
    queryKey: ["/api/kiwoom-agent/email-api-keys"],
  });

  const [email, setEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [threshold, setThreshold] = useState(3);
  const [emailProvider, setEmailProvider] = useState<EmailProvider>("auto");
  const [dirty, setDirty] = useState(false);

  const [kakaoEnabled, setKakaoEnabled] = useState(false);
  const [kakaoExpanded, setKakaoExpanded] = useState(false);
  const [kakaoApiKey, setKakaoApiKey] = useState("");
  const [kakaoUserId, setKakaoUserId] = useState("");
  const [kakaoSenderKey, setKakaoSenderKey] = useState("");
  const [kakaoPhoneFrom, setKakaoPhoneFrom] = useState("");
  const [kakaoPhoneTo, setKakaoPhoneTo] = useState("");
  const [kakaoDisconnectTemplateCode, setKakaoDisconnectTemplateCode] = useState("");
  const [kakaoRecoveryTemplateCode, setKakaoRecoveryTemplateCode] = useState("");

  useEffect(() => {
    if (data?.agentAlert) {
      const a = data.agentAlert;
      setEmail(a.email || "");
      setWebhookUrl(a.webhookUrl || "");
      setThreshold(a.disconnectThresholdMinutes || 3);
      setEmailProvider(a.emailProvider || "auto");
      setKakaoEnabled(a.kakaoEnabled ?? false);
      setKakaoApiKey(a.kakaoApiKey || "");
      setKakaoUserId(a.kakaoUserId || "");
      setKakaoSenderKey(a.kakaoSenderKey || "");
      setKakaoPhoneFrom(a.kakaoPhoneFrom || "");
      setKakaoPhoneTo(a.kakaoPhoneTo || "");
      setKakaoDisconnectTemplateCode(a.kakaoDisconnectTemplateCode || "");
      setKakaoRecoveryTemplateCode(a.kakaoRecoveryTemplateCode || "");
      if (a.kakaoEnabled) setKakaoExpanded(true);
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

  const saveApiKeyMutation = useMutation({
    mutationFn: async (body: { sendgridApiKey?: string | null; resendApiKey?: string | null }) =>
      (await apiRequest("PATCH", "/api/kiwoom-agent/email-api-keys", body)).json() as Promise<EmailApiKeysResponse>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/email-api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/alert-settings"] });
      toast({ title: "API 키 저장됨", description: "이메일 API 키가 암호화되어 저장되었습니다" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "저장 실패", description: e.message }),
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: async (body: { sendgridApiKey?: null; resendApiKey?: null }) =>
      (await apiRequest("PATCH", "/api/kiwoom-agent/email-api-keys", body)).json() as Promise<EmailApiKeysResponse>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/email-api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kiwoom-agent/alert-settings"] });
      toast({ title: "API 키 삭제됨", description: "이메일 API 키가 삭제되었습니다" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "삭제 실패", description: e.message }),
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

  const handleKakaoToggle = (val: boolean) => {
    setKakaoEnabled(val);
    setDirty(true);
    if (val) setKakaoExpanded(true);
  };

  const handleSave = () => {
    const hasEmail = !!email.trim();
    const hasWebhook = !!webhookUrl.trim();
    const hasKakao = !!(kakaoEnabled && kakaoApiKey.trim() && kakaoUserId.trim() && kakaoSenderKey.trim() && kakaoPhoneTo.trim() && kakaoDisconnectTemplateCode.trim());
    if (!hasEmail && !hasWebhook && !hasKakao) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "이메일, 웹훅 URL, 또는 카카오 알림톡 설정 중 하나를 입력하세요",
      });
      return;
    }
    patchMutation.mutate({
      email: email.trim(),
      webhookUrl: webhookUrl.trim(),
      disconnectThresholdMinutes: threshold,
      emailProvider,
      kakaoEnabled,
      kakaoApiKey: kakaoApiKey.trim(),
      kakaoUserId: kakaoUserId.trim(),
      kakaoSenderKey: kakaoSenderKey.trim(),
      kakaoPhoneFrom: kakaoPhoneFrom.trim(),
      kakaoPhoneTo: kakaoPhoneTo.trim(),
      kakaoDisconnectTemplateCode: kakaoDisconnectTemplateCode.trim(),
      kakaoRecoveryTemplateCode: kakaoRecoveryTemplateCode.trim(),
    });
  };

  const enabled = data?.agentAlert?.enabled ?? false;
  const smtpConfigured = data?.smtpConfigured ?? false;
  const providerStatuses = data?.emailProviders;
  const hasAnyEmailProvider = !!(providerStatuses?.smtp || providerStatuses?.sendgrid || providerStatuses?.resend);
  const hasChannel = !!(
    email.trim() || webhookUrl.trim() ||
    data?.agentAlert?.email || data?.agentAlert?.webhookUrl ||
    (data?.agentAlert?.kakaoEnabled && data?.agentAlert?.kakaoPhoneTo)
  );
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

  const markDirty = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setDirty(true);
  };
  const hasSendgridKey = apiKeysData?.hasSendgridKey ?? false;
  const hasResendKey = apiKeysData?.hasResendKey ?? false;

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
                  아래 API 키를 직접 입력하거나, 서버 환경 변수를 설정하면 이메일 알림을 받을 수 있습니다.
                </p>
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

        {/* ─── 이메일 API 키 직접 입력 섹션 ─────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">이메일 API 키 설정</p>
            <p className="text-xs text-muted-foreground">— 환경 변수 대신 직접 입력 (암호화 저장)</p>
          </div>

          {apiKeysLoading ? (
            <div className="text-xs text-muted-foreground py-1">불러오는 중...</div>
          ) : (
            <div className="space-y-4 pl-1">
              <ApiKeyField
                label="SendGrid"
                providerKey="sendgrid"
                maskedValue={apiKeysData?.sendgridApiKey ?? null}
                hasSavedKey={hasSendgridKey}
                onSave={(key) => saveApiKeyMutation.mutate({ sendgridApiKey: key })}
                onDelete={() => deleteApiKeyMutation.mutate({ sendgridApiKey: null })}
                isSaving={saveApiKeyMutation.isPending}
                isDeleting={deleteApiKeyMutation.isPending}
              />
              <ApiKeyField
                label="Resend"
                providerKey="resend"
                maskedValue={apiKeysData?.resendApiKey ?? null}
                hasSavedKey={hasResendKey}
                onSave={(key) => saveApiKeyMutation.mutate({ resendApiKey: key })}
                onDelete={() => deleteApiKeyMutation.mutate({ resendApiKey: null })}
                isSaving={saveApiKeyMutation.isPending}
                isDeleting={deleteApiKeyMutation.isPending}
              />
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="alert-email" className="text-sm font-medium flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              알림 수신 이메일 주소
            </Label>
            <Input
              id="alert-email"
              data-testid="input-alert-email"
              type="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={markDirty(setEmail)}
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
                    {PROVIDER_LABELS[emailProvider]}이 설정되지 않았습니다. 자동 선택으로 변경하거나 해당 API 키를 입력하세요.
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
              onChange={markDirty(setWebhookUrl)}
            />
            <p className="text-xs text-muted-foreground">
              Slack Incoming Webhook, Discord Webhook, 카카오웍스 등 POST를 지원하는 URL
            </p>
          </div>

          <Separator />

          {/* ─── 카카오 알림톡 섹션 ────────────────────────────────────── */}
          <div className="rounded-md border">
            <button
              type="button"
              data-testid="button-kakao-section-toggle"
              className="w-full flex items-center justify-between px-3 py-2.5 text-left"
              onClick={() => setKakaoExpanded((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[#FEE500] fill-[#FEE500]" />
                <span className="text-sm font-medium">카카오 알림톡</span>
                <Badge variant="secondary" className="text-xs font-normal">Aligo 비즈메시지</Badge>
                {kakaoEnabled && (
                  <Badge variant="default" className="text-xs font-normal">활성화됨</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  data-testid="switch-kakao-enabled"
                  checked={kakaoEnabled}
                  onCheckedChange={handleKakaoToggle}
                  onClick={(e) => e.stopPropagation()}
                />
                {kakaoExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {kakaoExpanded && (
              <div className="px-3 pb-3 space-y-3 border-t pt-3">
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2.5">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p>Aligo 비즈메시지 계정과 카카오 알림톡 채널이 필요합니다.</p>
                    <p>연결 끊김/복구 각각 승인된 알림톡 템플릿 코드를 입력하세요.</p>
                    <p>템플릿 변수: <code className="bg-muted px-1 rounded">에이전트 연결 끊김</code>, <code className="bg-muted px-1 rounded">마지막 연결</code>, <code className="bg-muted px-1 rounded">감지 시각</code> 등 포함 권장</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="kakao-api-key" className="text-xs font-medium">
                      Aligo API Key
                    </Label>
                    <Input
                      id="kakao-api-key"
                      data-testid="input-kakao-api-key"
                      type="password"
                      placeholder="Aligo API 키"
                      value={kakaoApiKey}
                      onChange={markDirty(setKakaoApiKey)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="kakao-user-id" className="text-xs font-medium">
                      Aligo 사용자 ID
                    </Label>
                    <Input
                      id="kakao-user-id"
                      data-testid="input-kakao-user-id"
                      placeholder="Aligo 로그인 ID"
                      value={kakaoUserId}
                      onChange={markDirty(setKakaoUserId)}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kakao-sender-key" className="text-xs font-medium">
                    카카오 채널 발신 프로필 키 (Sender Key)
                  </Label>
                  <Input
                    id="kakao-sender-key"
                    data-testid="input-kakao-sender-key"
                    placeholder="40자리 발신 프로필 키"
                    value={kakaoSenderKey}
                    onChange={markDirty(setKakaoSenderKey)}
                    autoComplete="off"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="kakao-phone-from" className="text-xs font-medium">
                      발신자 번호 <span className="text-muted-foreground font-normal">(Aligo 등록 번호)</span>
                    </Label>
                    <Input
                      id="kakao-phone-from"
                      data-testid="input-kakao-phone-from"
                      type="tel"
                      placeholder="01012345678"
                      value={kakaoPhoneFrom}
                      onChange={markDirty(setKakaoPhoneFrom)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="kakao-phone-to" className="text-xs font-medium">
                      수신자 번호 <span className="text-muted-foreground font-normal">(알림 받을 번호)</span>
                    </Label>
                    <Input
                      id="kakao-phone-to"
                      data-testid="input-kakao-phone-to"
                      type="tel"
                      placeholder="01012345678"
                      value={kakaoPhoneTo}
                      onChange={markDirty(setKakaoPhoneTo)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="kakao-disconnect-tpl" className="text-xs font-medium">
                      연결 끊김 템플릿 코드
                    </Label>
                    <Input
                      id="kakao-disconnect-tpl"
                      data-testid="input-kakao-disconnect-template"
                      placeholder="TB_DISCONNECT"
                      value={kakaoDisconnectTemplateCode}
                      onChange={markDirty(setKakaoDisconnectTemplateCode)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="kakao-recovery-tpl" className="text-xs font-medium">
                      복구 템플릿 코드 <span className="text-muted-foreground font-normal">(없으면 연결 끊김 코드 사용)</span>
                    </Label>
                    <Input
                      id="kakao-recovery-tpl"
                      data-testid="input-kakao-recovery-template"
                      placeholder="TB_RECOVERY"
                      value={kakaoRecoveryTemplateCode}
                      onChange={markDirty(setKakaoRecoveryTemplateCode)}
                    />
                  </div>
                </div>
              </div>
            )}
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
            <p>UI에서 입력한 API 키는 AES-256-GCM으로 암호화되어 DB에 저장되며, 환경 변수보다 우선 적용됩니다.</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <Badge variant="secondary" className="text-xs font-normal">이메일</Badge>
              <Badge variant="secondary" className="text-xs font-normal">SMTP</Badge>
              <Badge variant="secondary" className="text-xs font-normal">SendGrid</Badge>
              <Badge variant="secondary" className="text-xs font-normal">Resend</Badge>
              <Badge variant="secondary" className="text-xs font-normal">웹훅</Badge>
              <Badge variant="secondary" className="text-xs font-normal">카카오 알림톡</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
