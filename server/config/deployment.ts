// deployment.ts — DEPLOYMENT_TIER 기반 티어별 기능 플래그
export type DeploymentTier = 'public_saas' | 'private_cloud' | 'on_prem';

function resolveTier(): DeploymentTier {
  const t = process.env.DEPLOYMENT_TIER;
  if (t === 'private_cloud' || t === 'on_prem') return t;
  return 'public_saas';
}

export const TIER: DeploymentTier = resolveTier();

export const deployment = {
  tier: TIER,
  // 결제: Public SaaS만 Paddle 사용. Private/On-prem은 별도 계약.
  hasPaddleBilling: TIER === 'public_saas',
  // Extension Layer: Private Cloud, On-prem만 활성화
  hasExtensionLayer: TIER !== 'public_saas',
  // PDF 월간 리포트: Public SaaS 제외
  hasPdfReports: TIER !== 'public_saas',
  // 라이선스 키 검증: On-prem만
  hasLicenseKey: TIER === 'on_prem',
  // 플랜 한도 강제: Public SaaS만
  hasPlanLimits: TIER === 'public_saas',
};

console.log(`[Deployment] tier=${TIER}`);
