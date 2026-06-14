// billing.routes.ts — 구독/플랜 관리 라우터 (Paddle Billing v2)
import type { Express } from 'express';
import { storage } from '../storage';
import { isAuthenticated, getCurrentUser } from '../auth';
import { isPublicSaaS } from '../config';
import { handlePaddleWebhook, createCheckoutTransaction, cancelSubscription, getPaddleClientConfig, syncSubscriptionFromTransaction } from '../services/paddle.service';

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
  // Paddle.js v2 초기화 정보 (현재 모드에 맞는 토큰 자동 선택)
  app.get('/api/billing/config', (_req, res) => {
    if (!isPublicSaaS) return res.json({ enabled: false });
    res.json({ enabled: true, ...getPaddleClientConfig() });
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

  // Paddle v2 트랜잭션 생성 → transactionId (Paddle.js overlay용)
  app.post('/api/billing/checkout', isAuthenticated, async (req, res) => {
    if (!isPublicSaaS) return res.status(400).json({ error: 'Billing not available in this deployment tier' });
    if (!process.env[`PADDLE_${process.env.PADDLE_SANDBOX === 'true' ? 'SDBX' : 'LIVE'}_API_KEY`]) return res.status(503).json({ error: 'Billing not configured' });
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

  // 구독 정보 Paddle에서 재동기화 (txn_ ID로 잘못 저장된 경우 복구)
  app.post('/api/billing/sync', isAuthenticated, async (req, res) => {
    if (!isPublicSaaS) return res.status(400).json({ error: 'Not applicable' });
    try {
      const user = getCurrentUser(req)!;
      const sub = await storage.getUserSubscription(user.id);
      if (!sub) return res.status(404).json({ error: '구독 정보 없음' });

      const paddleSubId = sub.paddleSubscriptionId;
      if (!paddleSubId) return res.status(400).json({ error: 'Paddle 구독 ID 없음' });

      // txn_ 으로 시작하면 transaction ID → subscription ID 변환
      if (paddleSubId.startsWith('txn_')) {
        const synced = await syncSubscriptionFromTransaction(paddleSubId);
        if (!synced) return res.status(404).json({ error: 'Paddle에서 구독 정보를 찾을 수 없음' });
        await storage.upsertSubscription({
          userId: user.id,
          paddleSubscriptionId: synced.paddleSubscriptionId ?? undefined,
          paddleCustomerId: synced.paddleCustomerId ?? undefined,
          tier: synced.tier,
          status: synced.status,
          currentPeriodEnd: synced.currentPeriodEnd,
        });
        return res.json({ ok: true, synced });
      }

      return res.json({ ok: true, message: '이미 올바른 구독 ID' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Paddle v2 Webhook (JSON, rawBody로 서명 검증)
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
