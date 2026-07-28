// concentration-risk.ts — 보유 포트폴리오 대비 후보 집중(상관) 평가 (순수 함수)
import { pearsonCorrelation } from '../utils/correlation';

export type ConcentrationPolicy = 'warn' | 'block';
export type HoldingReturns = { stockCode: string; returns: number[] };
export type ConcentrationAssessment = {
  correlated: { stockCode: string; corr: number }[];
  maxCorr: number | null;
};

// 두 수익률 series를 짧은 길이의 "마지막 L개"로 맞춘다(최신 구간 정렬).
function alignTail(a: number[], b: number[]): [number[], number[]] {
  const L = Math.min(a.length, b.length);
  return [a.slice(a.length - L), b.slice(b.length - L)];
}

export function assessConcentration(
  candidateReturns: number[],
  holdings: HoldingReturns[],
  threshold: number,
): ConcentrationAssessment {
  const correlated: { stockCode: string; corr: number }[] = [];
  let maxCorr: number | null = null;
  for (const h of holdings) {
    const [x, y] = alignTail(candidateReturns, h.returns);
    const corr = pearsonCorrelation(x, y);
    if (corr === null) continue;
    if (maxCorr === null || corr > maxCorr) maxCorr = corr;
    if (corr >= threshold) correlated.push({ stockCode: h.stockCode, corr });
  }
  correlated.sort((p, q) => q.corr - p.corr);
  return { correlated, maxCorr };
}

export function decideConcentrationAction(
  a: ConcentrationAssessment,
  policy: ConcentrationPolicy,
  maxCorrelated: number,
): { action: 'allow' | ConcentrationPolicy; reason: string } {
  if (a.correlated.length >= maxCorrelated) {
    const list = a.correlated.map((c) => `${c.stockCode}(${c.corr.toFixed(2)})`).join(', ');
    return { action: policy, reason: `보유종목과 고상관 ${a.correlated.length}건: ${list}` };
  }
  return { action: 'allow', reason: '집중 위험 낮음' };
}
