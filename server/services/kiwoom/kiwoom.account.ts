// kiwoom.account.ts — 키움증권 계좌 잔고 및 보유종목 조회 (공식 REST API 스펙)
// 실제 확인된 엔드포인트:
//   주식잔고: POST /api/acnt/baln  api-id: ka10083
//   예수금:   POST /api/acnt/dpst  api-id: ka10080
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

    // 계좌번호 정규화: 숫자만 추출
    const acntNo = accountNumber.replace(/\D/g, "");

    try {
      // ① 주식잔고 조회: POST /api/acnt/baln  api-id: ka10083
      const holdingsResp = await this.api.post<any>(
        "/api/acnt/baln",
        { acnt_no: acntNo, qry_dvsn: "00" },
        { headers: { "api-id": "ka10083" } }
      );
      const hData = holdingsResp.data;

      const rc = hData?.return_code ?? hData?.rt_cd;
      if (rc !== undefined && rc !== 0 && rc !== "0" && String(rc) !== "0") {
        throw new Error(`잔고조회 실패: ${hData?.return_msg || hData?.msg1} (code: ${rc})`);
      }

      // ② 예수금 조회: POST /api/acnt/dpst  api-id: ka10080
      let dpstData: any = {};
      try {
        const dpstResp = await this.api.post<any>(
          "/api/acnt/dpst",
          { acnt_no: acntNo, qry_tp: "00" },
          { headers: { "api-id": "ka10080" } }
        );
        dpstData = dpstResp.data || {};
      } catch {
        // 예수금 실패 시 빈 값으로 진행
      }

      // 응답 필드 매핑 — 실제 응답 필드명을 모두 포괄하도록 fallback 처리
      const rawHoldings: any[] = hData?.output || hData?.output1 || hData?.baln || hData?.stk_baln || [];
      const rawDpst: any = dpstData?.output || dpstData?.output1 || dpstData?.dpst || {};

      const output2 = rawHoldings.map((item: any) => ({
        acnt_pdno: item.isinCd || item.stk_cd || item.acnt_pdno || item.stkno || "",
        prdt_name: item.isinNm || item.stk_nm || item.prdt_name || item.stknm || "",
        hldg_qty: item.hldgQty || item.rmndQty || item.hldg_qty || item.rmnd_qty || "0",
        pchs_avg_pric: item.avgBuyPric || item.pchs_avg_pric || item.buy_avg_pric || "0",
        prpr: item.prsntPric || item.prpr || item.cur_prc || "0",
        evlu_pfls_amt: item.evluPflsAmt || item.evlu_pfls_amt || item.pfls_amt || "0",
        evlu_pfls_rt: item.evluPflsRt || item.evlu_pfls_rt || item.pfls_rt || "0",
        ...item,
      }));

      // 총 평가금액 계산 (API 합산 또는 직접 계산)
      const totalEvlu = output2.reduce(
        (s: number, i: any) => s + (parseFloat(i.prpr || "0") * parseInt(i.hldg_qty || "0", 10)),
        0
      );
      const totalPfl = output2.reduce(
        (s: number, i: any) => s + parseFloat(i.evlu_pfls_amt || "0"),
        0
      );

      const output1 = {
        tot_evlu_amt: rawDpst?.totEvluAmt || rawDpst?.tot_evlu_amt || String(totalEvlu),
        dnca_tot_amt: rawDpst?.dpstAmt || rawDpst?.dnca_tot_amt || rawDpst?.csh_blnc || "0",
        nxdy_excc_amt: rawDpst?.nxdyExccAmt || rawDpst?.nxdy_excc_amt || "0",
        evlu_pfls_smtl_amt: String(totalPfl),
        pchs_amt_smtl_amt: rawDpst?.pchsAmtSmtlAmt || "0",
        evlu_amt_smtl_amt: String(totalEvlu),
        ...rawDpst,
      };

      console.log(`✅ [KiwoomAccount] 잔고조회 성공 — 보유종목 ${output2.length}건`);
      return { output1, output2 };

    } catch (error: any) {
      console.error("[KiwoomAccount] 잔고조회 오류:", error.message);
      throw error;
    }
  }
}
