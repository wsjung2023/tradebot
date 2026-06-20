import assert from 'node:assert';
import { scorePerf, pickWinner } from '../server/services/race-scoring';

// scorePerf: 미청산(isWin=null)은 trades에서 제외
const s = scorePerf([
  { profitLossRate: '5', isWin: true },
  { profitLossRate: '-2', isWin: false },
  { profitLossRate: null, isWin: null }, // 미청산 → 제외
]);
assert.strictEqual(s.trades, 2, '청산 완료 2건');
assert.strictEqual(s.sumPlRate, 3, '5 + (-2)');
assert.strictEqual(s.winRate, 0.5, '1/2');
assert.strictEqual(s.score, 3 + 0.5 * 10);

// pickWinner: 최소 거래 수 미달은 제외
const a = { id: 'a', score: scorePerf([{ profitLossRate: '20', isWin: true }]) };          // trades=1
const b = { id: 'b', score: scorePerf([{ profitLossRate: '3', isWin: true }, { profitLossRate: '4', isWin: true }]) }; // trades=2
assert.strictEqual(pickWinner([a, b], 2)?.id, 'b', '최소 2건 충족한 b');
assert.strictEqual(pickWinner([a], 2), null, '아무도 최소 미달 → null');

console.log('OK: race-scoring');
