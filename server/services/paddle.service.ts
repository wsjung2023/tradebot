// paddle.service.ts — Paddle Classic 연동
import crypto from 'crypto';
import { storage } from '../storage';

const SANDBOX = process.env.PADDLE_SANDBOX === 'true';
const PADDLE_VENDORS_API = SANDBOX
  ? 'https://sandbox-vendors.paddle.com/api/2.0'
  : 'https://vendors.paddle.com/api/2.0';

// Paddle Classic 웹훅 alert_name → 우리 상태 매핑
const ALERT_MAP: Record<string, 'created' | 'updated' | 'cancelled' | 'ignore'> = {
  subscription_created:           'created',
  subscription_updated:           'updated',
  subscription_cancelled:         'cancelled',
  subscription_payment_succeeded: 'updated',
  subscription_payment_failed:    'updated',
};

// Paddle Classic 구독 status 매핑
function mapStatus(s: string): string {
  const m: Record<string, string> = {
    active:   'active',
    trialing: 'trialing',
    past_due: 'past_due',
    paused:   'cancelled',
    deleted:  'cancelled',
  };
  return m[s] ?? 'active';
}

// Plan ID → tier
function planIdToTier(planId: string | undefined): string {
  const map: Record<string, string> = {
    [process.env.PADDLE_PLAN_BASIC ?? '']:      'saas_basic',
    [process.env.PADDLE_PLAN_PRO ?? '']:        'saas_pro',
    [process.env.PADDLE_PLAN_ENTERPRISE ?? '']: 'saas_enterprise',
  };
  return map[planId ?? ''] ?? 'free';
}

// PHP serialize (Paddle Classic 서명 검증용)
// Paddle이 요구하는 형식: a:N:{s:K_LEN:"KEY";s:V_LEN:"VAL";...}
function phpSerializeArray(obj: Record<string, string>): string {
  const keys = Object.keys(obj).sort();
  const inner = keys
    .map(k => {
      const v = String(obj[k]);
      return `s:${Buffer.byteLength(k)}:"${k}";s:${Buffer.byteLength(v)}:"${v}";`;
    })
    .join('');
  return `a:${keys.length}:{${inner}}`;
}

// Paddle Classic 웹훅 서명 검증 (RSA-SHA1)
export function verifyPaddleClassicSignature(
  body: Record<string, string>,
  publicKey: string
): boolean {
  const { p_signature, ...rest } = body;
  if (!p_signature) return false;
  const serialized = phpSerializeArray(rest);
  try {
    const verify = crypto.createVerify('SHA1');
    verify.update(serialized);
    return verify.verify(publicKey, p_signature, 'base64');
  } catch {
    return false;
  }
}

// 웹훅 처리 (req.body — express.urlencoded로 파싱된 값)
export async function handlePaddleWebhook(body: Record<string, string>): Promise<void> {
  const publicKey = process.env.PADDLE_PUBLIC_KEY;
  if (!publicKey) throw new Error('PADDLE_PUBLIC_KEY not configured');

  if (!verifyPaddleClassicSignature(body, publicKey)) {
    throw new Error('Invalid Paddle webhook signature');
  }

  const alertType = ALERT_MAP[body.alert_name];
  if (!alertType || alertType === 'ignore') return;

  // passthrough에 user_id를 JSON으로 담음
  let userId: string | undefined;
  try {
    const passthrough = JSON.parse(body.passthrough ?? '{}');
    userId = passthrough.user_id;
  } catch { /* ignore */ }
  if (!userId) return;

  const subscriptionId = body.subscription_id;
  const planId = body.subscription_plan_id;
  const tier = planIdToTier(planId);
  const status = mapStatus(body.status ?? 'active');
  const nextBillDate = body.next_bill_date
    ? new Date(body.next_bill_date)
    : undefined;

  await storage.upsertSubscription({
    userId,
    paddleSubscriptionId: subscriptionId,
    paddleCustomerId: body.user_id ?? body.email,
    tier: alertType === 'cancelled' ? 'free' : tier,
    status,
    currentPeriodEnd: nextBillDate ?? null,
  });
}

// Paddle Classic 구독 취소 API
export async function cancelSubscription(paddleSubscriptionId: string): Promise<void> {
  const vendorId = process.env.PADDLE_VENDOR_ID;
  const authCode = process.env.PADDLE_VENDOR_AUTH_CODE;
  if (!vendorId || !authCode) throw new Error('PADDLE_VENDOR_ID / PADDLE_VENDOR_AUTH_CODE not configured');

  const body = new URLSearchParams({
    vendor_id: vendorId,
    vendor_auth_code: authCode,
    subscription_id: paddleSubscriptionId,
  });

  const res = await fetch(`${PADDLE_VENDORS_API}/subscription/users_cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json() as { success: boolean; error?: { message: string } };
  if (!data.success) throw new Error(data.error?.message ?? 'Paddle cancel failed');
}

// 클라이언트에 전달할 플랜별 Paddle Plan ID 조회
export function getPlanId(planId: string): string {
  const map: Record<string, string | undefined> = {
    saas_basic:      process.env.PADDLE_PLAN_BASIC,
    saas_pro:        process.env.PADDLE_PLAN_PRO,
    saas_enterprise: process.env.PADDLE_PLAN_ENTERPRISE,
  };
  const pid = map[planId];
  if (!pid) throw new Error(`Unknown plan or PADDLE_PLAN_* not configured: ${planId}`);
  return pid;
}
