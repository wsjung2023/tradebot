// agent-alert.service.ts — 에이전트 연결 끊김/복구 시 외부 알림 발송
// 지원 채널: 이메일(SMTP), 웹훅(Slack/Discord/일반 HTTPS POST)
import nodemailer from "nodemailer";
import { promises as dns } from "dns";

// ─── 이메일 (SMTP) ────────────────────────────────────────────────────────────

function getSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    const msg = "[AgentAlert] SMTP 미설정 — 이메일 알림 불가 (SMTP_HOST, SMTP_USER, SMTP_PASS 확인)";
    console.warn(msg);
    return { ok: false, error: "SMTP_NOT_CONFIGURED" };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
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
    console.error("[AgentAlert] 이메일 발송 실패:", msg);
    return { ok: false, error: msg };
  }
}

// ─── 웹훅 URL 검증 (SSRF 방지) ────────────────────────────────────────────────

// 로컬/사설 IPv4 패턴 (trailing dot 제거 후 비교)
const PRIVATE_IPV4_PATTERNS = [
  /^127\.\d+\.\d+\.\d+$/,            // 루프백
  /^0\.0\.0\.0$/,                     // 미지정
  /^10\.\d+\.\d+\.\d+$/,             // 사설 A
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,  // 사설 B
  /^192\.168\.\d+\.\d+$/,            // 사설 C
  /^169\.254\.\d+\.\d+$/,            // link-local
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/,  // CGNAT (RFC 6598)
];

// 사설/특수 IPv6 패턴
const PRIVATE_IPV6_PATTERNS = [
  /^::1$/i,                           // 루프백
  /^::$/,                             // 미지정
  /^fc[0-9a-f]{2}:/i,                // ULA
  /^fd[0-9a-f]{2}:/i,                // ULA
  /^fe[89ab][0-9a-f]:/i,             // link-local
  /^::ffff:(.+)$/i,                   // IPv4-mapped (별도 처리)
  /^64:ff9b::/i,                      // NAT64
];

function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((p) => p.test(ip));
}

function isPrivateIpv6(ip: string): boolean {
  // IPv4-mapped IPv6: ::ffff:127.0.0.1 등
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return PRIVATE_IPV6_PATTERNS.some((p) => p.test(ip));
}

function isPrivateAddress(addr: string): boolean {
  return addr.includes(":") ? isPrivateIpv6(addr) : isPrivateIpv4(addr);
}

/** 호스트명을 정규화 (trailing dot 제거, 소문자). */
function normalizeHostname(raw: string): string {
  return raw.replace(/\.+$/, "").toLowerCase();
}

/** localhost 변형(subdomain, trailing dots 등) 차단. */
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

  // IPv6 literal: URL.hostname에는 이미 괄호 없이 들어옴
  const rawHostname = parsed.hostname;
  const hostname = normalizeHostname(rawHostname);

  if (isLocalhostVariant(hostname)) {
    return { valid: false, error: "내부 네트워크 주소는 허용되지 않습니다" };
  }

  // hostname이 IP literal인 경우 직접 검사
  if (isPrivateAddress(hostname)) {
    return { valid: false, error: "내부 네트워크 주소는 허용되지 않습니다" };
  }

  return { valid: true };
}

/**
 * DNS를 실제로 해석해 사설/루프백 IP로 resolve되면 차단.
 * redirect 대응을 위해 sendWebhook 직전에도 호출.
 */
async function dnsCheckHost(hostname: string): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizeHostname(hostname);
  if (isLocalhostVariant(normalized)) {
    return { ok: false, error: "내부 네트워크 주소는 허용되지 않습니다" };
  }
  try {
    const results = await dns.resolve(normalized, "A").catch(() => []);
    const results6 = await dns.resolve(normalized, "AAAA").catch((): string[] => []);
    const all = [...results, ...results6];
    // 결과가 없으면 resolve 실패 — 허용하지 않음
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
  // 1차: URL 파싱 레벨 검증
  const validation = validateWebhookUrl(options.url);
  if (!validation.valid) {
    const errMsg = `웹훅 URL 검증 실패: ${validation.error}`;
    console.error("[AgentAlert]", errMsg);
    return { ok: false, error: errMsg };
  }

  // 2차: DNS 해석 후 실제 IP 검증 (DNS 리바인딩 / 내부망 alias 차단)
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
      redirect: "manual",   // 리다이렉트 따라가지 않음 (SSRF 리다이렉트 체인 차단)
    });
    // manual redirect → opaqueredirect type (status 0) 또는 3xx 차단
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
}): Promise<{ email: { ok: boolean; error?: string } | null; webhook: { ok: boolean; error?: string } | null }> {
  const lastSeenText =
    options.lastSeenSecondsAgo === null
      ? "연결된 적 없음"
      : options.lastSeenSecondsAgo < 60
        ? `${options.lastSeenSecondsAgo}초 전`
        : `${Math.floor(options.lastSeenSecondsAgo / 60)}분 ${options.lastSeenSecondsAgo % 60}초 전`;

  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const shortMsg = `[트레이드봇] ⚠️ 에이전트 연결 끊김 — 마지막 연결: ${lastSeenText} | 임계값: ${options.thresholdMinutes}분 | 감지: ${now}`;

  const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:8px;">
  <h2 style="color:#dc2626;margin-bottom:8px;">⚠️ 에이전트 연결 끊김</h2>
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
    ? await sendEmail({ to: options.toEmail, subject: `[트레이드봇] 에이전트 연결 끊김 — ${now}`, html: htmlBody })
    : null;

  if (emailResult?.ok) console.log(`[AgentAlert] 연결 끊김 이메일 → ${options.toEmail}`);

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
}): Promise<{ email: { ok: boolean; error?: string } | null; webhook: { ok: boolean; error?: string } | null }> {
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const shortMsg = `[트레이드봇] ✅ 에이전트 복구됨 — 단절 ${options.disconnectedDurationMinutes}분 후 재연결 | ${now}`;

  const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:8px;">
  <h2 style="color:#16a34a;margin-bottom:8px;">✅ 에이전트 복구됨</h2>
  <p style="color:#555;margin-bottom:16px;">집 PC 키움 에이전트가 다시 연결되었습니다.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr style="background:#fff;"><td style="padding:10px 14px;color:#888;border-bottom:1px solid #eee;width:40%;">복구 시각 (KST)</td><td style="padding:10px 14px;font-weight:600;border-bottom:1px solid #eee;">${now}</td></tr>
    <tr style="background:#fff;"><td style="padding:10px 14px;color:#888;">단절 지속 시간</td><td style="padding:10px 14px;font-weight:600;">약 ${options.disconnectedDurationMinutes}분</td></tr>
  </table>
  <p style="margin-top:20px;color:#666;font-size:13px;">자동매매가 정상 재개됩니다.</p>
  <p style="margin-top:8px;color:#999;font-size:12px;">이 알림은 트레이드봇 에이전트 모니터에서 자동 발송됩니다.</p>
</div>`;

  const emailResult = options.toEmail
    ? await sendEmail({ to: options.toEmail, subject: `[트레이드봇] 에이전트 복구됨 — ${now}`, html: htmlBody })
    : null;

  if (emailResult?.ok) console.log(`[AgentAlert] 복구 이메일 → ${options.toEmail}`);

  const webhookResult = options.webhookUrl
    ? await sendWebhook({ url: options.webhookUrl, text: shortMsg })
    : null;

  if (webhookResult?.ok) console.log("[AgentAlert] 복구 웹훅 발송 완료");

  return { email: emailResult, webhook: webhookResult };
}

export async function sendTestAlert(
  toEmail?: string,
  webhookUrl?: string,
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
    ? await sendEmail({ to: toEmail, subject: "[트레이드봇] 테스트 알림 — 설정 확인", html: htmlBody })
    : null;

  const webhookResult = webhookUrl
    ? await sendWebhook({ url: webhookUrl, text: shortMsg })
    : null;

  return { email: emailResult, webhook: webhookResult };
}
