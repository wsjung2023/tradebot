// billing.routes.ts — 구독/플랜 관리 라우터 (Phase 1 Paddle 연동)
import type { Express } from 'express';
import { storage } from '../storage';
import { isAuthenticated, getCurrentUser } from '../auth';
import { isPublicSaaS, config } from '../config';
import { handlePaddleWebhook, buildCheckoutUrl } from '../services/paddle.service';

// AUM(운용자산) 합계 → 티어 문자열
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

      // public_saas가 아니면 항상 free/active 반환 (on_prem, private_cloud)
      if (!isPublicSaaS) {
        return res.json({
          tier: 'free',
          status: 'active',
          currentPeriodEnd: null,
          isPaidPlan: false,
        });
      }

      // public_saas: 구독 없으면 free로 자동 생성
      if (!subscription) {
        subscription = await storage.upsertSubscription({ userId: user.id, tier: 'free', status: 'active' });
      }

      // AUM 티어 계산 및 변경 시 업데이트
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
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Paddle Checkout URL 생성
  app.post('/api/billing/checkout', isAuthenticated, async (req, res) => {
    if (!isPublicSaaS) return res.status(400).json({ error: 'Billing not available in this deployment tier' });
    if (!config.PADDLE_API_KEY) return res.status(503).json({ error: 'Billing not configured' });
    try {
      const user = getCurrentUser(req)!;
      const { planId } = req.body;
      if (!planId) return res.status(400).json({ error: 'planId required' });
      const url = buildCheckoutUrl(user.id, planId);
      res.json({ checkoutUrl: url });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Paddle Webhook 수신 (서명 검증 필수)
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
