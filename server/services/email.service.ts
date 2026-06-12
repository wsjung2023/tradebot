import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.EMAIL_FROM || 'TradeBot <onboarding@resend.dev>';

export async function sendVerificationEmail(to: string, token: string, baseUrl: string): Promise<void> {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set — skipping verification email');
    return;
  }
  const link = `${baseUrl}/api/auth/verify-email?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: '[TradeBot] 이메일 인증을 완료해주세요',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#1e293b">이메일 인증</h2>
        <p style="color:#475569">아래 버튼을 클릭해서 이메일 인증을 완료해주세요.</p>
        <p style="color:#475569">링크는 <strong>24시간</strong> 동안 유효합니다.</p>
        <a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#0ea5e9;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">이메일 인증하기</a>
        <p style="color:#94a3b8;font-size:12px">버튼이 작동하지 않으면 아래 URL을 복사하세요:<br>${link}</p>
      </div>
    `,
  });
}
