import assert from 'node:assert';
import { assessConcentration, decideConcentrationAction } from '../server/services/concentration-risk';

const up = [0.01, 0.02, -0.01, 0.03, 0.00];       // 후보
const same = [0.011, 0.019, -0.012, 0.031, 0.001]; // 거의 동일(고상관)
const opp = [-0.01, -0.02, 0.01, -0.03, 0.00];     // 반대(음상관)

// assess: 고상관 보유만 임계 넘어 담김
const a1 = assessConcentration(up, [
  { stockCode: 'AAA', returns: same },
  { stockCode: 'BBB', returns: opp },
], 0.7);
assert.strictEqual(a1.correlated.length, 1, 'AAA만 고상관');
assert.strictEqual(a1.correlated[0].stockCode, 'AAA');
assert.ok((a1.maxCorr as number) > 0.9, 'maxCorr 높음');

// 꼬리 정렬: 길이 다른 series도 짧은 쪽 기준 계산
const a2 = assessConcentration(up, [{ stockCode: 'AAA', returns: [0.5, ...same] }], 0.7);
assert.strictEqual(a2.correlated.length, 1, '길이 달라도 꼬리정렬로 계산');

// decide
assert.strictEqual(decideConcentrationAction(a1, 'block', 1).action, 'block', '1개 이상 → block');
assert.strictEqual(decideConcentrationAction(a1, 'warn', 1).action, 'warn', 'policy=warn');
assert.strictEqual(decideConcentrationAction(a1, 'block', 2).action, 'allow', '2개 필요한데 1개뿐 → allow');
assert.strictEqual(decideConcentrationAction({ correlated: [], maxCorr: null }, 'block', 1).action, 'allow', '상관없음 → allow');
console.log('OK: concentration-risk');
