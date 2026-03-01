// index.ts — KiwoomService 통합 클래스. 모든 키움 API 메서드를 하나로 제공하는 진입점
import {
  KiwoomBase, KiwoomConfig,
  AccountBalanceResponse, StockPriceResponse,
  OrderRequest, OrderResponse,
  ConditionListResponse, ConditionSearchResultsResponse,
  FinancialStatementsResponse, FinancialRatiosResponse,
  MarketIssuesResponse, ThemeStocksResponse, HighVolumeStocksResponse,
} from "./kiwoom.base";
import { KiwoomAccount } from "./kiwoom.account";
import { KiwoomOrder } from "./kiwoom.order";
import { KiwoomMarket } from "./kiwoom.market";
import { KiwoomCondition } from "./kiwoom.condition";
import { KiwoomFinancial } from "./kiwoom.financial";

// 모든 도메인 클래스를 단일 믹스인으로 합침
export class KiwoomService extends KiwoomBase {
  private account: KiwoomAccount;
  private order: KiwoomOrder;
  private market: KiwoomMarket;
  private condition: KiwoomCondition;
  private financial: KiwoomFinancial;

  constructor(config: KiwoomConfig) {
    super(config);
    this.account = new KiwoomAccount(config);
    this.order = new KiwoomOrder(config);
    this.market = new KiwoomMarket(config);
    this.condition = new KiwoomCondition(config);
    this.financial = new KiwoomFinancial(config);
  }

  // 계좌
  getAccountBalance(accountNumber: string, accountType: "mock" | "real" = "real") {
    return this.account.getAccountBalance(accountNumber, accountType);
  }

  // 시세/차트/검색
  getStockPrice(stockCode: string) { return this.market.getStockPrice(stockCode); }
  getStockOrderbook(stockCode: string) { return this.market.getStockOrderbook(stockCode); }
  getStockChart(stockCode: string, period?: string, bars?: number) { return this.market.getStockChart(stockCode, period, bars); }
  searchStock(keyword: string) { return this.market.searchStock(keyword); }
  getHighVolumeStocks(marketType?: string, limit?: number) { return this.market.getHighVolumeStocks(marketType, limit); }
  getMarketIssues() { return this.market.getMarketIssues(); }
  getThemeStocks(themeCode: string) { return this.market.getThemeStocks(themeCode); }

  // 주문
  placeOrder(orderRequest: OrderRequest) { return this.order.placeOrder(orderRequest); }
  cancelOrder(accountNumber: string, orderNumber: string, orderQuantity: number) { return this.order.cancelOrder(accountNumber, orderNumber, orderQuantity); }
  getOrderHistory(accountNumber: string, startDate?: string, endDate?: string) { return this.order.getOrderHistory(accountNumber, startDate, endDate); }

  // 조건식
  getConditionList() { return this.condition.getConditionList(); }
  getConditionSearchResults(conditionName: string, conditionIndex: number) { return this.condition.getConditionSearchResults(conditionName, conditionIndex); }
  startConditionMonitoring(conditionName: string, conditionIndex: number) { return this.condition.startConditionMonitoring(conditionName, conditionIndex); }

  // 재무
  getFinancialStatements(stockCode: string) { return this.financial.getFinancialStatements(stockCode); }
  getFinancialRatios(stockCode: string) { return this.financial.getFinancialRatios(stockCode); }
}

// 싱글톤 인스턴스
let kiwoomServiceInstance: KiwoomService | null = null;

export function getKiwoomService(): KiwoomService {
  if (!kiwoomServiceInstance) {
    kiwoomServiceInstance = new KiwoomService({
      appKey: process.env.KIWOOM_APP_KEY || "stub",
      appSecret: process.env.KIWOOM_APP_SECRET || "stub",
    });
  }
  return kiwoomServiceInstance;
}

export function createKiwoomService(config: KiwoomConfig): KiwoomService {
  return new KiwoomService(config);
}

export type {
  KiwoomConfig, AccountBalanceResponse, StockPriceResponse,
  OrderRequest, OrderResponse, ConditionListResponse,
  ConditionSearchResultsResponse, FinancialStatementsResponse,
  FinancialRatiosResponse, MarketIssuesResponse, ThemeStocksResponse,
  HighVolumeStocksResponse,
};
