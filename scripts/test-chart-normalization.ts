import assert from 'node:assert/strict';
import { normalizeChartDataAsc, normalizePriceHistoryAsc } from '../server/utils/chart-normalization';

const mixedPayload = {
  output2: [
    { stck_bsop_date: '20260329', stck_oprc: '1020', stck_hgpr: '1100', stck_lwpr: '1000', stck_clpr: '1080', acml_vol: '20000' },
    { stck_bsop_date: '20260327', stck_oprc: '980', stck_hgpr: '1050', stck_lwpr: '970', stck_clpr: '1020', acml_vol: '15000' },
    { stck_bsop_date: '20260328', stck_oprc: '1010', stck_hgpr: '1090', stck_lwpr: '1005', stck_clpr: '1040', acml_vol: '18000' },
  ],
};

const normalized = normalizeChartDataAsc(mixedPayload);
assert.equal(normalized.length, 3);
assert.deepEqual(
  normalized.map((row) => row.date),
  ['2026-03-27', '2026-03-28', '2026-03-29'],
);
assert.equal(normalized[0].close, 1020);
assert.equal(normalized[2].volume, 20000);

const priceHistory = normalizePriceHistoryAsc(mixedPayload, 2);
assert.equal(priceHistory.length, 2);
assert.deepEqual(
  priceHistory.map((row) => row.date),
  ['2026-03-28', '2026-03-29'],
);

console.log('✅ chart-normalization regression test passed');
