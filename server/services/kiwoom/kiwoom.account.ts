// kiwoom.account.ts — 키움증권 계좌 잔고 및 보유종목 조회
// 공식 확인된 API:
//   계좌평가잔고내역: POST /api/dostk/acnt  api-id: kt00018  body: {qry_tp, dmst_stex_tp}
//   예수금상세현황:   POST /api/dostk/acnt  api-id: kt00001  body: {qry_tp}
//   계좌평가현황:     POST /api/dostk/acnt  api-id: kt00004  body: {qry_tp, dmst_stex_tp}
// 주의: 계좌번호(acnt_no)는 요청 본문에 불필요 — 액세스 토큰으로 계좌 식별
import { KiwoomBase, type AccountBalanceResponse, KIWOOM_MOCK_BASE, KIWOOM_REAL_BASE } from "./kiwoom.base";

export class KiwoomAccount extends KiwoomBase {

  async getAccountBalance(
    accountNumber: string,
    accountType: "mock" | "real" = "real",
    accountPassword?: string
  ): Promise<AccountBalanceResponse> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    const targetBase = accountType === "mock" ? KIWOOM_MOCK_BASE : KIWOOM_REAL_BASE;
    if (this.baseURL !== targetBase) {
      this.baseURL = targetBase;
      this.api.defaults.baseURL = targetBase;
      this.accessToken = null;
      this.tokenExpiry = 0;
    }

    await this.ensureValidToken();

    try {
      // ① 계좌평가잔고내역요청: api-id kt00018
      //    qry_tp: "2"=개별, "1"=합산  /  dmst_stex_tp: "%"=전체, "KRX"=KRX
      const balResp = await this.api.post<any>(
        "/api/dostk/acnt",
        { qry_tp: "2", dmst_stex_tp: "%" },
        { headers: { "api-id": "kt00018" } }
      );
      const balData = balResp.data;

      const rc = balData?.return_code;
      if (rc !== undefined && rc !== 0 && rc !== "0" && String(rc) !== "0") {
        throw new Error(`잔고조회 실패: ${balData?.return_msg} (code: ${rc})`);
      }

      // ② 예수금상세현황요청: api-id kt00001
      //    qry_tp: "2"=일반조회, "3"=추정조회
      let dpstData: any = {};
      try {
        const dpstResp = await this.api.post<any>(
          "/api/dostk/acnt",
          { qry_tp: "2" },
          { headers: { "api-id": "kt00001" } }
        );
        dpstData = dpstResp.data || {};
      } catch {
        // 예수금 실패 시 빈 값으로 진행
      }

      // kt00018 응답 필드 매핑
      // acnt_evlt_remn_indv_tot: 보유종목 배열
      const rawHoldings: any[] = balData?.acnt_evlt_remn_indv_tot || [];

      const output2 = rawHoldings.map((item: any) => ({
        acnt_pdno: item.stk_cd || item.acnt_pdno || "",
        prdt_name: item.stk_nm || item.prdt_name || "",
        hldg_qty: item.rmnd_qty || item.hldg_qty || "0",
        pchs_avg_pric: item.avg_pric || item.pchs_avg_pric || "0",
        prpr: item.cur_prc || item.prpr || "0",
        evlu_pfls_amt: item.evlt_pl || item.evlu_pfls_amt || "0",
        evlu_pfls_rt: item.prft_rt || item.evlu_pfls_rt || "0",
        ...item,
      }));

      // kt00018 요약 필드
      const output1 = {
        tot_evlu_amt:       balData?.tot_evlt_amt       || "0",
        dnca_tot_amt:       dpstData?.entr              || dpstData?.ord_alow_amt || "0",
        nxdy_excc_amt:      dpstData?.d2_pymn_alow_amt  || "0",
        evlu_pfls_smtl_amt: balData?.tot_evlt_pl        || "0",
        pchs_amt_smtl_amt:  balData?.tot_pur_amt        || "0",
        evlu_amt_smtl_amt:  balData?.tot_evlt_amt       || "0",
        ord_alow_amt:       dpstData?.ord_alow_amt      || "0",
        pymn_alow_amt:      dpstData?.pymn_alow_amt     || dpstData?.d1_pymn_alow_amt || "0",
        prsm_dpst_aset_amt: balData?.prsm_dpst_aset_amt || "0",
      };

      console.log(`✅ [KiwoomAccount] 잔고조회 성공 — 보유종목 ${output2.length}건, 예수금 ${parseInt(output1.dnca_tot_amt || "0").toLocaleString()}원`);
      return { output1, output2 };

    } catch (error: any) {
      const respBody = error?.response?.data;
      console.error("[KiwoomAccount] 잔고조회 오류:", error.message, respBody ? JSON.stringify(respBody) : "");
      if (respBody) {
        throw new Error(`잔고조회 실패: ${respBody.return_msg || respBody.message || JSON.stringify(respBody)} (HTTP ${error?.response?.status})`);
      }
      throw error;
    }
  }
}
