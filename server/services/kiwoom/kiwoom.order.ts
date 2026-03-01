// kiwoom.order.ts — 키움증권 주문 실행, 취소, 내역 조회 메서드
import { KiwoomBase, type OrderRequest, type OrderResponse } from "./kiwoom.base";

export class KiwoomOrder extends KiwoomBase {
  async placeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    const {
      accountNumber,
      stockCode,
      orderType,
      orderQuantity,
      orderPrice,
      orderMethod,
    } = orderRequest;

    if (this.stubMode) {
      // Return mock order response
      const orderNumber = `MOCK${Date.now()}`;
      console.log(`📝 STUB: ${orderType} order placed`, { stockCode, orderQuantity, orderPrice: orderPrice || 'market' });
      return {
        rt_cd: '0',
        msg_cd: '0000',
        msg1: '주문이 접수되었습니다 (STUB)',
        output: {
          KRX_FWDG_ORD_ORGNO: orderNumber,
          ODNO: orderNumber,
          ORD_TMD: new Date().toTimeString().substring(0, 8).replace(/:/g, ''),
        },
      };
    }

    const trId = orderType === 'buy' ? 'TTTC0802U' : 'TTTC0801U';
    
    try {
      const response = await this.api.post<OrderResponse>(
        '/uapi/domestic-stock/v1/trading/order-cash',
        {
          CANO: accountNumber.substring(0, 8),
          ACNT_PRDT_CD: accountNumber.substring(8),
          PDNO: stockCode,
          ORD_DVSN: orderMethod === 'market' ? '01' : '00',
          ORD_QTY: orderQuantity.toString(),
          ORD_UNPR: orderPrice ? orderPrice.toString() : '0',
        },
        {
          headers: {
            tr_id: trId,
          },
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Failed to place order:', error);
      throw error;
    }
  }

  async cancelOrder(accountNumber: string, orderNumber: string, orderQuantity: number): Promise<any> {
    try {
      const response = await this.api.post(
        '/uapi/domestic-stock/v1/trading/order-rvsecncl',
        {
          CANO: accountNumber.substring(0, 8),
          ACNT_PRDT_CD: accountNumber.substring(8),
          KRX_FWDG_ORD_ORGNO: '',
          ORGN_ODNO: orderNumber,
          ORD_DVSN: '00',
          RVSE_CNCL_DVSN_CD: '02',
          ORD_QTY: orderQuantity.toString(),
          ORD_UNPR: '0',
        },
        {
          headers: {
            tr_id: 'TTTC0803U',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to cancel order:', error);
      throw error;
    }
  }

  async getOrderHistory(accountNumber: string, startDate?: string, endDate?: string): Promise<any> {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    try {
      const response = await this.api.get(
        '/uapi/domestic-stock/v1/trading/inquire-daily-ccld',
        {
          params: {
            CANO: accountNumber.substring(0, 8),
            ACNT_PRDT_CD: accountNumber.substring(8),
            INQR_STRT_DT: startDate || today,
            INQR_END_DT: endDate || today,
            SLL_BUY_DVSN_CD: '00',
            INQR_DVSN: '00',
            PDNO: '',
            CCLD_DVSN: '00',
            ORD_GNO_BRNO: '',
            ODNO: '',
            INQR_DVSN_3: '00',
            INQR_DVSN_1: '',
            CTX_AREA_FK100: '',
            CTX_AREA_NK100: '',
          },
          headers: {
            tr_id: 'TTTC8001R',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get order history:', error);
      throw error;
    }
  }
}
