// kiwoom.account.ts — 키움증권 계좌 잔고 및 보유종목 조회 메서드
import { KiwoomBase, KiwoomConfig, type AccountBalanceResponse, KIWOOM_MOCK_BASE, KIWOOM_REAL_BASE } from "./kiwoom.base";
import axios from "axios";

export class KiwoomAccount extends KiwoomBase {

  async getAccountBalance(accountNumber: string, accountType: "mock" | "real" = "real", accountPassword?: string): Promise<AccountBalanceResponse> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    // 모의/실전에 따라 올바른 기본 URL 사용
    const targetBase = accountType === "mock" ? KIWOOM_MOCK_BASE : KIWOOM_REAL_BASE;
    const needsTokenRefresh = this.baseURL !== targetBase;
    if (needsTokenRefresh) {
      this.baseURL = targetBase;
      this.api.defaults.baseURL = targetBase;
      this.accessToken = null; // 토큰 재발급 강제
      this.tokenExpiry = 0;
    }

    await this.ensureValidToken();

    try {
      const body: Record<string, string> = {
        acnt_no: accountNumber,
        inqr_dvsn: "1",
      };
      if (accountPassword) {
        body.acnt_pwd = accountPassword;
      }

      const response = await this.api.post<any>(
        "/api/dostk/acnt",
        body,
        {
          headers: {
            "api-id": "ka10000",
          },
        }
      );

      const data = response.data;

      if (data.return_code !== undefined && data.return_code !== 0) {
        throw new Error(`잔고조회 실패: ${data.return_msg} (code: ${data.return_code})`);
      }

      // 응답 필드 정규화 — Kiwoom REST API가 반환하는 실제 필드를 인터페이스에 매핑
      const output1 = data.output1 || data.acnt_evlu || data;
      const output2: any[] = data.output2 || data.acnt_evlu_remn_qty_lst || data.stk_evlu || [];

      return {
        output1: {
          tot_evlu_amt: output1.tot_evlu_amt || output1.acnt_tot_evlu_amt || "0",
          dnca_tot_amt: output1.dnca_tot_amt || output1.cash_amt || "0",
          nxdy_excc_amt: output1.nxdy_excc_amt || "0",
          evlu_pfls_smtl_amt: output1.evlu_pfls_smtl_amt || output1.tot_evlu_pfls || "0",
          pchs_amt_smtl_amt: output1.pchs_amt_smtl_amt || output1.tot_pchs_amt || "0",
          evlu_amt_smtl_amt: output1.evlu_amt_smtl_amt || output1.tot_evlu_amt || "0",
          ...output1,
        },
        output2: output2.map((item: any) => ({
          acnt_pdno: item.acnt_pdno || item.stk_cd || item.pdno || "",
          prdt_name: item.prdt_name || item.stk_nm || "",
          hldg_qty: item.hldg_qty || item.rmnd_qty || "0",
          pchs_avg_pric: item.pchs_avg_pric || item.avg_pric || "0",
          prpr: item.prpr || item.cur_prc || "0",
          evlu_pfls_amt: item.evlu_pfls_amt || item.evlu_pfls || "0",
          evlu_pfls_rt: item.evlu_pfls_rt || item.pfls_rt || "0",
          ...item,
        })),
      };
    } catch (error: any) {
      console.error("[KiwoomAccount] 잔고조회 오류:", error.message);
      throw error;
    }
  }

}
