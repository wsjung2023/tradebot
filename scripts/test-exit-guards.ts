import assert from 'node:assert';
import { meetsDynamicExitMinHold, holdingDaysSince } from '../server/utils/exit-guards';

const now = new Date('2026-06-30T03:00:00Z');
// 1) 같은날(45초 전 진입) → 차단 (그 45초 매도 버그)
assert.strictEqual(meetsDynamicExitMinHold(holdingDaysSince(new Date(now.getTime() - 45_000), now), 30), false, '같은날 차단');
// 2) 2일 보유, 보유기간 30 → 차단
assert.strictEqual(meetsDynamicExitMinHold(2, 30), false, '2일<30 차단');
// 3) 31일 보유, 보유기간 30 → 허용
assert.strictEqual(meetsDynamicExitMinHold(31, 30), true, '31일>=30 허용');
// 4) 1.5일 보유, 보유기간 0 → 허용 (최소 1일 바닥)
assert.strictEqual(meetsDynamicExitMinHold(1.5, 0), true, '1.5일 허용(바닥1일)');
// 5) 0.5일 보유, 보유기간 0 → 차단 (1일 미만)
assert.strictEqual(meetsDynamicExitMinHold(0.5, 0), false, '0.5일 차단');
// 6) 진입시각 모름 → 차단(보수적)
assert.strictEqual(meetsDynamicExitMinHold(null, 30), false, '진입시각불명 차단');
// holdingDaysSince
assert.strictEqual(holdingDaysSince(null, now), null, 'null 입력');
assert.ok(Math.abs((holdingDaysSince(new Date(now.getTime() - 86_400_000), now) as number) - 1) < 1e-6, '정확히 1일');
console.log('OK: exit-guards');
