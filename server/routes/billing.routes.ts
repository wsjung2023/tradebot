// billing.routes.ts — 구독/플랜 관리 라우터 (Phase 1 Paddle 연동 준비)
import type { Express } from 'express';
import { storage } from '../storage';
import { isAuthenticated, getCurrentUser } from '../auth';
import { isPublicSaaS } from '../config';

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
}
