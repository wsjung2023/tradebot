// race-scoring.ts — 변종 시뮬 성과 채점 + 1등 선정 (순수 함수, Track 1)
export type VariantScore = { trades: number; winRate: number; sumPlRate: number; score: number };

export function scorePerf(rows: { profitLossRate: string | null; isWin: boolean | null }[]): VariantScore {
  const closed = rows.filter((r) => r.isWin !== null && r.isWin !== undefined);
  const trades = closed.length;
  const sumPlRate = closed.reduce((acc, r) => acc + Number(r.profitLossRate ?? '0'), 0);
  const wins = closed.filter((r) => r.isWin === true).length;
  const winRate = trades === 0 ? 0 : wins / trades;
  return { trades, winRate, sumPlRate, score: sumPlRate + winRate * 10 };
}

export function pickWinner<T extends { score: VariantScore }>(items: T[], minTrades: number): T | null {
  const eligible = items.filter((it) => it.score.trades >= minTrades);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, it) => (it.score.score > best.score.score ? it : best));
}
