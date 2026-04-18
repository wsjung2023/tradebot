// agent-disconnect-watcher.ts — 에이전트 연결 끊김/복구 시 이메일/웹훅 알림 크론
// 매 분 실행. 에이전트가 임계값 이상 응답 없으면 설정된 사용자에게 알림 발송.
// 재연결 시 복구 알림도 발송. 알림 상태는 인스턴스 메모리에서 추적.
import { db } from "../db";
import * as schema from "@shared/schema";
import { getAgentLastSeenSecondsAgo } from "../routes/kiwoom-agent.routes";
import { sendAgentDisconnectAlert, sendAgentRecoveryAlert, type EmailProvider, type KakaoAlimtalkConfig } from "../services/agent-alert.service";
import { storage } from "../storage";

export interface AgentAlertSettings {
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

interface NotificationSettingsShape {
  agentAlert?: AgentAlertSettings;
}

interface UserAlertState {
  alertedAt: Date | null;
}

const userAlertStates = new Map<string, UserAlertState>();

let watcherInterval: ReturnType<typeof setInterval> | null = null;

function parseAgentAlertSettings(raw: unknown): AgentAlertSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const ns = raw as NotificationSettingsShape;
  const a = ns.agentAlert;
  if (!a || !a.enabled) return null;
  const hasKakao = !!(a.kakaoEnabled && a.kakaoApiKey && a.kakaoUserId && a.kakaoSenderKey && a.kakaoPhoneTo && a.kakaoDisconnectTemplateCode);
  if (!a.email && !a.webhookUrl && !hasKakao) return null;
  return {
    enabled: true,
    email: a.email || "",
    webhookUrl: a.webhookUrl,
    disconnectThresholdMinutes: Math.max(1, Number(a.disconnectThresholdMinutes) || 3),
    emailProvider: (a.emailProvider as EmailProvider) || "auto",
    kakaoEnabled: a.kakaoEnabled,
    kakaoApiKey: a.kakaoApiKey,
    kakaoUserId: a.kakaoUserId,
    kakaoSenderKey: a.kakaoSenderKey,
    kakaoPhoneFrom: a.kakaoPhoneFrom,
    kakaoPhoneTo: a.kakaoPhoneTo,
    kakaoDisconnectTemplateCode: a.kakaoDisconnectTemplateCode,
    kakaoRecoveryTemplateCode: a.kakaoRecoveryTemplateCode,
  };
}

async function getUsersWithAlertSettings(): Promise<Array<{ userId: string; settings: AgentAlertSettings }>> {
  try {
    const rows = await db
      .select({ userId: schema.userSettings.userId, notificationSettings: schema.userSettings.notificationSettings })
      .from(schema.userSettings);

    const result: Array<{ userId: string; settings: AgentAlertSettings }> = [];
    for (const row of rows) {
      const settings = parseAgentAlertSettings(row.notificationSettings);
      if (settings) {
        result.push({ userId: row.userId, settings });
      }
    }
    return result;
  } catch (err) {
    console.error("[AgentWatcher] 사용자 설정 조회 실패:", err);
    return [];
  }
}

function sendSucceeded(result: {
  email?: { ok: boolean } | null;
  webhook?: { ok: boolean } | null;
  kakao?: { ok: boolean } | null;
}): boolean {
  return (result.email?.ok === true) || (result.webhook?.ok === true) || (result.kakao?.ok === true);
}

function buildKakaoConfig(settings: AgentAlertSettings): KakaoAlimtalkConfig | undefined {
  if (
    settings.kakaoEnabled &&
    settings.kakaoApiKey &&
    settings.kakaoUserId &&
    settings.kakaoSenderKey &&
    settings.kakaoPhoneTo &&
    settings.kakaoDisconnectTemplateCode
  ) {
    return {
      apiKey: settings.kakaoApiKey,
      userId: settings.kakaoUserId,
      senderKey: settings.kakaoSenderKey,
      phoneFrom: settings.kakaoPhoneFrom || settings.kakaoPhoneTo,
      phoneTo: settings.kakaoPhoneTo,
      disconnectTemplateCode: settings.kakaoDisconnectTemplateCode,
      recoveryTemplateCode: settings.kakaoRecoveryTemplateCode || settings.kakaoDisconnectTemplateCode,
    };
  }
  return undefined;
}

function getFirstError(result: {
  email?: { ok: boolean; error?: string } | null;
  webhook?: { ok: boolean; error?: string } | null;
  kakao?: { ok: boolean; error?: string } | null;
}): string | null {
  return result.email?.error || result.webhook?.error || result.kakao?.error || null;
}

async function saveAlertLog(params: {
  userId: string;
  toEmail: string | undefined;
  alertType: string;
  success: boolean;
  errorMessage: string | null;
}) {
  try {
    await storage.createAgentAlertLog({
      userId: params.userId,
      toEmail: params.toEmail ?? null,
      alertType: params.alertType,
      success: params.success,
      errorMessage: params.errorMessage,
    });
  } catch (err) {
    console.error("[AgentWatcher] 알림 이력 저장 실패:", err);
  }
}

async function runCheck() {
  const lastSeenSec = getAgentLastSeenSecondsAgo();
  const users = await getUsersWithAlertSettings();
  if (users.length === 0) return;

  for (const { userId, settings } of users) {
    const thresholdSec = settings.disconnectThresholdMinutes * 60;
    const isDisconnected = lastSeenSec === null || lastSeenSec > thresholdSec;

    if (!userAlertStates.has(userId)) {
      userAlertStates.set(userId, { alertedAt: null });
    }
    const state = userAlertStates.get(userId)!;
    const wasAlerted = state.alertedAt !== null;

    if (isDisconnected && !wasAlerted) {
      // 최소 한 채널 성공한 경우에만 alertedAt 기록 (실패 시 다음 루프에서 재시도)
      const result = await sendAgentDisconnectAlert({
        toEmail: settings.email || undefined,
        webhookUrl: settings.webhookUrl,
        kakao: buildKakaoConfig(settings),
        thresholdMinutes: settings.disconnectThresholdMinutes,
        lastSeenSecondsAgo: lastSeenSec,
        emailProvider: settings.emailProvider,
      });
      const succeeded = sendSucceeded(result);
      await saveAlertLog({
        userId,
        toEmail: settings.email || undefined,
        alertType: "disconnect",
        success: succeeded,
        errorMessage: succeeded ? null : getFirstError(result),
      });
      if (succeeded) {
        state.alertedAt = new Date();
      }
    } else if (!isDisconnected && wasAlerted) {
      const disconnectedMs = Date.now() - state.alertedAt!.getTime();
      const disconnectedMinutes = Math.round(disconnectedMs / 60000);
      // 최소 한 채널 성공한 경우에만 alertedAt 초기화 (실패 시 다음 루프에서 재시도)
      const result = await sendAgentRecoveryAlert({
        toEmail: settings.email || undefined,
        webhookUrl: settings.webhookUrl,
        kakao: buildKakaoConfig(settings),
        disconnectedDurationMinutes: disconnectedMinutes,
        emailProvider: settings.emailProvider,
      });
      const succeeded = sendSucceeded(result);
      await saveAlertLog({
        userId,
        toEmail: settings.email || undefined,
        alertType: "recovery",
        success: succeeded,
        errorMessage: succeeded ? null : getFirstError(result),
      });
      if (succeeded) {
        state.alertedAt = null;
      }
    }
  }
}

export function startAgentDisconnectWatcher() {
  if (watcherInterval) return;
  console.log("[AgentWatcher] 에이전트 연결 감시 크론 시작 (60초 간격)");
  watcherInterval = setInterval(async () => {
    try {
      await runCheck();
    } catch (err) {
      console.error("[AgentWatcher] 크론 실행 오류:", err);
    }
  }, 60_000);
}

export function stopAgentDisconnectWatcher() {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
    console.log("[AgentWatcher] 에이전트 연결 감시 크론 중지");
  }
}

export function resetUserAlertState(userId: string) {
  userAlertStates.delete(userId);
}
