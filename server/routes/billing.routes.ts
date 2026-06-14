// billing.routes.ts — 구독/플랜 관리 라우터 (Phase 1 Paddle 연동)
import type { Express } from 'express';
import { storage } from '../storage';
import { isAuthenticated, getCurrentUser } from '../auth';
import { isPublicSaaS, config } from '../config';
import { handlePaddleWebhook, createCheckoutTransaction, cancelSubscription } from '../services/paddle.service';

function calcAumTier(totalKrw: number): string {
  if (totalKrw >= 100_000_000) return 'over_100m';
  if (totalKrw >= 50_000_000)  return 'under_100m';
  if (totalKrw >= 20_000_000)  return 'under_50m';
  return 'under_20m';
}

async function refreshAumTier(userId: string): Promise<string> {
  const accounts = await storage.getKiwoomAccounts(userId);
  const totalKrw = accounts.reduce((sum, a) => sum + parseFloat(a.lastTotalAssets ?? '0'), 0);
  return calcAumTier(totalKrw);
}

export function registerBillingRoutes(app: Express) {
  // Paddle.js 초기화용 클라이언트 토큰 노출 (공개, 읽기 전용)
  app.get('/api/billing/config', (_req, res) => {
    if (!isPublicSaaS) return res.json({ enabled: false });
    res.json({
      enabled: true,
      clientToken: config.PADDLE_CLIENT_TOKEN ?? null,
    });
  });

  // 플랜 목록 조회 (공개)
  app.get('/api/billing/plans', async (_req, res) => {
    try {
      const plans = await storage.getPlans();
      res.json(plans);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 현재 구독 상태 조회
  app.get('/api/billing/subscription', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      let subscription = await storage.getUserSubscription(user.id);

      if (!isPublicSaaS) {
        return res.json({ tier: 'free', status: 'active', currentPeriodEnd: null, isPaidPlan: false });
      }

      if (!subscription) {
        subscription = await storage.upsertSubscription({ userId: user.id, tier: 'free', status: 'active' });
      }

      const newAumTier = await refreshAumTier(user.id);
      if (newAumTier !== subscription.aumTier) {
        subscription = await storage.upsertSubscription({ userId: user.id, aumTier: newAumTier });
      }

      res.json({
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        aumTier: subscription.aumTier,
        isPaidPlan: subscription.tier !== 'free',
        paddleSubscriptionId: subscription.paddleSubscriptionId ?? null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Paddle 체크아웃 트랜잭션 생성 → transactionId 반환 (Paddle.js overlay용)
  app.post('/api/billing/checkout', isAuthenticated, async (req, res) => {
    if (!isPublicSaaS) return res.status(400).json({ error: 'Billing not available in this deployment tier' });
    if (!config.PADDLE_API_KEY) return res.status(503).json({ error: 'Billing not configured' });
    try {
      const user = getCurrentUser(req)!;
      const { planId } = req.body;
      if (!planId) return res.status(400).json({ error: 'planId required' });

      const dbUser = await storage.getUser(user.id);
      const userEmail = dbUser?.email ?? '';

      const transactionId = await createCheckoutTransaction(user.id, userEmail, planId);
      res.json({ transactionId });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // 구독 취소 (다음 결제 기간 종료 시 적용)
  app.post('/api/billing/subscription/cancel', isAuthenticated, async (req, res) => {
    if (!isPublicSaaS) return res.status(400).json({ error: 'Not applicable' });
    try {
      const user = getCurrentUser(req)!;
      const sub = await storage.getUserSubscription(user.id);
      if (!sub?.paddleSubscriptionId) {
        return res.status(400).json({ error: '활성 구독이 없습니다.' });
      }
      await cancelSubscription(sub.paddleSubscriptionId);
      res.json({ ok: true, message: '다음 결제 기간 종료 시 구독이 해지됩니다.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Paddle Webhook 수신
  app.post('/api/billing/webhook', async (req, res) => {
    const signature = req.headers['paddle-signature'] as string;
    if (!signature) return res.status(400).json({ error: 'Missing signature' });
    try {
      const rawBody = (req as any).rawBody as Buffer;
      await handlePaddleWebhook(rawBody, signature);
      res.json({ ok: true });
    } catch (error: any) {
      console.error('[Billing] Paddle webhook error:', error.message);
      res.status(400).json({ error: error.message });
    }
  });
}
