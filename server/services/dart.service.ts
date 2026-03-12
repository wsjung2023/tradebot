import axios from 'axios';

export type DartFilingItem = {
  rceptNo: string;
  reportNm: string;
  flrNm: string;
  rceptDt: string;
  corpCode?: string;
  source: 'dart';
  link: string;
  payload: any;
};

export class DartService {
  private readonly apiKey = process.env.DART_API_KEY || '';
  private readonly baseUrl = 'https://opendart.fss.or.kr/api/list.json';
  private readonly corpCodeMap = this.parseCorpCodeMap(process.env.DART_CORP_CODE_MAP || '');

  private parseCorpCodeMap(raw: string): Record<string, string> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};

      return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
        if (typeof value !== 'string') return acc;
        const normalizedKey = key.replace(/\D/g, '');
        const normalizedValue = value.trim();
        if (!normalizedKey || !normalizedValue) return acc;
        acc[normalizedKey] = normalizedValue;
        return acc;
      }, {});
    } catch {
      console.warn('[DartService] failed to parse DART_CORP_CODE_MAP; fallback to empty map');
      return {};
    }
  }

  get isAvailable(): boolean {
    return !!this.apiKey;
  }

  getMappedCorpCode(stockCode: string): string {
    const normalized = String(stockCode || '').replace(/\D/g, '');
    if (!normalized) return '';
    return this.corpCodeMap[normalized] || '';
  }

  async getRecentFilings(corpCode: string, days: number = 30): Promise<DartFilingItem[]> {
    if (!this.isAvailable || !corpCode) return [];

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Math.max(days, 1));
    const bgnDe = start.toISOString().slice(0, 10).replace(/-/g, '');
    const endDe = end.toISOString().slice(0, 10).replace(/-/g, '');

    try {
      const resp = await axios.get(this.baseUrl, {
        params: {
          crtfc_key: this.apiKey,
          corp_code: corpCode,
          bgn_de: bgnDe,
          end_de: endDe,
          page_no: 1,
          page_count: 20,
        },
        timeout: 10000,
      });

      const list = Array.isArray(resp.data?.list) ? resp.data.list : [];
      return list.map((row: any) => ({
        rceptNo: String(row.rcept_no || ''),
        reportNm: String(row.report_nm || ''),
        flrNm: String(row.flr_nm || ''),
        rceptDt: String(row.rcept_dt || ''),
        corpCode,
        source: 'dart' as const,
        link: row.rcept_no ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${row.rcept_no}` : '',
        payload: row,
      })).filter((row: DartFilingItem) => row.rceptNo && row.reportNm);
    } catch (error: any) {
      console.warn('[DartService] getRecentFilings failed:', error?.message);
      return [];
    }
  }
}

let instance: DartService | null = null;
export function getDartService(): DartService {
  if (!instance) instance = new DartService();
  return instance;
}
