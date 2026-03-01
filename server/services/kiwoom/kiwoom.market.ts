// kiwoom.market.ts — 키움증권 시세 조회, 차트, 종목 검색, 거래량 상위, 장이슈 메서드
import { KiwoomBase, type StockPriceResponse, type MarketIssuesResponse, type ThemeStocksResponse, type HighVolumeStocksResponse } from "./kiwoom.base";

export class KiwoomMarket extends KiwoomBase {
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
