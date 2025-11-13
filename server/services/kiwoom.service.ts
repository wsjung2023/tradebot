import axios, { AxiosInstance } from 'axios';

interface KiwoomConfig {
  appKey: string;
  appSecret: string;
  baseURL?: string;
}

interface KiwoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AccountBalanceResponse {
  output1: {
    dnca_tot_amt: string; // 예수금총액
    nxdy_excc_amt: string; // 익일정산금액
    prvs_rcdl_excc_amt: string; // 가수도정산금액
    cma_evlu_amt: string; // CMA평가금액
    tot_evlu_amt: string; // 총평가금액
    pchs_amt_smtl_amt: string; // 매입금액합계금액
    evlu_amt_smtl_amt: string; // 평가금액합계금액
    evlu_pfls_smtl_amt: string; // 평가손익합계금액
  };
  output2: Array<{
    pdno: string; // 상품번호 (종목코드)
    prdt_name: string; // 상품명
    hldg_qty: string; // 보유수량
    pchs_avg_pric: string; // 매입평균가격
    prpr: string; // 현재가
    evlu_pfls_amt: string; // 평가손익금액
    evlu_pfls_rt: string; // 평가손익율
  }>;
}

interface StockPriceResponse {
  output: {
    stck_prpr: string; // 주식현재가
    prdy_vrss: string; // 전일대비
    prdy_vrss_sign: string; // 전일대비부호
    prdy_ctrt: string; // 전일대비율
    acml_vol: string; // 누적거래량
    stck_oprc: string; // 시가
    stck_hgpr: string; // 고가
    stck_lwpr: string; // 저가
  };
}

interface OrderRequest {
  accountNumber: string;
  stockCode: string;
  orderType: 'buy' | 'sell';
  orderQuantity: number;
  orderPrice?: number;
  orderMethod: 'market' | 'limit';
}

interface OrderResponse {
  rt_cd: string; // 응답코드
  msg_cd: string; // 메시지코드
  msg1: string; // 메시지
  output: {
    KRX_FWDG_ORD_ORGNO: string; // 주문번호
    ODNO: string; // 주문번호
    ORD_TMD: string; // 주문시각
  };
}

export class KiwoomService {
  private api: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private appKey: string;
  private appSecret: string;

  constructor(config: KiwoomConfig) {
    this.appKey = config.appKey;
    this.appSecret = config.appSecret;
    
    this.api = axios.create({
      baseURL: config.baseURL || 'https://openapi.kiwoom.com:9443',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

    // Add request interceptor for authentication
    this.api.interceptors.request.use(async (config) => {
      await this.ensureValidToken();
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
        config.headers.appkey = this.appKey;
        config.headers.appsecret = this.appSecret;
      }
      return config;
    });
  }

  private async ensureValidToken(): Promise<void> {
    const now = Date.now();
    if (!this.accessToken || now >= this.tokenExpiry) {
      await this.authenticate();
    }
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await axios.post<KiwoomTokenResponse>(
        'https://openapi.kiwoom.com:9443/oauth2/tokenP',
        {
          grant_type: 'client_credentials',
          appkey: this.appKey,
          appsecret: this.appSecret,
        }
      );

      this.accessToken = response.data.access_token;
      // Set token expiry to 90% of actual expiry time for safety
      this.tokenExpiry = Date.now() + (response.data.expires_in * 900);
    } catch (error) {
      console.error('Kiwoom authentication failed:', error);
      throw new Error('Failed to authenticate with Kiwoom API');
    }
  }

  // ==================== Account Information ====================

  async getAccountBalance(accountNumber: string): Promise<AccountBalanceResponse> {
    try {
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
            tr_id: 'TTTC8434R',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get account balance:', error);
      throw error;
    }
  }

  // ==================== Stock Information ====================

  async getStockPrice(stockCode: string): Promise<StockPriceResponse> {
    try {
      const response = await this.api.get<StockPriceResponse>(
        '/uapi/domestic-stock/v1/quotations/inquire-price',
        {
          params: {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_INPUT_ISCD: stockCode,
          },
          headers: {
            tr_id: 'FHKST01010100',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get stock price:', error);
      throw error;
    }
  }

  async getStockOrderbook(stockCode: string): Promise<any> {
    try {
      const response = await this.api.get(
        '/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn',
        {
          params: {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_INPUT_ISCD: stockCode,
          },
          headers: {
            tr_id: 'FHKST01010200',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get orderbook:', error);
      throw error;
    }
  }

  // ==================== Trading ====================

  async placeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    const {
      accountNumber,
      stockCode,
      orderType,
      orderQuantity,
      orderPrice,
      orderMethod,
    } = orderRequest;

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

  // ==================== Market Data ====================

  async searchStock(keyword: string): Promise<any> {
    try {
      const response = await this.api.get(
        '/uapi/domestic-stock/v1/quotations/search-stock-info',
        {
          params: {
            PRDT_TYPE_CD: '300',
            PDNO: keyword,
          },
          headers: {
            tr_id: 'CTPF1002R',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to search stock:', error);
      throw error;
    }
  }

  async getStockChart(stockCode: string, period: string = 'D'): Promise<any> {
    const endDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    try {
      const response = await this.api.get(
        '/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice',
        {
          params: {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_INPUT_ISCD: stockCode,
            FID_INPUT_DATE_1: endDate,
            FID_INPUT_DATE_2: endDate,
            FID_PERIOD_DIV_CODE: period,
            FID_ORG_ADJ_PRC: '0',
          },
          headers: {
            tr_id: 'FHKST03010100',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get stock chart:', error);
      throw error;
    }
  }
}

// Singleton instance
let kiwoomServiceInstance: KiwoomService | null = null;

export function getKiwoomService(): KiwoomService {
  if (!kiwoomServiceInstance) {
    const appKey = process.env.KIWOOM_APP_KEY;
    const appSecret = process.env.KIWOOM_APP_SECRET;

    if (!appKey || !appSecret) {
      throw new Error('Kiwoom API credentials not configured');
    }

    kiwoomServiceInstance = new KiwoomService({
      appKey,
      appSecret,
    });
  }

  return kiwoomServiceInstance;
}
