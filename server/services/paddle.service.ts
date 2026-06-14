// paddle.service.ts — Paddle Billing v2 연동
// PADDLE_SANDBOX=true → SDBX_ 세트 / false → LIVE_ 세트 자동 선택
import crypto from 'crypto';
import { storage } from '../storage';

const SANDBOX = process.env.PADDLE_SANDBOX === 'true';
const PADDLE_API_BASE = SANDBOX ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com';

// 현재 모드에 맞는 변수 자동 선택
function paddleEnv() {
  const p = SANDBOX ? 'PADDLE_SDBX_' : 'PADDLE_LIVE_';
  return {
    apiKey:          process.env[`${p}API_KEY`],
    clientToken:     process.env[`${p}CLIENT_TOKEN`],
    webhookSecret:   process.env[`${p}WEBHOOK_SECRET`],
    priceBasic:      process.env[`${p}PRICE_BASIC`],
    pricePro:        process.env[`${p}PRICE_PRO`],
    priceEnterprise: process.env[`${p}PRICE_ENTERPRISE`],
  };
}

interface PaddleWebhookEvent {
  event_type: string;
  data: {
    id: string;
    status: string;
    customer_id: string;
    current_billing_period?: { ends_at?: string };
    items?: Array<{ price: { id: string } }>;
    custom_data?: { user_id?: string };
  };
}

function priceIdToTier(priceId: string | undefined): string {
  const env = paddleEnv();
  const map: Record<string, string> = {
    [env.priceBasic ?? '']:      'saas_basic',
    [env.pricePro ?? '']:        'saas_pro',
    [env.priceEnterprise ?? '']: 'saas_enterprise',
  };
  return map[priceId ?? ''] ?? 'free';
}

function mapPaddleStatus(s: string): string {
  const map: Record<string, string> = {
    active:   'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'cancelled',
    paused:   'cancelled',
  };
  return map[s] ?? 'active';
}

async function paddleApi(method: string, path: string, body?: unknown) {
  const { apiKey } = paddleEnv();
  if (!apiKey) throw new Error(`PADDLE_${SANDBOX ? 'SDBX' : 'LIVE'}_API_KEY not configured`);
  const res = await fetch(`${PADDLE_API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json() as { data?: unknown; error?: { detail: string } };
  if (!res.ok) throw new Error(data.error?.detail ?? `Paddle API error ${res.status}`);
  return data.data;
}

// 웹훅 서명 검증 (HMAC-SHA256) + DB 업데이트
export async function handlePaddleWebhook(rawBody: Buffer, signatureHeader: string): Promise<void> {
  const { webhookSecret } = paddleEnv();
  if (!webhookSecret) throw new Error(`PADDLE_${SANDBOX ? 'SDBX' : 'LIVE'}_WEBHOOK_SECRET not configured`);

  const parts = Object.fromEntries(
    signatureHeader.split(';').map(p => p.split('=') as [string, string])
  );
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${parts['ts']}:${rawBody.toString('utf8')}`)
    .digest('hex');

  if (expected !== parts['h1']) throw new Error('Invalid Paddle webhook signature');

  const event: PaddleWebhookEvent = JSON.parse(rawBody.toString('utf8'));
  const userId = event.data.custom_data?.user_id;
  if (!userId) return;

  const priceId = event.data.items?.[0]?.price?.id;
  const tier = priceIdToTier(priceId);
  const status = mapPaddleStatus(event.data.status);
  const currentPeriodEnd = event.data.current_billing_period?.ends_at
    ? new Date(event.data.current_billing_period.ends_at)
    : undefined;

  await storage.upsertSubscription({
    userId,
    paddleSubscriptionId: event.data.id,
    paddleCustomerId: event.data.customer_id,
    tier: event.event_type === 'subscription.cancelled' ? 'free' : tier,
    status,
    currentPeriodEnd: currentPeriodEnd ?? null,
  });
}

// 결제 트랜잭션 생성 → transactionId (Paddle.js overlay용)
export async function createCheckoutTransaction(userId: string, userEmail: string, planId: string): Promise<string> {
  const env = paddleEnv();
  const priceMap: Record<string, string | undefined> = {
    saas_basic:      env.priceBasic,
    saas_pro:        env.pricePro,
    saas_enterprise: env.priceEnterprise,
  };
  const priceId = priceMap[planId];
  if (!priceId) throw new Error(`Unknown plan or price not configured: ${planId}`);

  const txn = await paddleApi('POST', '/transactions', {
    items: [{ price_id: priceId, quantity: 1 }],
    customer: { email: userEmail },
    custom_data: { user_id: userId },
  }) as { id: string };
  return txn.id;
}

// 구독 취소
export async function cancelSubscription(paddleSubscriptionId: string): Promise<void> {
  await paddleApi('PATCH', `/subscriptions/${paddleSubscriptionId}`, {
    scheduled_change: { action: 'cancel', effective_at: 'next_billing_period' },
  });
}

// 프론트엔드에 전달할 Paddle 설정
export function getPaddleClientConfig() {
  const { clientToken } = paddleEnv();
  return { clientToken: clientToken ?? null, sandbox: SANDBOX };
}
