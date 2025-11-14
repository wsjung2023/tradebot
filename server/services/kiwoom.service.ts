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

interface ConditionListResponse {
  output: Array<{
    condition_name: string; // 조건검색식 이름
    condition_index: number; // 조건검색식 인덱스
  }>;
}

interface ConditionSearchResultsResponse {
  output1?: Array<{
    stck_cd: string; // 종목코드
    stck_nm: string; // 종목명
    stck_prpr: string; // 현재가
    prdy_ctrt: string; // 등락률
  }>;
  output?: Array<{
    stock_code: string; // 종목코드 (alternative format)
    stock_name: string; // 종목명 (alternative format)
    current_price: string; // 현재가 (alternative format)
    change_rate: string; // 등락률 (alternative format)
  }>;
}

interface FinancialStatementsResponse {
  output: Array<{
    stac_yymm: string; // 결산년월
    sale_account: string; // 매출액
    sale_cost: string; // 매출원가
    sale_totl_prfi: string; // 매출총이익
    bsop_prti: string; // 영업이익
    ntin: string; // 당기순이익
    total_aset: string; // 총자산
    total_lblt: string; // 총부채
    cpfn: string; // 자본금
  }>;
}

interface FinancialRatiosResponse {
  output: {
    roe: string; // 자기자본이익률
    roa: string; // 총자산이익률
    debt_ratio: string; // 부채비율
    reserve_ratio: string; // 유보율
    eps: string; // 주당순이익
    per: string; // 주가수익비율
    bps: string; // 주당순자산
    pbr: string; // 주가순자산비율
  };
}

interface MarketIssuesResponse {
  output: Array<{
    stock_code: string; // 종목코드
    stock_name: string; // 종목명
    issue_type: string; // 이슈구분
    issue_title: string; // 이슈제목
    current_price: string; // 현재가
    change_rate: string; // 등락률
    trading_volume: string; // 거래량
  }>;
}

interface ThemeStocksResponse {
  output: Array<{
    stock_code: string; // 종목코드
    stock_name: string; // 종목명
    current_price: string; // 현재가
    change_rate: string; // 등락률
    trading_volume: string; // 거래량
    market_cap: string; // 시가총액
  }>;
}

interface HighVolumeStocksResponse {
  output: Array<{
    rank: string; // 순위
    stock_code: string; // 종목코드
    stock_name: string; // 종목명
    current_price: string; // 현재가
    change_rate: string; // 등락률
    trading_volume: string; // 거래량
    trading_value: string; // 거래대금
  }>;
}

export class KiwoomService {
  private api: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private appKey: string;
  private appSecret: string;
  private stubMode: boolean = false;

  constructor(config: KiwoomConfig) {
    this.appKey = config.appKey;
    this.appSecret = config.appSecret;
    
    // Enable stub mode if credentials are placeholder/missing
    if (!config.appKey || !config.appSecret || 
        config.appKey === 'stub' || config.appSecret === 'stub') {
      this.stubMode = true;
      console.log('⚠️  KiwoomService running in STUB mode (no real API calls)');
    }
    
    this.api = axios.create({
      baseURL: config.baseURL || 'https://openapi.kiwoom.com:9443',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

    // Add request interceptor for authentication
    this.api.interceptors.request.use(async (config) => {
      if (this.stubMode) return config; // Skip auth in stub mode
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
    if (this.stubMode) {
      // Generate random but realistic stock price data
      const basePrice = 70000 + Math.random() * 10000;
      const change = (Math.random() - 0.5) * 5000;
      return {
        output: {
          stck_prpr: Math.round(basePrice).toString(),
          prdy_vrss: Math.round(change).toString(),
          prdy_vrss_sign: change >= 0 ? '2' : '5',
          prdy_ctrt: ((change / basePrice) * 100).toFixed(2),
          acml_vol: Math.floor(Math.random() * 10000000).toString(),
          stck_oprc: Math.round(basePrice - 1000).toString(),
          stck_hgpr: Math.round(basePrice + 2000).toString(),
          stck_lwpr: Math.round(basePrice - 2000).toString(),
        },
      };
    }
    
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
    if (this.stubMode) {
      // Generate realistic orderbook data
      const basePrice = 70000 + Math.random() * 10000;
      const buyOrders = [];
      const sellOrders = [];
      
      for (let i = 0; i < 10; i++) {
        buyOrders.push({
          price: Math.round(basePrice - (i + 1) * 100),
          quantity: Math.floor(Math.random() * 1000) + 100,
        });
        sellOrders.push({
          price: Math.round(basePrice + (i + 1) * 100),
          quantity: Math.floor(Math.random() * 1000) + 100,
        });
      }
      
      return { buy: buyOrders, sell: sellOrders };
    }
    
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

  async getStockChart(stockCode: string, period: string = 'D', bars: number = 250): Promise<any> {
    if (this.stubMode) {
      // Generate chart data (default 250 bars for rainbow chart analysis)
      const chartData = [];
      let basePrice = 70000 + Math.random() * 10000;
      const today = new Date();
      
      // Simulate realistic price movements
      for (let i = bars - 1; i >= 0; i--) {
        const date = new Date(today);
        
        // Adjust date based on period
        if (period === 'D' || !period) {
          // Daily: subtract days
          date.setDate(date.getDate() - i);
        } else if (period === 'W') {
          // Weekly: subtract weeks (7 days each)
          date.setDate(date.getDate() - (i * 7));
        } else if (period === 'M') {
          // Monthly: subtract months
          date.setMonth(date.getMonth() - i);
        } else if (period.match(/^\d+$/)) {
          // Minute chart (e.g., '1', '3', '5', '10', '30', '60')
          date.setMinutes(date.getMinutes() - (i * parseInt(period, 10)));
        }
        
        const dailyChange = (Math.random() - 0.5) * 0.05;
        basePrice = basePrice * (1 + dailyChange);
        
        const open = basePrice;
        const high = basePrice * (1 + Math.random() * 0.02);
        const low = basePrice * (1 - Math.random() * 0.02);
        const close = low + Math.random() * (high - low);
        
        chartData.push({
          date: date.toISOString().split('T')[0],
          open: Math.round(open),
          high: Math.round(high),
          low: Math.round(low),
          close: Math.round(close),
          volume: Math.floor(Math.random() * 10000000),
        });
      }
      
      return chartData;
    }
    
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

  // ==================== Condition Search APIs (조건검색) ====================

  /**
   * Get list of user's saved condition formulas from Kiwoom HTS
   * @returns List of condition formulas with name and index
   */
  async getConditionList(): Promise<ConditionListResponse> {
    try {
      const response = await this.api.get<ConditionListResponse>(
        '/uapi/domestic-stock/v1/quotations/inquire-condition-list',
        {
          headers: {
            tr_id: 'OPT10075',
          },
        }
      );
      console.log('Condition list response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to get condition list:', error);
      throw error;
    }
  }

  /**
   * Get stocks matching a specific condition formula
   * @param conditionName - Name of the condition formula
   * @param conditionIndex - Index of the condition formula
   * @returns List of stocks matching the condition
   */
  async getConditionSearchResults(
    conditionName: string,
    conditionIndex: number
  ): Promise<ConditionSearchResultsResponse> {
    try {
      const response = await this.api.get<ConditionSearchResultsResponse>(
        '/uapi/domestic-stock/v1/quotations/inquire-condition-search',
        {
          params: {
            FID_COND_NM: conditionName,
            FID_COND_IDX: conditionIndex.toString(),
            FID_COND_SCR_DIV_CD: '0',
          },
          headers: {
            tr_id: 'OPT10076',
          },
        }
      );
      console.log('Condition search results:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to get condition search results:', error);
      throw error;
    }
  }

  /**
   * Start real-time monitoring for a condition formula
   * NOTE: This requires WebSocket connection for real-time updates
   * @param conditionName - Name of the condition formula
   * @param conditionIndex - Index of the condition formula
   * @returns Registration result
   */
  async startConditionMonitoring(
    conditionName: string,
    conditionIndex: number
  ): Promise<any> {
    try {
      const response = await this.api.post(
        '/uapi/domestic-stock/v1/quotations/register-condition-realtime',
        {
          FID_COND_NM: conditionName,
          FID_COND_IDX: conditionIndex.toString(),
          FID_COND_SCR_DIV_CD: '1',
        },
        {
          headers: {
            tr_id: 'OPT10077',
          },
        }
      );
      console.log('Condition monitoring started:', response.data);
      console.log('NOTE: Real-time updates require WebSocket connection');
      return response.data;
    } catch (error) {
      console.error('Failed to start condition monitoring:', error);
      throw error;
    }
  }

  // ==================== Financial Statement APIs (재무제표) ====================

  /**
   * Get financial statements for a stock (3-year data)
   * Returns revenue, profit, assets, liabilities, and other financial data
   * @param stockCode - Stock code (e.g., "005930" for Samsung Electronics)
   * @returns 3 years of financial statement data
   */
  async getFinancialStatements(stockCode: string): Promise<FinancialStatementsResponse> {
    try {
      const response = await this.api.get<FinancialStatementsResponse>(
        '/uapi/domestic-stock/v1/finance/financial-statements',
        {
          params: {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_INPUT_ISCD: stockCode,
            FID_DIV_CLS_CODE: '0',
          },
          headers: {
            tr_id: 'FHKST03030100',
          },
        }
      );
      console.log('Financial statements response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to get financial statements:', error);
      throw error;
    }
  }

  /**
   * Get detailed financial ratios for a stock
   * Returns ROE, ROA, debt ratio, EPS, PER, BPS, PBR, etc.
   * @param stockCode - Stock code (e.g., "005930" for Samsung Electronics)
   * @returns Financial ratios and indicators
   */
  async getFinancialRatios(stockCode: string): Promise<FinancialRatiosResponse> {
    try {
      const response = await this.api.get<FinancialRatiosResponse>(
        '/uapi/domestic-stock/v1/finance/financial-ratios',
        {
          params: {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_INPUT_ISCD: stockCode,
          },
          headers: {
            tr_id: 'FHKST03140100',
          },
        }
      );
      console.log('Financial ratios response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to get financial ratios:', error);
      throw error;
    }
  }

  // ==================== Market Issue APIs (시장이슈종목) ====================

  /**
   * Get today's market issue stocks
   * Returns stocks that are in focus due to market events, news, or themes
   * @returns List of market issue stocks with issue type and details
   */
  async getMarketIssues(): Promise<MarketIssuesResponse> {
    try {
      const response = await this.api.get<MarketIssuesResponse>(
        '/uapi/domestic-stock/v1/quotations/market-issues',
        {
          params: {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_ISSUE_DIV_CODE: '0',
          },
          headers: {
            tr_id: 'FHKST01020400',
          },
        }
      );
      console.log('Market issues response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to get market issues:', error);
      throw error;
    }
  }

  /**
   * Get stocks in a specific theme or sector
   * @param themeCode - Theme code (e.g., "001" for semiconductor, "002" for battery)
   * @returns List of stocks in the specified theme
   */
  async getThemeStocks(themeCode: string): Promise<ThemeStocksResponse> {
    try {
      const response = await this.api.get<ThemeStocksResponse>(
        '/uapi/domestic-stock/v1/quotations/theme-stocks',
        {
          params: {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_THEME_CLS_CODE: themeCode,
          },
          headers: {
            tr_id: 'FHKST01020300',
          },
        }
      );
      console.log('Theme stocks response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to get theme stocks:', error);
      throw error;
    }
  }

  // ==================== Liquidity/Volume APIs (유동성) ====================

  /**
   * Get stocks with high trading volume
   * Returns top 100 stocks by trading volume for the specified market
   * @param market - Market filter: 'ALL' (전체), 'KOSPI' (코스피), 'KOSDAQ' (코스닥)
   * @returns Top 100 stocks sorted by trading volume
   */
  async getHighVolumeStocks(
    market: 'ALL' | 'KOSPI' | 'KOSDAQ' = 'ALL'
  ): Promise<HighVolumeStocksResponse> {
    const marketCode = market === 'KOSPI' ? '0' : market === 'KOSDAQ' ? '1' : '';
    
    try {
      const response = await this.api.get<HighVolumeStocksResponse>(
        '/uapi/domestic-stock/v1/quotations/high-volume-stocks',
        {
          params: {
            FID_COND_MRKT_DIV_CODE: marketCode || 'J',
            FID_COND_SCR_DIV_CODE: '20171',
            FID_INPUT_ISCD: '0000',
            FID_DIV_CLS_CODE: '0',
            FID_BLNG_CLS_CODE: marketCode,
            FID_TRGT_CLS_CODE: '111111111',
            FID_TRGT_EXLS_CLS_CODE: '000000',
            FID_INPUT_PRICE_1: '',
            FID_INPUT_PRICE_2: '',
            FID_VOL_CNT: '',
            FID_INPUT_DATE_1: '',
          },
          headers: {
            tr_id: 'FHKST01020900',
          },
        }
      );
      console.log('High volume stocks response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to get high volume stocks:', error);
      throw error;
    }
  }
}

// Singleton instance
let kiwoomServiceInstance: KiwoomService | null = null;

export function getKiwoomService(): KiwoomService {
  if (!kiwoomServiceInstance) {
    const appKey = process.env.KIWOOM_APP_KEY || 'stub';
    const appSecret = process.env.KIWOOM_APP_SECRET || 'stub';

    kiwoomServiceInstance = new KiwoomService({
      appKey,
      appSecret,
    });
  }

  return kiwoomServiceInstance;
}
