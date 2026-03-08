// kiwoom.account.ts — 키움증권 계좌 잔고 및 보유종목 조회 (공식 REST API 스펙 기반)
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

    // 모의/실전에 따라 올바른 기본 URL 자동 전환
    const targetBase = accountType === "mock" ? KIWOOM_MOCK_BASE : KIWOOM_REAL_BASE;
    if (this.baseURL !== targetBase) {
      this.baseURL = targetBase;
      this.api.defaults.baseURL = targetBase;
      this.accessToken = null;
      this.tokenExpiry = 0;
    }

    await this.ensureValidToken();

    try {
      // ka01010: 계좌잔고조회 (보유종목 리스트)
      const holdingsBody: Record<string, string> = {
        acno: accountNumber,
        inqrDvsnCd: "01",
      };

      const holdingsResp = await this.api.post<any>(
        "/api/dostk/acnt",
        holdingsBody,
        { headers: { "api-id": "ka01010" } }
      );

      const holdingsData = holdingsResp.data;

      // 오류 체크 — Kiwoom은 return_code 또는 rt_cd 사용
      const rc = holdingsData.return_code ?? holdingsData.rt_cd;
      if (rc !== undefined && rc !== 0 && rc !== "0") {
        throw new Error(
          `잔고조회 실패: ${holdingsData.return_msg || holdingsData.msg1} (code: ${rc})`
        );
      }

      // ka10001: 계좌평가현황 (총자산, 예수금 등 요약)
      let summaryData: any = {};
      try {
        const summaryResp = await this.api.post<any>(
          "/api/dostk/acnt",
          { acno: accountNumber },
          { headers: { "api-id": "ka10001" } }
        );
        summaryData = summaryResp.data || {};
      } catch {
        // 요약 실패 시 holdings에서 합산
      }

      // 보유종목 리스트 — Kiwoom camelCase 필드
      const rawList: any[] = holdingsData.output || holdingsData.output1 || holdingsData.stk_lst || [];

      const output2 = rawList.map((item: any) => ({
        acnt_pdno: item.isinCd || item.stkCd || item.stk_cd || item.acnt_pdno || "",
        prdt_name: item.isinNm || item.stkNm || item.stk_nm || item.prdt_name || "",
        hldg_qty: item.hldgQty || item.rmndQty || item.hldg_qty || "0",
        pchs_avg_pric: item.avgBuyPric || item.pchs_avg_pric || "0",
        prpr: item.prsntPric || item.curPrc || item.prpr || "0",
        evlu_pfls_amt: item.evluPflsAmt || item.evlu_pfls_amt || "0",
        evlu_pfls_rt: item.evluPflsRt || item.evlu_pfls_rt || "0",
        ...item,
      }));

      // 총자산 합산 (요약 API 또는 holdings 합산)
      const smry = summaryData.output || summaryData.output1 || summaryData;
      const totalEvlu = output2.reduce(
        (sum: number, item: any) => sum + parseFloat(item.prpr || "0") * parseInt(item.hldg_qty || "0", 10),
        0
      );
      const totalPfl = output2.reduce(
        (sum: number, item: any) => sum + parseFloat(item.evlu_pfls_amt || "0"),
        0
      );

      const output1 = {
        tot_evlu_amt: smry.totEvluAmt || smry.tot_evlu_amt || String(totalEvlu),
        dnca_tot_amt: smry.dncaTotAmt || smry.dnca_tot_amt || smry.cshBlnc || "0",
        nxdy_excc_amt: smry.nxdyExccAmt || smry.nxdy_excc_amt || "0",
        evlu_pfls_smtl_amt: smry.evluPflsSmtlAmt || smry.evlu_pfls_smtl_amt || String(totalPfl),
        pchs_amt_smtl_amt: smry.pchsAmtSmtlAmt || smry.pchs_amt_smtl_amt || "0",
        evlu_amt_smtl_amt: smry.evluAmtSmtlAmt || smry.evlu_amt_smtl_amt || String(totalEvlu),
        ...smry,
      };

      console.log(`✅ [KiwoomAccount] 잔고조회 성공 — 보유종목 ${output2.length}건`);
      return { output1, output2 };

    } catch (error: any) {
      console.error("[KiwoomAccount] 잔고조회 오류:", error.message);
      throw error;
    }
  }
}
