// trading.routes.ts — 주식 시세 조회, 주문 실행 및 거래 내역 라우터
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertOrderSchema } from "@shared/schema";
import { getKiwoomService } from "../services/kiwoom";

export function registerTradingRoutes(app: Router) {
  const kiwoomService = getKiwoomService();

  type ChartSignalOverlay = {
    id: number;
    conditionId: number;
    conditionName: string;
    stockCode: string;
    stockName: string;
    signal: "buy" | "hold";
    matchScore: number;
    currentPrice: number | null;
    createdAt: string;
    chartDate: string;
  };

  // 주가 조회
  app.get("/api/stocks/:stockCode/price", isAuthenticated, async (req, res) => {
    try {
      const price = await kiwoomService.getStockPrice(req.params.stockCode);
      res.json(price);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 호가 조회
  app.get("/api/stocks/:stockCode/orderbook", isAuthenticated, async (req, res) => {
    try {
      const orderbook = await kiwoomService.getStockOrderbook(req.params.stockCode);
      res.json(orderbook);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 차트 조회
  app.get("/api/stocks/:stockCode/chart", isAuthenticated, async (req, res) => {
    try {
      const period = (req.query.period as string) || "D";
      const chart = await kiwoomService.getStockChart(req.params.stockCode, period);
      res.json(chart);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 종목 검색
  app.get("/api/stocks/search", isAuthenticated, async (req, res) => {
    try {
      const keyword = (req.query.query ?? req.query.q ?? "") as string;
      if (!keyword.trim()) return res.json([]);
      const results = await kiwoomService.searchStock(keyword);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // 종목 기본정보 조회 (코드→이름)
  app.get("/api/stocks/:stockCode/info", isAuthenticated, async (req, res) => {
    try {
      const info = await kiwoomService.getStockInfo(req.params.stockCode);
      res.json(info);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });


  // 차트 시그널 오버레이 조회 (조건검색 결과 기반)
  app.get("/api/stocks/:stockCode/chart-signals", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const stockCode = req.params.stockCode;
      const limit = Math.min(Math.max(Number(req.query.limit ?? 100) || 100, 1), 500);
      const formulas = await storage.getConditionFormulas(user!.id);

      const resultsByFormula = await Promise.all(
        formulas.map(async (formula) => ({
          formula,
          results: await storage.getConditionResults(formula.id),
        })),
      );

      const overlays: ChartSignalOverlay[] = [];

      for (const { formula, results } of resultsByFormula) {
        for (const row of results) {
          if (row.stockCode !== stockCode) continue;
          const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as any);
          const score = Number(row.matchScore ?? 0);
          const chartDate = Number.isNaN(createdAt.getTime())
            ? ""
            : createdAt.toISOString().slice(0, 10).replace(/-/g, "");

          overlays.push({
            id: row.id,
            conditionId: formula.id,
            conditionName: formula.conditionName,
            stockCode: row.stockCode,
            stockName: row.stockName,
            signal: score >= 70 ? "buy" : "hold",
            matchScore: score,
            currentPrice: row.currentPrice !== null ? Number(row.currentPrice) : null,
            createdAt: createdAt.toISOString(),
            chartDate,
          });
        }
      }

      overlays.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      res.json(overlays.slice(-limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 주문 실행
  app.post("/api/orders", isAuthenticated, async (req, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(orderData);
      const account = await storage.getKiwoomAccount(orderData.accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const kiwoomOrder = await kiwoomService.placeOrder({
        accountNumber: account.accountNumber,
        stockCode: orderData.stockCode,
        orderType: orderData.orderType,
        orderQuantity: orderData.orderQuantity,
        orderPrice: orderData.orderPrice ? parseFloat(orderData.orderPrice) : undefined,
        orderMethod: orderData.orderMethod as "market" | "limit",
      });

      const updatedOrder = await storage.updateOrder(order.id, {
        orderNumber: kiwoomOrder.output?.ODNO || kiwoomOrder.output?.ord_no,
      });

      await storage.createTradingLog({
        accountId: orderData.accountId,
        action: "place_order",
        details: { order: updatedOrder, kiwoomResponse: kiwoomOrder },
        success: true,
      });

      res.json(updatedOrder);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // 전체 주문 내역 조회 (모든 계좌)
  app.get("/api/all-orders", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accounts = await storage.getKiwoomAccounts(user!.id);
      if (accounts.length === 0) return res.json([]);

      const allOrders = await Promise.all(accounts.map((a) => storage.getOrders(a.id)));
      const orders = allOrders.flat().sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 거래 로그 조회
  app.get("/api/trading-logs", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accounts = await storage.getKiwoomAccounts(user!.id);
      if (accounts.length === 0) return res.json([]);

      const allLogs = await Promise.all(accounts.map((a) => storage.getTradingLogs(a.id)));
      const logs = allLogs.flat().sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

