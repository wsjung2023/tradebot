import assert from 'node:assert';
import { toReturns, pearsonCorrelation } from '../server/utils/correlation';

// toReturns
assert.deepStrictEqual(toReturns([100, 110, 99]), [0.1, -0.1], '단순수익률');
assert.deepStrictEqual(toReturns([100]), [], '1개면 빈배열');
assert.deepStrictEqual(toReturns([0, 10]), [0], '이전값 0 → 0');

// pearsonCorrelation
const a = [1, 2, 3, 4, 5];
assert.ok(Math.abs((pearsonCorrelation(a, [2, 4, 6, 8, 10]) as number) - 1) < 1e-9, '완전 양의상관=1');
assert.ok(Math.abs((pearsonCorrelation(a, [10, 8, 6, 4, 2]) as number) + 1) < 1e-9, '완전 음의상관=-1');
assert.strictEqual(pearsonCorrelation([1, 2], [1]), null, '길이 불일치 null');
assert.strictEqual(pearsonCorrelation([1], [2]), null, '표본<2 null');
assert.strictEqual(pearsonCorrelation([5, 5, 5], [1, 2, 3]), null, '분산0 null');
console.log('OK: correlation');
