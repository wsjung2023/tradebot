import assert from 'node:assert';
import { generateVariants } from '../server/services/variant-generator';

const base = { minAiConfidence: '70', defaultPositionSize: '1000000', stalePeriodDays: 5, surgeThreshold: '10' };

// 1) 기본 개수 5, 챔피언이 첫 변종
const v = generateVariants(base);
assert.strictEqual(v.length, 5, '기본 5개');
assert.strictEqual(v[0].variantId, 0);
assert.strictEqual(v[0].label, 'champion');
assert.deepStrictEqual(v[0].overrides, {}, '챔피언은 변형 없음');

// 2) 각 도전자는 손잡이 정확히 1개만 변형
for (let i = 1; i < v.length; i++) {
  const keys = Object.keys(v[i].overrides);
  assert.strictEqual(keys.length, 1, `도전자 ${i}는 손잡이 1개만`);
}

// 3) 4개 손잡이가 도전자들에 모두 1번씩 등장
const touched = new Set(v.slice(1).flatMap((x) => Object.keys(x.overrides)));
assert.deepStrictEqual([...touched].sort(), ['defaultPositionSize', 'minAiConfidence', 'stalePeriodDays', 'surgeThreshold']);

// 4) 결정적(deterministic): 같은 입력 → 같은 출력
assert.deepStrictEqual(generateVariants(base), generateVariants(base), '결정적');

// 5) count 클램프
assert.strictEqual(generateVariants(base, 99).length, 5, '5 초과는 5로 클램프');
assert.strictEqual(generateVariants(base, 1).length, 1, 'count=1이면 챔피언만');

console.log('OK: variant-generator');
