// paddle.service.ts — Paddle Billing 연동 (Phase 1-3)
// Paddle API docs: https://developer.paddle.com/

import crypto from 'crypto';
import { storage } from '../storage';
import { config } from '../config';

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

// Map Paddle price ID → tier
function priceIdToTier(priceId: string | undefined): string {
  const map: Record<string, string> = {
    [process.env.PADDLE_PRICE_BASIC ?? '']: 'saas_basic',
    [process.env.PADDLE_PRICE_PRO ?? '']: 'saas_pro',
    [process.env.PADDLE_PRICE_ENTERPRISE ?? '']: 'saas_enterprise',
  };
  return map[priceId ?? ''] ?? 'free';
}

// Map Paddle subscription status → our status
function mapPaddleStatus(paddleStatus: string): string {
  const map: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'cancelled',
    paused: 'cancelled',
  };
  return map[paddleStatus] ?? 'active';
}

export async function handlePaddleWebhook(rawBody: Buffer, signatureHeader: string): Promise<void> {
  if (!config.PADDLE_WEBHOOK_SECRET) {
    throw new Error('PADDLE_WEBHOOK_SECRET not configured');
  }

  // Verify webhook signature (Paddle v2)
  // Format: "ts=<timestamp>;h1=<hmac-sha256>"
  const parts = Object.fromEntries(
    signatureHeader.split(';').map(p => p.split('=') as [string, string])
  );
  const ts = parts['ts'];
  const h1 = parts['h1'];
  const expected = crypto
    .createHmac('sha256', config.PADDLE_WEBHOOK_SECRET)
    .update(`${ts}:${rawBody.toString('utf8')}`)
    .digest('hex');

  if (expected !== h1) {
    throw new Error('Invalid Paddle webhook signature');
  }

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

export function buildCheckoutUrl(userId: string, planId: string): string {
  const priceMap: Record<string, string> = {
    saas_basic: process.env.PADDLE_PRICE_BASIC ?? '',
    saas_pro: process.env.PADDLE_PRICE_PRO ?? '',
    saas_enterprise: process.env.PADDLE_PRICE_ENTERPRISE ?? '',
  };
  const priceId = priceMap[planId];
  if (!priceId) throw new Error(`Unknown plan: ${planId}`);

  const params = new URLSearchParams({
    items: JSON.stringify([{ priceId, quantity: 1 }]),
    customData: JSON.stringify({ user_id: userId }),
  });
  return `https://checkout.paddle.com/checkout/custom-checkout?${params}`;
}
