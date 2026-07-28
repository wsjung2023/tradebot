// correlation.ts — 종가→수익률, 피어슨 상관 (순수 함수)

export function toReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    out.push(prev === 0 ? 0 : (closes[i] - prev) / prev);
  }
  return out;
}

export function pearsonCorrelation(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n !== b.length || n < 2) return null;
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ma = mean(a), mb = mean(b);
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  if (va === 0 || vb === 0) return null; // 분산 0 → 정의 불가
  return cov / Math.sqrt(va * vb);
}
