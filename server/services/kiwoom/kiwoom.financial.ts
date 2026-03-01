// kiwoom.financial.ts — 키움증권 재무제표 및 재무비율 조회 메서드
import { KiwoomBase, type FinancialStatementsResponse, type FinancialRatiosResponse } from "./kiwoom.base";

export class KiwoomFinancial extends KiwoomBase {

  // 재무제표 조회
  async getFinancialStatements(stockCode: string): Promise<FinancialStatementsResponse> {
    try {
      const response = await this.api.get<FinancialStatementsResponse>(
        "/uapi/domestic-stock/v1/finance/financial-statements",
        {
          params: { FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: stockCode, FID_DIV_CLS_CODE: "0" },
          headers: { tr_id: "FHKST03030100" },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get financial statements:", error);
      throw error;
    }
  }

  // 재무비율 조회 (ROE, ROA, PER, PBR 등)
  async getFinancialRatios(stockCode: string): Promise<FinancialRatiosResponse> {
    try {
      const response = await this.api.get<FinancialRatiosResponse>(
        "/uapi/domestic-stock/v1/finance/financial-ratios",
        {
          params: { FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: stockCode },
          headers: { tr_id: "FHKST03140100" },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get financial ratios:", error);
      throw error;
    }
  }
}
