// dart.service.ts — 금감원 전자공시(DART) API 연동
// DART_API_KEY 환경변수 필요. 없으면 빈 배열 반환(graceful degradation).
// 종목코드 → DART 고유번호 변환을 DART company API로 실시간 조회 (메모리 캐시 적용).
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
  private readonly companyUrl = 'https://opendart.fss.or.kr/api/company.json';

  // 메모리 캐시: 종목코드 → DART 고유번호 (프로세스 재시작 시 초기화)
  private readonly corpCodeCache = new Map<string, string>();

  get isAvailable(): boolean {
    return !!this.apiKey;
  }

  // 종목코드로 DART 고유번호 실시간 조회 — list.json에서 corp_code 추출 (캐시 적용)
  async resolveCorpCode(stockCode: string): Promise<string> {
    if (!this.isAvailable || !stockCode) return '';
    const normalized = String(stockCode).replace(/\D/g, '');
    if (!normalized) return '';

    if (this.corpCodeCache.has(normalized)) {
      return this.corpCodeCache.get(normalized)!;
    }

    try {
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 3);
      const bgn_de = startDate.toISOString().slice(0, 10).replace(/-/g, '');
      const end_de = endDate.toISOString().slice(0, 10).replace(/-/g, '');
      const resp = await axios.get(this.baseUrl, {
        params: { crtfc_key: this.apiKey, stock_code: normalized, bgn_de, end_de, page_no: 1, page_count: 1 },
        timeout: 8000,
      });
      const list = Array.isArray(resp.data?.list) ? resp.data.list : [];
      const corpCode = list.length > 0 ? String(list[0].corp_code || '').trim() : '';
      if (corpCode) {
        this.corpCodeCache.set(normalized, corpCode);
      }
      return corpCode;
    } catch (error: any) {
      console.warn('[DartService] resolveCorpCode failed:', error?.message);
      return '';
    }
  }

  // 종목코드로 최근 공시 조회 (stock_code 직접 사용 — corp_code 변환 불필요)
  async getFilingsByStockCode(stockCode: string, days: number = 30): Promise<DartFilingItem[]> {
    if (!this.isAvailable || !stockCode) return [];

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Math.max(days, 1));
    const bgnDe = start.toISOString().slice(0, 10).replace(/-/g, '');
    const endDe = end.toISOString().slice(0, 10).replace(/-/g, '');

    try {
      const resp = await axios.get(this.baseUrl, {
        params: {
          crtfc_key: this.apiKey,
          stock_code: stockCode.replace(/\D/g, ''),
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
        corpCode: String(row.corp_code || ''),
        source: 'dart' as const,
        link: row.rcept_no ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${row.rcept_no}` : '',
        payload: row,
      })).filter((row: DartFilingItem) => row.rceptNo && row.reportNm);
    } catch (error: any) {
      console.warn('[DartService] getFilingsByStockCode failed:', error?.message);
      return [];
    }
  }

  // 최신 연간 재무제표 조회 (fnlttSinglAcnt) — 총자산/부채/유보율 등
  async getFinancialStatements(stockCode: string): Promise<Record<string, string>> {
    if (!this.isAvailable || !stockCode) return {};
    const corpCode = await this.resolveCorpCode(stockCode);
    if (!corpCode) return {};

    const year = new Date().getFullYear();
    // 가장 최근 사업보고서 조회 (당해 → 전년 순)
    for (const bsns_year of [String(year - 1), String(year - 2)]) {
      try {
        const resp = await axios.get('https://opendart.fss.or.kr/api/fnlttSinglAcnt.json', {
          params: { crtfc_key: this.apiKey, corp_code: corpCode, bsns_year, reprt_code: '11011', fs_div: 'CFS' },
          timeout: 10000,
        });
        if (resp.data?.status !== '000' || !Array.isArray(resp.data?.list)) continue;

        const result: Record<string, string> = {};
        for (const item of resp.data.list) {
          const nm: string = String(item.account_nm || '').replace(/\s/g, '');
          const amt = String(item.thstrm_amount || '').replace(/,/g, '');
          if (!amt || amt === '-') continue;
          if (nm.includes('자산총계')) result.totalAssets = amt;
          else if (nm.includes('부채총계')) result.totalDebt = amt;
          else if (nm.includes('자본금')) result.capital = amt;
          else if (nm.includes('이익잉여금') || nm.includes('결손금')) result.retainedEarnings = amt;
          else if (nm.includes('매출액') || nm.includes('영업수익')) result.revenue = amt;
          else if (nm.includes('영업이익')) result.operatingProfit = amt;
          else if (nm.includes('당기순이익')) result.netIncome = amt;
        }
        if (Object.keys(result).length > 0) return result;
      } catch { continue; }
    }
    return {};
  }

  // DART 고유번호로 공시 직접 조회 (레거시)
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
