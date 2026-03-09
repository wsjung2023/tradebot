// kiwoom.financial.ts — 키움증권 REST API 재무정보 조회
// ka10001: 주식기본정보요청 (PER, EPS, PBR, BPS, 자본금 등 포함)
// 주의: 키움 REST API는 KIS 방식의 별도 재무제표 엔드포인트를 제공하지 않음
// 상세 재무제표(손익계산서, 대차대조표)는 REST API 미지원
import { KiwoomBase, type FinancialStatementsResponse, type FinancialRatiosResponse } from "./kiwoom.base";

const STKINFO = "/api/dostk/stkinfo";

function today(): string {
  return new Date().toISOString().split("T")[0].replace(/-/g, "");
}

export class KiwoomFinancial extends KiwoomBase {

  // ───────────── 주식기본정보 (재무비율 포함) ─────────────
  // ka10001 응답: PER, EPS, PBR, BPS, 자본금, 상장주식수 등
  async getStockBasicInfo(stockCode: string): Promise<any> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    await this.ensureValidToken();

    try {
      const resp = await this.api.post<any>(
        STKINFO,
        { stk_cd: stockCode, dt: "", qry_tp: "1" },
        { headers: { "api-id": "ka10001" } }
      );
      const d = resp.data;
      if (d?.return_code !== undefined && d.return_code !== 0 && String(d.return_code) !== "0") {
        throw new Error(`기본정보 조회 실패: ${d.return_msg} (code: ${d.return_code})`);
      }
      return d;
    } catch (error: any) {
      console.error("주식기본정보 조회 실패:", error.message);
      throw error;
    }
  }

  // ───────────── 재무제표 조회 ─────────────
  // Kiwoom REST API는 상세 재무제표(손익계산서, 대차대조표) 미지원
  // ka10001의 기본정보에서 추출 가능한 필드만 반환
  async getFinancialStatements(stockCode: string): Promise<FinancialStatementsResponse> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    await this.ensureValidToken();

    try {
      const info = await this.getStockBasicInfo(stockCode);
      // ka10001 응답에서 재무 관련 필드 추출
      // 실제 분기별 재무제표는 REST API 미지원 → 단일 최신 데이터만 반환
      return {
        output: [
          {
            stac_yymm:    today().substring(0, 6),
            sale_account: info.sale_acnt    || info.acc_trde_prica || "0",
            sale_cost:    "0",
            sale_totl_prft: "0",
            bsop_prti:    "0",
            op_prft:      info.oprt_prft   || "0",
            thtr_ntin:    info.net_incm    || "0",
            indi_cptl:    info.cap         || "0",
            cptl:         info.cap         || "0",
          },
        ],
        return_code: 0,
      };
    } catch (error: any) {
      console.error("재무제표 조회 실패:", error.message);
      throw error;
    }
  }

  // ───────────── 재무비율 조회 ─────────────
  // ka10001 응답에서 PER, EPS, PBR, BPS 등 추출
  async getFinancialRatios(stockCode: string): Promise<FinancialRatiosResponse> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    await this.ensureValidToken();

    try {
      const info = await this.getStockBasicInfo(stockCode);
      return {
        output: [
          {
            stac_yymm: today().substring(0, 6),
            per:       info.per    || "0",
            pbr:       info.pbr    || "0",
            eps:       info.eps    || "0",
            bps:       info.bps    || "0",
            roe:       info.roe    || "0",
            roa:       "0",
            ebitda:    "0",
            debt_rate: "0",
          },
        ],
        return_code: 0,
      };
    } catch (error: any) {
      console.error("재무비율 조회 실패:", error.message);
      throw error;
    }
  }
}
