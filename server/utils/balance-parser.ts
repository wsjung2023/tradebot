/**
 * 잔고 보유종목 파싱 유틸리티
 *
 * 키움 API는 실계좌 / 모의계좌 / 에이전트 버전에 따라 응답 필드명이 다르다.
 * 이 파일의 함수들은 account.routes.ts 의 fetch-balance / sync-balance 양쪽에서
 * 공용으로 사용하므로 절대 이 파일만 수정하지 말고 동반 테스트도 함께 업데이트해야 한다.
 *
 * 회귀 방지 테스트: scripts/test-balance-parser.ts
 * 실행 방법: node scripts/test-balance-parser.mjs
 *
 * ───────────────────────────────────────────────────────────────
 * ⚠️  필드명 우선순위 변경 금지 (재발 방지 2025)
 * 우선순위를 바꾸면 특정 계좌에서 평균단가·수익률이 0으로 표시된다.
 *
 * 실계좌 주요 필드 → 모의계좌 표준 필드 → 직접 지정 필드 순서
 *
 * 종목코드:  stk_cd        → acnt_pdno → pdno → stockCode
 * 수량:      rmnd_qty      → hldg_qty  → quantity
 * 평균단가:  pur_pric      → pchs_avg_pric → avg_pric → averagePrice
 * 현재가:    cur_prc       → prpr → currentPrice
 * 평가손익:  evltv_prft    → evlu_pfls_amt → evlu_pfls → profitLoss
 * 수익률:    prft_rt       → evlu_pfls_rt → pfls_rt → profitLossRate
 * ───────────────────────────────────────────────────────────────
 */

export type HoldingRawItem = Record<string, unknown>;

export type ParsedHolding = {
  stockCode: string;
  stockName: string;
  quantity: number;
  averagePrice: string;
  currentPrice: string;
  profitLoss: string;
  profitLossRate: string;
};

/**
 * 빈 문자열 / "0" / 공백만 있는 값을 "" 로 처리해 폴백 체인이 작동하게 한다.
 */
export function cleanStr(v: unknown): string {
  const s = String(v ?? "").trim();
  return s && s !== "0" ? s : "";
}

/**
 * 키움 API 응답의 보유종목 항목 하나를 DB 스키마 형식으로 변환한다.
 * 실계좌(stk_cd, pur_pric, …)와 모의계좌(acnt_pdno, pchs_avg_pric, …) 양쪽을 지원한다.
 */
export function parseHoldingItem(item: HoldingRawItem): ParsedHolding {
  return {
    stockCode:
      String(item.acnt_pdno || item.pdno || item.stk_cd || item.stockCode || ""),
    stockName:
      String(item.prdt_name || item.stk_nm || item.stockName || ""),
    quantity:
      parseInt(
        String(item.hldg_qty || item.rmnd_qty || (item.quantity ?? "0")),
        10,
      ),
    averagePrice:
      cleanStr(item.pchs_avg_pric) || cleanStr(item.avg_pric) ||
      cleanStr(item.pur_pric) || cleanStr(item.averagePrice) || "0",
    currentPrice:
      cleanStr(item.prpr) || cleanStr(item.cur_prc) ||
      cleanStr(item.currentPrice) || "0",
    profitLoss:
      cleanStr(item.evlu_pfls_amt) || cleanStr(item.evlu_pfls) ||
      cleanStr(item.evltv_prft) || "0",
    profitLossRate:
      cleanStr(item.evlu_pfls_rt) || cleanStr(item.pfls_rt) ||
      cleanStr(item.prft_rt) || "0",
  };
}
