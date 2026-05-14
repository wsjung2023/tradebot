import type { OHLCVData } from '../formula/rainbow-chart';

type AnyRow = Record<string, any>;

function toDateKey(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  // YYYYMMDD -> YYYY-MM-DD
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value;
}

function toNum(raw: unknown): number {
  const n = Number(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function extractChartRows(rawChartData: any): AnyRow[] {
  if (Array.isArray(rawChartData)) return rawChartData;
  if (Array.isArray(rawChartData?.output2)) return rawChartData.output2;
  if (Array.isArray(rawChartData?.output1)) return rawChartData.output1;
  if (Array.isArray(rawChartData?.output)) return rawChartData.output;
  return [];
}

export function normalizeChartDataAsc(rawChartData: any): OHLCVData[] {
  const rows = extractChartRows(rawChartData);

  const normalized = rows
    .map((row: AnyRow): OHLCVData => ({
      date: toDateKey(row.date || row.dt || row.stck_bsop_date || ''),
      open: toNum(row.open ?? row.stck_oprc),
      high: toNum(row.high ?? row.stck_hgpr),
      low: toNum(row.low ?? row.stck_lwpr),
      close: toNum(row.close ?? row.cls_prc ?? row.stck_clpr),
      volume: Math.trunc(toNum(row.volume ?? row.trde_qty ?? row.acml_vol)),
    }))
    .filter((r) => !!r.date && r.close > 0);

  normalized.sort((a, b) => a.date.localeCompare(b.date));
  return normalized;
}

export function normalizePriceHistoryAsc(rawChartData: any, limit: number = 30) {
  return normalizeChartDataAsc(rawChartData)
    .slice(-Math.max(1, limit))
    .map((row) => ({
      date: row.date,
      price: row.close,
      volume: row.volume,
    }));
}
