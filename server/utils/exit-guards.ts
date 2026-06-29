// exit-guards.ts — 동적청산 가드 (순수 함수)
//
// 거래량급증 청산이 "방금 산 종목"을 즉시 팔아버리는 버그 방지.
// (오늘 거래량 = 그 종목을 매수한 이유인 활발한 거래량 → 과거 평균과 비교하면 거의 항상 급증으로 잡혀 사자마자 청산됨)

/** 진입 후 경과 일수(24h 기준). 진입시각이 없으면 null. */
export function holdingDaysSince(entryTime: Date | string | null | undefined, now: Date): number | null {
  if (!entryTime) return null;
  const t = new Date(entryTime).getTime();
  if (!Number.isFinite(t)) return null;
  return (now.getTime() - t) / 86_400_000;
}

/**
 * 동적청산(거래량급증 등) 최소보유 충족 여부.
 * - 같은날 매도 방지를 위해 최소 1일은 보유해야 함(하드 바닥).
 * - 사용자가 "보유기간(일)"(stalePeriodDays)을 더 크게 설정했으면 그 값을 존중.
 * - 진입시각을 알 수 없으면 보수적으로 미발동(false).
 */
export function meetsDynamicExitMinHold(daysSince: number | null, stalePeriodDays: number): boolean {
  if (daysSince === null) return false;
  const minDays = Math.max(1, stalePeriodDays || 0);
  return daysSince >= minDays;
}
