// kiwoom.account.ts — 키움증권 계좌 잔고 및 보유종목 조회 메서드
import { KiwoomBase, type AccountBalanceResponse } from "./kiwoom.base";

export class KiwoomAccount extends KiwoomBase {
    async getAccountBalance(accountNumber: string, accountType: "mock" | "real" = "real"): Promise<AccountBalanceResponse> {
    if (this.stubMode) {
      // Return mock data in stub mode
      return {
        output1: {
          dnca_tot_amt: '50000000',
          nxdy_excc_amt: '50000000',
          prvs_rcdl_excc_amt: '0',
          cma_evlu_amt: '0',
          tot_evlu_amt: '100000000',
          pchs_amt_smtl_amt: '45000000',
          evlu_amt_smtl_amt: '50000000',
          evlu_pfls_smtl_amt: '5000000',
        },
        output2: [
          {
            pdno: '005930',
            prdt_name: '삼성전자',
            hldg_qty: '100',
            pchs_avg_pric: '70000',
            prpr: '75000',
            evlu_pfls_amt: '500000',
            evlu_pfls_rt: '7.14',
          },
          {
            pdno: '000660',
            prdt_name: 'SK하이닉스',
            hldg_qty: '50',
            pchs_avg_pric: '130000',
            prpr: '140000',
            evlu_pfls_amt: '500000',
            evlu_pfls_rt: '7.69',
          },
        ],
      };
    }
    
    try {
      const trId = accountType === "mock" ? "VTTC8434R" : "TTTC8434R";

      const response = await this.api.get<AccountBalanceResponse>(
        '/uapi/domestic-stock/v1/trading/inquire-balance',
        {
          params: {
            CANO: accountNumber.substring(0, 8),
            ACNT_PRDT_CD: accountNumber.substring(8),
            AFHR_FLPR_YN: 'N',
            OFL_YN: '',
            INQR_DVSN: '02',
            UNPR_DVSN: '01',
            FUND_STTL_ICLD_YN: 'N',
            FNCG_AMT_AUTO_RDPT_YN: 'N',
            PRCS_DVSN: '01',
          },
          headers: {
            tr_id: trId,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get account balance:', error);
      throw error;
    }
  }

}
