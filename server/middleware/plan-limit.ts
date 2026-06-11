// plan-limit.ts — public_saas 플랜 한도 체크 미들웨어
// on_prem / private_cloud는 항상 통과
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { isPublicSaaS } from '../config';

const PLAN_LIMITS: Record<string, { maxModels: number; maxAiCallsPerDay: number }> = {
  free:            { maxModels: 2, maxAiCallsPerDay: 10 },
  saas_basic:      { maxModels: 2, maxAiCallsPerDay: 50 },
  saas_pro:        { maxModels: 5, maxAiCallsPerDay: 200 },
  saas_enterprise: { maxModels: 20, maxAiCallsPerDay: 1000 },
};

export function requirePlan(minTier: 'saas_basic' | 'saas_pro' | 'saas_enterprise') {
  const tierRank = { free: 0, saas_basic: 1, saas_pro: 2, saas_enterprise: 3 };
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isPublicSaaS) return next();
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const sub = await storage.getUserSubscription(user.id);
    const tier = sub?.tier ?? 'free';
    if ((tierRank[tier as keyof typeof tierRank] ?? 0) < tierRank[minTier]) {
      return res.status(402).json({ error: `This feature requires ${minTier} plan or higher`, upgradeRequired: true, minTier });
    }
    next();
  };
}

export async function checkModelLimit(userId: string): Promise<{ allowed: boolean; tier: string; limit: number; current: number }> {
  if (!isPublicSaaS) return { allowed: true, tier: 'free', limit: 999, current: 0 };
  const sub = await storage.getUserSubscription(userId);
  const tier = sub?.tier ?? 'free';
  const limit = PLAN_LIMITS[tier]?.maxModels ?? 2;
  const models = await storage.getAiModels(userId);
  return { allowed: models.length < limit, tier, limit, current: models.length };
}
