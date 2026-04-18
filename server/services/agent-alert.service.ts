// agent-alert.service.ts — 에이전트 연결 끊김/복구 시 외부 알림 발송
// 지원 채널: 이메일(SMTP / SendGrid / Resend), 웹훅(Slack/Discord/일반 HTTPS POST)
import nodemailer from "nodemailer";
import { promises as dns } from "dns";

// ─── 이메일 공급자 타입 ────────────────────────────────────────────────────────

export type EmailProvider = "smtp" | "sendgrid" | "resend" | "auto";

// ─── 공급자 설정 감지 ─────────────────────────────────────────────────────────

export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function isSendGridConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY;
}

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export function getEmailProviderStatuses(): {
  smtp: boolean;
  sendgrid: boolean;
  resend: boolean;
} {
  return {
    smtp: isSmtpConfigured(),
    sendgrid: isSendGridConfigured(),
    resend: isResendConfigured(),
  };
}

/** 설정된 공급자 중 우선순위에 따라 실제 사용할 공급자를 결정. */
function resolveProvider(preferred: EmailProvider = "auto"): "smtp" | "sendgrid" | "resend" | null {
  const order: Array<"sendgrid" | "resend" | "smtp"> = ["sendgrid", "resend", "smtp"];
  if (preferred !== "auto") {
    // 명시된 공급자가 실제 설정돼 있으면 그대로 사용
    if (preferred === "smtp" && isSmtpConfigured()) return "smtp";
    if (preferred === "sendgrid" && isSendGridConfigured()) return "sendgrid";
    if (preferred === "resend" && isResendConfigured()) return "resend";
    // 설정이 없으면 fallback으로 auto 진행
  }
  for (const p of order) {
    if (p === "smtp" && isSmtpConfigured()) return "smtp";
    if (p === "sendgrid" && isSendGridConfigured()) return "sendgrid";
    if (p === "resend" && isResendConfigured()) return "resend";
  }
  return null;
}

/** 발신 주소 해석 (공급자별 → 공통 → SMTP fallback) */
function resolveFrom(provider: "smtp" | "sendgrid" | "resend"): string {
  if (provider === "sendgrid") {
    return (
      process.env.SENDGRID_FROM ||
      process.env.EMAIL_FROM ||
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      "noreply@example.com"
    );
  }
  if (provider === "resend") {
    return (
      process.env.RESEND_FROM ||
      process.env.EMAIL_FROM ||
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      "onboarding@resend.dev"
    );
  }
  return process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@example.com";
}

// ─── 이메일 (SMTP) ────────────────────────────────────────────────────────────

function getSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendEmailViaSmtp(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    return { ok: false, error: "SMTP_NOT_CONFIGURED" };
  }
  const from = resolveFrom("smtp");
  try {
    await transporter.sendMail({
      from: `"트레이드봇" <${from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[AgentAlert] SMTP 이메일 발송 실패:", msg);
    return { ok: false, error: msg };
  }
}

// ─── 이메일 (SendGrid) ────────────────────────────────────────────────────────

async function sendEmailViaSendGrid(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return { ok: false, error: "SENDGRID_API_KEY_NOT_CONFIGURED" };

  const from = resolveFrom("sendgrid");
  const payload = {
    personalizations: [{ to: [{ email: options.to }] }],
    from: { email: from, name: "트레이드봇" },
    subject: options.subject,
    content: [{ type: "text/html", value: options.html }],
  };

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 202) return { ok: true };

    const body = await res.text().catch(() => "");
    const errMsg = `SendGrid HTTP ${res.status}: ${body.slice(0, 300)}`;
    console.error("[AgentAlert] SendGrid 발송 실패:", errMsg);
    return { ok: false, error: errMsg };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[AgentAlert] SendGrid 발송 실패:", msg);
    return { ok: false, error: msg };
  }
}

// ─── 이메일 (Resend) ──────────────────────────────────────────────────────────

async function sendEmailViaResend(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY_NOT_CONFIGURED" };

  const from = resolveFrom("resend");
  const payload = {
    from: `트레이드봇 <${from}>`,
    to: [options.to],
    subject: options.subject,
    html: options.html,
  };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) return { ok: true };

    const body = await res.text().catch(() => "");
    const errMsg = `Resend HTTP ${res.status}: ${body.slice(0, 300)}`;
    console.error("[AgentAlert] Resend 발송 실패:", errMsg);
    return { ok: false, error: errMsg };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[AgentAlert] Resend 발송 실패:", msg);
    return { ok: false, error: msg };
  }
}

// ─── 이메일 통합 발송 ─────────────────────────────────────────────────────────

async function sendEmail(
  options: { to: string; subject: string; html: string },
  preferredProvider: EmailProvider = "auto",
): Promise<{ ok: boolean; error?: string; provider?: string }> {
  const provider = resolveProvider(preferredProvider);

  if (!provider) {
    const msg = "[AgentAlert] 이메일 공급자 미설정 — SENDGRID_API_KEY, RESEND_API_KEY, 또는 SMTP_HOST+SMTP_USER+SMTP_PASS 확인";
    console.warn(msg);
    return { ok: false, error: "EMAIL_PROVIDER_NOT_CONFIGURED" };
  }

  let result: { ok: boolean; error?: string };
  if (provider === "sendgrid") {
    result = await sendEmailViaSendGrid(options);
  } else if (provider === "resend") {
    result = await sendEmailViaResend(options);
  } else {
    result = await sendEmailViaSmtp(options);
  }

  return { ...result, provider };
}

// ─── 웹훅 URL 검증 (SSRF 방지) ────────────────────────────────────────────────

const PRIVATE_IPV4_PATTERNS = [
  /^127\.\d+\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/,
];

const PRIVATE_IPV6_PATTERNS = [
  /^::1$/i,
  /^::$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe[89ab][0-9a-f]:/i,
  /^::ffff:(.+)$/i,
  /^64:ff9b::/i,
];

function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((p) => p.test(ip));
}

function isPrivateIpv6(ip: string): boolean {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return PRIVATE_IPV6_PATTERNS.some((p) => p.test(ip));
}

function isPrivateAddress(addr: string): boolean {
  return addr.includes(":") ? isPrivateIpv6(addr) : isPrivateIpv4(addr);
}

function normalizeHostname(raw: string): string {
  return raw.replace(/\.+$/, "").toLowerCase();
}

function isLocalhostVariant(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "ip6-localhost" ||
    hostname === "ip6-loopback"
  );
}

export function validateWebhookUrl(url: string): { valid: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "유효하지 않은 URL" };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, error: "HTTPS URL만 허용됩니다" };
  }

  const rawHostname = parsed.hostname;
  const hostname = normalizeHostname(rawHostname);

  if (isLocalhostVariant(hostname)) {
    return { valid: false, error: "내부 네트워크 주소는 허용되지 않습니다" };
  }

  if (isPrivateAddress(hostname)) {
    return { valid: false, error: "내부 네트워크 주소는 허용되지 않습니다" };
  }

  return { valid: true };
}

async function dnsCheckHost(hostname: string): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizeHostname(hostname);
  if (isLocalhostVariant(normalized)) {
    return { ok: false, error: "내부 네트워크 주소는 허용되지 않습니다" };
  }
  try {
    const results = await dns.resolve(normalized, "A").catch(() => []);
    const results6 = await dns.resolve(normalized, "AAAA").catch((): string[] => []);
    const all = [...results, ...results6];
    if (all.length === 0) {
      return { ok: false, error: "호스트명을 해석할 수 없습니다" };
    }
    for (const addr of all) {
      if (isPrivateAddress(addr)) {
        return { ok: false, error: `내부 IP(${addr})로 해석된 주소는 허용되지 않습니다` };
      }
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `DNS 조회 실패: ${msg}` };
  }
}

// ─── 웹훅 (Slack / Discord / 일반 HTTPS POST) ────────────────────────────────

async function sendWebhook(options: {
  url: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const validation = validateWebhookUrl(options.url);
  if (!validation.valid) {
    const errMsg = `웹훅 URL 검증 실패: ${validation.error}`;
    console.error("[AgentAlert]", errMsg);
    return { ok: false, error: errMsg };
  }

  let parsedHost: string;
  try {
    parsedHost = normalizeHostname(new URL(options.url).hostname);
  } catch {
    return { ok: false, error: "URL 파싱 실패" };
  }
  const dnsCheck = await dnsCheckHost(parsedHost);
  if (!dnsCheck.ok) {
    const errMsg = `웹훅 DNS 검증 실패: ${dnsCheck.error}`;
    console.error("[AgentAlert]", errMsg);
    return { ok: false, error: errMsg };
  }

  try {
    const res = await fetch(options.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: options.text }),
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
      const errMsg = `웹훅이 리다이렉트를 반환했습니다 (status: ${res.status}) — 허용되지 않음`;
      console.error("[AgentAlert] 웹훅 발송 실패:", errMsg);
      return { ok: false, error: errMsg };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const errMsg = `HTTP ${res.status}: ${body.slice(0, 200)}`;
      console.error("[AgentAlert] 웹훅 발송 실패:", errMsg);
      return { ok: false, error: errMsg };
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[AgentAlert] 웹훅 발송 실패:", msg);
    return { ok: false, error: msg };
  }
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

export async function sendAgentDisconnectAlert(options: {
  toEmail?: string;
  webhookUrl?: string;
  thresholdMinutes: number;
  lastSeenSecondsAgo: number | null;
  emailProvider?: EmailProvider;
}): Promise<{ email: { ok: boolean; error?: string } | null; webhook: { ok: boolean; error?: string } | null }> {
  const lastSeenText =
    options.lastSeenSecondsAgo === null
      ? "연결된 적 없음"
      : options.lastSeenSecondsAgo < 60
        ? `${options.lastSeenSecondsAgo}초 전`
        : `${Math.floor(options.lastSeenSecondsAgo / 60)}분 ${options.lastSeenSecondsAgo % 60}초 전`;

  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const shortMsg = `[트레이드봇] 에이전트 연결 끊김 — 마지막 연결: ${lastSeenText} | 임계값: ${options.thresholdMinutes}분 | 감지: ${now}`;

  const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:8px;">
  <h2 style="color:#dc2626;margin-bottom:8px;">에이전트 연결 끊김</h2>
  <p style="color:#555;margin-bottom:16px;">집 PC 키움 에이전트가 <strong>${options.thresholdMinutes}분 이상</strong> 응답하지 않고 있습니다.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr style="background:#fff;"><td style="padding:10px 14px;color:#888;border-bottom:1px solid #eee;width:40%;">마지막 연결</td><td style="padding:10px 14px;font-weight:600;border-bottom:1px solid #eee;">${lastSeenText}</td></tr>
    <tr style="background:#fff;"><td style="padding:10px 14px;color:#888;border-bottom:1px solid #eee;">감지 시각 (KST)</td><td style="padding:10px 14px;font-weight:600;border-bottom:1px solid #eee;">${now}</td></tr>
    <tr style="background:#fff;"><td style="padding:10px 14px;color:#888;">임계값</td><td style="padding:10px 14px;font-weight:600;">${options.thresholdMinutes}분</td></tr>
  </table>
  <p style="margin-top:20px;color:#666;font-size:13px;">집 PC가 켜져 있고 에이전트가 실행 중인지 확인하세요.<br>자동매매는 에이전트 재연결 후 정상 재개됩니다.</p>
  <p style="margin-top:8px;color:#999;font-size:12px;">이 알림은 트레이드봇 에이전트 모니터에서 자동 발송됩니다.</p>
</div>`;

  const emailResult = options.toEmail
    ? await sendEmail(
        { to: options.toEmail, subject: `[트레이드봇] 에이전트 연결 끊김 — ${now}`, html: htmlBody },
        options.emailProvider,
      )
    : null;

  if (emailResult?.ok) console.log(`[AgentAlert] 연결 끊김 이메일(${emailResult.provider}) → ${options.toEmail}`);

  const webhookResult = options.webhookUrl
    ? await sendWebhook({ url: options.webhookUrl, text: shortMsg })
    : null;

  if (webhookResult?.ok) console.log("[AgentAlert] 연결 끊김 웹훅 발송 완료");

  return { email: emailResult, webhook: webhookResult };
}

export async function sendAgentRecoveryAlert(options: {
  toEmail?: string;
  webhookUrl?: string;
  disconnectedDurationMinutes: number;
  emailProvider?: EmailProvider;
}): Promise<{ email: { ok: boolean; error?: string } | null; webhook: { ok: boolean; error?: string } | null }> {
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const shortMsg = `[트레이드봇] 에이전트 복구됨 — 단절 ${options.disconnectedDurationMinutes}분 후 재연결 | ${now}`;

  const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:8px;">
  <h2 style="color:#16a34a;margin-bottom:8px;">에이전트 복구됨</h2>
  <p style="color:#555;margin-bottom:16px;">집 PC 키움 에이전트가 다시 연결되었습니다.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr style="background:#fff;"><td style="padding:10px 14px;color:#888;border-bottom:1px solid #eee;width:40%;">복구 시각 (KST)</td><td style="padding:10px 14px;font-weight:600;border-bottom:1px solid #eee;">${now}</td></tr>
    <tr style="background:#fff;"><td style="padding:10px 14px;color:#888;">단절 지속 시간</td><td style="padding:10px 14px;font-weight:600;">약 ${options.disconnectedDurationMinutes}분</td></tr>
  </table>
  <p style="margin-top:20px;color:#666;font-size:13px;">자동매매가 정상 재개됩니다.</p>
  <p style="margin-top:8px;color:#999;font-size:12px;">이 알림은 트레이드봇 에이전트 모니터에서 자동 발송됩니다.</p>
</div>`;

  const emailResult = options.toEmail
    ? await sendEmail(
        { to: options.toEmail, subject: `[트레이드봇] 에이전트 복구됨 — ${now}`, html: htmlBody },
        options.emailProvider,
      )
    : null;

  if (emailResult?.ok) console.log(`[AgentAlert] 복구 이메일(${emailResult.provider}) → ${options.toEmail}`);

  const webhookResult = options.webhookUrl
    ? await sendWebhook({ url: options.webhookUrl, text: shortMsg })
    : null;

  if (webhookResult?.ok) console.log("[AgentAlert] 복구 웹훅 발송 완료");

  return { email: emailResult, webhook: webhookResult };
}

export async function sendTestAlert(
  toEmail?: string,
  webhookUrl?: string,
  emailProvider?: EmailProvider,
): Promise<{ email: { ok: boolean; error?: string } | null; webhook: { ok: boolean; error?: string } | null }> {
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const shortMsg = `[트레이드봇] 테스트 알림 — 에이전트 연결 끊김 알림이 정상 설정되었습니다. 발송 시각: ${now}`;

  const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:8px;">
  <h2 style="color:#2563eb;margin-bottom:8px;">테스트 알림</h2>
  <p style="color:#555;">에이전트 연결 끊김 알림이 정상적으로 설정되었습니다.</p>
  <p style="color:#888;font-size:13px;">발송 시각: ${now}</p>
  <p style="margin-top:16px;color:#999;font-size:12px;">이 알림은 트레이드봇 에이전트 모니터에서 자동 발송됩니다.</p>
</div>`;

  const emailResult = toEmail
    ? await sendEmail({ to: toEmail, subject: "[트레이드봇] 테스트 알림 — 설정 확인", html: htmlBody }, emailProvider)
    : null;

  const webhookResult = webhookUrl
    ? await sendWebhook({ url: webhookUrl, text: shortMsg })
    : null;

  return { email: emailResult, webhook: webhookResult };
}
