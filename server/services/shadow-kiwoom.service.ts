// shadow-kiwoom.service.ts — 전방 섀도우(forward shadow) 매매용 Kiwoom 서비스
//
// Track 1 안전 핵심: 시세/차트/잔고 등 "읽기"는 실제 KiwoomService를 그대로 상속해
// 실시간 시장 데이터를 사용하되, "주문(placeOrder/cancelOrder)"만 가로채
// 합성 체결을 반환한다. 실제 키움 주문 API/에이전트를 절대 호출하지 않는다.
//
// → 실주문 경로 미호출이 보장되므로 실계좌·실머니와 완전히 분리된다.
import { KiwoomService, type KiwoomConfig, type OrderRequest, type OrderResponse } from './kiwoom';

export class ShadowKiwoomService extends KiwoomService {
  readonly isShadow = true;

  constructor(config: KiwoomConfig) {
    // 읽기 경로(시세/차트/잔고/재무)는 실제 REST를 그대로 사용 (실시간성 확보)
    super(config);
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
}
