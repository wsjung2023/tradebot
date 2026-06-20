// variant-generator.ts — 챔피언 설정에서 손잡이 하나씩만 바꾼 변종 목록 생성 (순수 함수, Track 1)
export type VariantOverride = {
  minAiConfidence?: string;
  defaultPositionSize?: string;
  stalePeriodDays?: number;
  surgeThreshold?: string;
};

export type Variant = { variantId: number; label: string; overrides: VariantOverride };

// 베이스 값에서 한 단계 변형한 도전자 정의(결정적). 순서 고정.
function challengers(base: VariantOverride): { label: string; overrides: VariantOverride }[] {
  const conf = Number(base.minAiConfidence ?? '70');
  const pos = Number(base.defaultPositionSize ?? '1000000');
  const stale = Number(base.stalePeriodDays ?? 5);
  const surge = Number(base.surgeThreshold ?? '10');
  return [
    { label: 'looser-confidence', overrides: { minAiConfidence: String(Math.max(0, conf - 5)) } },
    { label: 'smaller-size', overrides: { defaultPositionSize: String(Math.round(pos * 0.7)) } },
    { label: 'shorter-hold', overrides: { stalePeriodDays: Math.max(1, stale - 2) } },
    { label: 'lower-surge', overrides: { surgeThreshold: String(Math.max(0, surge - 3)) } },
  ];
}

export function generateVariants(base: VariantOverride, count = 5): Variant[] {
  const clamped = Math.max(1, Math.min(5, Math.floor(count)));
  const out: Variant[] = [{ variantId: 0, label: 'champion', overrides: {} }];
  for (const c of challengers(base)) {
    if (out.length >= clamped) break;
    out.push({ variantId: out.length, label: c.label, overrides: c.overrides });
  }
  return out;
}
