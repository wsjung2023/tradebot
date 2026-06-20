// shadow-kiwoom.service.ts — 전방 섀도우(forward shadow) 매매용 Kiwoom 서비스
//
// Track 1 안전 핵심: 시세/차트/재무 등 "읽기"는 실제 KiwoomService를 그대로 상속해
// 실시간 시장 데이터를 사용하되, "주문(placeOrder/cancelOrder)"만 가로채
// 합성 체결을 반환한다. 실제 키움 주문 API/에이전트를 절대 호출하지 않는다.
// 잔고(getAccountBalance)도 실 브로커 대신 시뮬 계좌의 저장 holdings로 합성한다.
//
// → 실주문 경로 미호출 + 실계좌 잔고 미참조가 보장되므로 실머니와 완전히 분리된다.
import {
  KiwoomService,
  type KiwoomConfig,
  type OrderRequest,
  type OrderResponse,
  type AccountBalanceResponse,
} from './kiwoom';
import { storage } from '../storage';

export class ShadowKiwoomService extends KiwoomService {
  readonly isShadow = true;
  private readonly simAccountId: number;
  private readonly virtualCashKrw: number;

  constructor(config: KiwoomConfig, opts: { simAccountId: number; virtualCashKrw?: number }) {
    // 읽기 경로(시세/차트/재무)는 실제 REST를 그대로 사용 (실시간성 확보)
    super(config);
    this.simAccountId = opts.simAccountId;
    this.virtualCashKrw = opts.virtualCashKrw ?? 100_000_000; // 기본 가상 운용자금 1억
  }

  // 주문: 실제 API 호출 없이 즉시 합성 체결 반환 (현재가 시장가 체결 가정)
  override async placeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    const simOrderNo = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      return_code: 0,
      return_msg: 'SIM 체결',
      output: {
        ord_no: simOrderNo,
        simulated: 'true',
        stk_cd: orderRequest.stockCode,
        ord_qty: String(orderRequest.orderQuantity),
        ord_tp: orderRequest.orderType,
      },
    };
  }

  // 취소도 동일하게 합성 처리 (실제 취소 API 미호출)
  override async cancelOrder(_accountNumber: string, orderNumber: string, _orderQuantity: number): Promise<OrderResponse> {
    return {
      return_code: 0,
      return_msg: 'SIM 취소',
      output: { ord_no: orderNumber, simulated: 'true' },
    };
  }

  // 잔고: 실 브로커 대신 시뮬 계좌의 저장 holdings로 합성 (매도 가능 수량 체크용)
  override async getAccountBalance(
    _accountNumber: string,
    accountType: 'mock' | 'real' = 'real',
    _accountPassword?: string,
  ): Promise<AccountBalanceResponse & { usedBaseURL: string; usedAccountType: 'mock' | 'real' }> {
    const holdings = await storage.getHoldings(this.simAccountId);
    const output2 = holdings.map((h) => ({
      acnt_pdno: h.stockCode,
      stk_cd: h.stockCode,
      prdt_name: h.stockName,
      hldg_qty: String(h.quantity),
      rmnd_qty: String(h.quantity),
      sellable_qty: String(h.quantity),
      pchs_avg_pric: String(h.averagePrice ?? '0'),
      prpr: String(h.currentPrice ?? h.averagePrice ?? '0'),
      evlu_pfls_amt: '0',
      evlu_pfls_rt: '0',
    }));
    return {
      output1: {
        tot_evlu_amt: String(this.virtualCashKrw),
        dnca_tot_amt: String(this.virtualCashKrw),
        nxdy_excc_amt: String(this.virtualCashKrw),
        evlu_pfls_smtl_amt: '0',
        pchs_amt_smtl_amt: '0',
        evlu_amt_smtl_amt: '0',
      },
      output2: output2 as any,
      return_code: 0,
      usedBaseURL: '',
      usedAccountType: accountType,
    };
  }
}
