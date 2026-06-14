// billing.routes.ts — 구독/플랜 관리 라우터 (Paddle Classic)
import type { Express } from 'express';
import { storage } from '../storage';
import { isAuthenticated, getCurrentUser } from '../auth';
import { isPublicSaaS } from '../config';
import { handlePaddleWebhook, cancelSubscription, getPlanId } from '../services/paddle.service';

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
  // Paddle.js Classic 초기화 정보 (Vendor ID + sandbox 여부)
  app.get('/api/billing/config', (_req, res) => {
    if (!isPublicSaaS) return res.json({ enabled: false });
    res.json({
      enabled: true,
      vendorId: process.env.PADDLE_VENDOR_ID ?? null,
      sandbox: process.env.PADDLE_SANDBOX === 'true',
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

  // Paddle Classic Plan ID 조회 (클라이언트 Paddle.Checkout.open 호출용)
  app.post('/api/billing/checkout', isAuthenticated, async (req, res) => {
    if (!isPublicSaaS) return res.status(400).json({ error: 'Billing not available in this deployment tier' });
    if (!process.env.PADDLE_VENDOR_ID) return res.status(503).json({ error: 'Billing not configured' });
    try {
      const { planId } = req.body;
      if (!planId) return res.status(400).json({ error: 'planId required' });
      const paddlePlanId = getPlanId(planId);
      res.json({ paddlePlanId });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // 구독 취소
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

  // Paddle Classic Webhook (application/x-www-form-urlencoded)
  // express.urlencoded가 req.body로 파싱해줌
  app.post('/api/billing/webhook', async (req, res) => {
    try {
      await handlePaddleWebhook(req.body as Record<string, string>);
      res.json({ ok: true });
    } catch (error: any) {
      console.error('[Billing] Paddle webhook error:', error.message);
      res.status(400).json({ error: error.message });
    }
  });
}
