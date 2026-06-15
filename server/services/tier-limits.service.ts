// tier-limits.service.ts — SaaS 티어별 기능 제한
import { storage } from '../storage';
import { isPublicSaaS } from '../config';

export const TIER_LIMITS = {
  free:             { maxRealAccounts: 0, maxAiAnalysisPerDay: 0,   canAutoApply: false },
  saas_basic:       { maxRealAccounts: 1, maxAiAnalysisPerDay: 10,  canAutoApply: false },
  saas_pro:         { maxRealAccounts: 2, maxAiAnalysisPerDay: 50,  canAutoApply: true  },
  saas_enterprise:  { maxRealAccounts: 5, maxAiAnalysisPerDay: 300, canAutoApply: true  },
} as const;

type Tier = keyof typeof TIER_LIMITS;

function getTier(tier: string | undefined): Tier {
  if (tier && tier in TIER_LIMITS) return tier as Tier;
  return 'free';
}

export function getLimits(tier: string | undefined) {
  return TIER_LIMITS[getTier(tier)];
}

async function getUserTier(userId: string): Promise<string> {
  if (!isPublicSaaS) return 'saas_enterprise'; // Private 배포는 무제한
  const sub = await storage.getUserSubscription(userId);
  return sub?.tier ?? 'free';
}

// 실계좌 수 제한 체크 — POST /api/accounts 시 호출
export async function checkRealAccountLimit(userId: string): Promise<{ allowed: boolean; current: number; max: number }> {
  const tier = await getUserTier(userId);
  const limits = getLimits(tier);
  const accounts = await storage.getKiwoomAccounts(userId);
  const realCount = accounts.filter((a: any) => a.accountType === 'real').length;
  return { allowed: realCount < limits.maxRealAccounts, current: realCount, max: limits.maxRealAccounts };
}

// AI 수동 분석 일일 횟수 체크 — POST /api/ai/analyze-* 시 호출
export async function checkAiAnalysisLimit(userId: string): Promise<{ allowed: boolean; used: number; max: number }> {
  const tier = await getUserTier(userId);
  const limits = getLimits(tier);
  if (limits.maxAiAnalysisPerDay === 0) {
    return { allowed: false, used: 0, max: 0 };
  }
  const todayKst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = await storage.getAiUsageDaily(userId, {
    fromDate: todayKst,
    toDate: todayKst,
    scopeType: 'login',
  });
  const used = rows.reduce((sum, r) => sum + (r.requestCount ?? 0), 0);
  return { allowed: used < limits.maxAiAnalysisPerDay, used, max: limits.maxAiAnalysisPerDay };
}

// autoApply 허용 여부 — PATCH auto-apply-toggle 시 호출
export async function checkAutoApplyAllowed(userId: string): Promise<boolean> {
  const tier = await getUserTier(userId);
  return getLimits(tier).canAutoApply;
}

// 실계좌 총 운용자산 기준 AUM 티어 계산
function calcAumTier(totalKrw: number): string {
  if (totalKrw >= 100_000_000) return 'over_100m';
  if (totalKrw >= 50_000_000)  return 'under_100m';
  if (totalKrw >= 20_000_000)  return 'under_50m';
  return 'under_20m';
}

// 사용자의 실계좌 잔고 합산 후 subscription.aumTier 업데이트
// 잔고 갱신 시점에만 호출 (GET /billing/subscription에서 매번 호출하지 않음)
export async function refreshUserAumTier(userId: string): Promise<void> {
  const accounts = await storage.getKiwoomAccounts(userId);
  const totalKrw = accounts
    .filter((a: any) => a.accountType === 'real')
    .reduce((sum: number, a: any) => sum + parseFloat(a.lastTotalAssets ?? '0'), 0);
  const newAumTier = calcAumTier(totalKrw);
  const sub = await storage.getUserSubscription(userId);
  if (sub && sub.aumTier !== newAumTier) {
    await storage.upsertSubscription({ userId, aumTier: newAumTier });
  }
}
