// kiwoom.order.ts — 키움증권 REST API 주문 실행·취소·내역 조회
// 매수: kt10000, 매도: kt10001, 취소: kt10003, 체결내역: kt00007
// trde_tp: "00"=지정가(보통), "03"=시장가
// dmst_stex_tp: "KRX" (유가증권/코스닥 공통)
import { KiwoomBase, type OrderRequest, type OrderResponse } from "./kiwoom.base";

const ORDER   = "/api/dostk/ordr";
const ACCOUNT = "/api/dostk/acnt";

function today(): string {
  return new Date().toISOString().split("T")[0].replace(/-/g, "");
}

export class KiwoomOrder extends KiwoomBase {

  // ───────────── 주문 실행 ─────────────
  async placeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    const { stockCode, orderType, orderQuantity, orderPrice, orderMethod } = orderRequest;
    const apiId = orderType === "buy" ? "kt10000" : "kt10001";
    const trde_tp = orderMethod === "market" ? "03" : "00"; // 03=시장가, 00=지정가(보통)
    const ord_uv = orderMethod === "market" ? "0" : (orderPrice ? String(orderPrice) : "0");

    await this.ensureValidToken();

    try {
      const response = await this.api.post<any>(
        ORDER,
        {
          dmst_stex_tp: "KRX",
          stk_cd:       stockCode,
          ord_qty:      String(orderQuantity),
          trde_tp,
          ord_uv,
          cond_uv:      "0",
        },
        { headers: { "api-id": apiId } }
      );
      const d = response.data;
      if (d?.return_code !== undefined && d.return_code !== 0 && String(d.return_code) !== "0") {
        throw new Error(`주문 실패: ${d.return_msg} (code: ${d.return_code})`);
      }
      return {
        return_code: 0,
        return_msg:  d?.return_msg || "주문 접수",
        output: {
          ord_no: d?.ord_no || "",
          ...d,
        },
      };
    } catch (error: any) {
      console.error("주문 실패:", error.message);
      throw error;
    }
  }

  // ───────────── 주문 취소 ─────────────
  async cancelOrder(
    _accountNumber: string,
    orderNumber: string,
    orderQuantity: number,
    stockCode?: string
  ): Promise<any> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    await this.ensureValidToken();

    try {
      const response = await this.api.post<any>(
        ORDER,
        {
          dmst_stex_tp: "KRX",
          orig_ord_no:  orderNumber,
          stk_cd:       stockCode || "",
          cncl_qty:     String(orderQuantity),
        },
        { headers: { "api-id": "kt10003" } }
      );
      const d = response.data;
      if (d?.return_code !== undefined && d.return_code !== 0 && String(d.return_code) !== "0") {
        throw new Error(`취소 실패: ${d.return_msg} (code: ${d.return_code})`);
      }
      return d;
    } catch (error: any) {
      console.error("주문 취소 실패:", error.message);
      throw error;
    }
  }

  // ───────────── 주문 체결 내역 조회 ─────────────
  // kt00007: 계좌별주문체결내역상세요청 (오늘 기준)
  async getOrderHistory(
    _accountNumber: string,
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    if (this.stubMode) {
      throw new Error("Kiwoom API 키가 설정되지 않았습니다. 설정 > API 키 입력 후 다시 시도하세요.");
    }

    await this.ensureValidToken();

    const ordDate = startDate || today();

    try {
      const response = await this.api.post<any>(
        ACCOUNT,
        {
          qry_tp:       "0",  // 0=전체
          stk_bond_tp:  "0",  // 0=전체
          sell_tp:      "0",  // 0=전체(매수+매도)
          dmst_stex_tp: "KRX",
          ord_dt:       ordDate,
          stk_cd:       "",
          fr_ord_no:    "",
        },
        { headers: { "api-id": "kt00007" } }
      );
      const d = response.data;
      if (d?.return_code !== undefined && d.return_code !== 0 && String(d.return_code) !== "0") {
        throw new Error(`주문내역 조회 실패: ${d.return_msg} (code: ${d.return_code})`);
      }
      return d;
    } catch (error: any) {
      console.error("주문 내역 조회 실패:", error.message);
      throw error;
    }
  }
}
