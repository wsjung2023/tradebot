// paddle.service.ts — Paddle Billing v2 연동
import crypto from 'crypto';
import { storage } from '../storage';
import { config } from '../config';

const PADDLE_API_BASE = 'https://api.paddle.com';

export type PaddleEventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.cancelled'
  | 'subscription.activated'
  | 'subscription.past_due'
  | 'subscription.paused'
  | 'subscription.resumed';

interface PaddleWebhookEvent {
  event_type: PaddleEventType;
  data: {
    id: string;                         // paddle subscription id
    status: string;
    customer_id: string;
    current_billing_period?: { ends_at?: string };
    items?: Array<{ price: { id: string } }>;
    custom_data?: { user_id?: string };
  };
}

function getPriceId(planId: string): string {
  const map: Record<string, string | undefined> = {
    saas_basic:      process.env.PADDLE_PRICE_BASIC,
    saas_pro:        process.env.PADDLE_PRICE_PRO,
    saas_enterprise: process.env.PADDLE_PRICE_ENTERPRISE,
  };
  const priceId = map[planId];
  if (!priceId) throw new Error(`Unknown plan or price not configured: ${planId}`);
  return priceId;
}

function priceIdToTier(priceId: string | undefined): string {
  const map: Record<string, string> = {
    [process.env.PADDLE_PRICE_BASIC ?? '']:      'saas_basic',
    [process.env.PADDLE_PRICE_PRO ?? '']:        'saas_pro',
    [process.env.PADDLE_PRICE_ENTERPRISE ?? '']: 'saas_enterprise',
  };
  return map[priceId ?? ''] ?? 'free';
}

function mapPaddleStatus(paddleStatus: string): string {
  const map: Record<string, string> = {
    active:   'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'cancelled',
    paused:   'cancelled',
  };
  return map[paddleStatus] ?? 'active';
}

// Paddle API 호출 헬퍼
async function paddleApi(method: string, path: string, body?: unknown) {
  if (!config.PADDLE_API_KEY) throw new Error('PADDLE_API_KEY not configured');
  const res = await fetch(`${PADDLE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json() as { data?: unknown; error?: { type: string; detail: string } };
  if (!res.ok) throw new Error(data.error?.detail ?? `Paddle API error ${res.status}`);
  return data.data;
}

// 웹훅 서명 검증 + DB 업데이트
export async function handlePaddleWebhook(rawBody: Buffer, signatureHeader: string): Promise<void> {
  if (!config.PADDLE_WEBHOOK_SECRET) throw new Error('PADDLE_WEBHOOK_SECRET not configured');

  // Format: "ts=<timestamp>;h1=<hmac-sha256>"
  const parts = Object.fromEntries(
    signatureHeader.split(';').map(p => p.split('=') as [string, string])
  );
  const expected = crypto
    .createHmac('sha256', config.PADDLE_WEBHOOK_SECRET)
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

// 결제 체크아웃 트랜잭션 생성 → transactionId 반환 (Paddle.js overlay에서 사용)
export async function createCheckoutTransaction(userId: string, userEmail: string, planId: string): Promise<string> {
  const priceId = getPriceId(planId);
  const txn = await paddleApi('POST', '/transactions', {
    items: [{ price_id: priceId, quantity: 1 }],
    customer: { email: userEmail },
    custom_data: { user_id: userId },
  }) as { id: string };
  return txn.id;
}

// 구독 취소 (다음 결제 기간 종료 시 적용)
export async function cancelSubscription(paddleSubscriptionId: string): Promise<void> {
  await paddleApi('PATCH', `/subscriptions/${paddleSubscriptionId}`, {
    scheduled_change: { action: 'cancel', effective_at: 'next_billing_period' },
  });
}
