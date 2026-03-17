// trading.routes.ts - 실시간 시세 조회, 주문 처리 및 거래 로그 라우터
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertOrderSchema } from "@shared/schema";
import { getKiwoomService } from "../services/kiwoom";

// BackAttack 레인보우 라인 계산 (BackAttackLine.md 수식 기반)
function calcRainbowLines(chartItems: { date: string; high: number; low: number; close: number }[]): Record<string, number> | null {
  const PERIOD = 240;
  if (chartItems.length < PERIOD) return null;

  const slice = chartItems.slice(-PERIOD);
  const highs = slice.map((d) => d.high);
  const lows = slice.map((d) => d.low);

  // valuewhen: 최고가 갱신 시점의 (최고가+최저가)/2
  let CL = 0;
  const prevHighest = Math.max(...chartItems.slice(-PERIOD - 1, -1).map((d) => d.high));
  const curHighest = Math.max(...highs);
  const curLowest = Math.min(...lows);

  if (prevHighest < curHighest || CL === 0) {
    CL = (curHighest + curLowest) / 2;
  } else {
    // CL 미갱신 — 전체 배열에서 마지막 갱신 시점 역추적
    let found = false;
    for (let i = chartItems.length - 1; i >= PERIOD; i--) {
      const prev240High = Math.max(...chartItems.slice(i - PERIOD, i).map((d) => d.high));
      const cur240High = Math.max(...chartItems.slice(i - PERIOD + 1, i + 1).map((d) => d.high));
      if (prev240High < cur240High) {
        const highest = cur240High;
        const lowest = Math.min(...chartItems.slice(i - PERIOD + 1, i + 1).map((d) => d.low));
        CL = (highest + lowest) / 2;
        found = true;
        break;
      }
    }
    if (!found) CL = (curHighest + curLowest) / 2;
  }

  // interval = (최고가 - CL) / 5  ← CL 폭 기준
  const highest = curHighest;
  const interval = (highest - CL) / 5;

  return {
    line_max:  highest,
    line_10:   highest - interval * 1,
    line_20:   highest - interval * 2,
    line_30:   highest - interval * 3,
    line_40:   highest - interval * 4,
    line_50:   highest - interval * 5,  // CL
    line_60:   highest - interval * 6,
    line_70:   highest - interval * 7,
    line_80:   highest - interval * 8,
    line_90:   highest - interval * 9,
    line_min:  highest - interval * 10,
    cl_width:  interval > 0 ? Math.round((interval * 2 / highest) * 1000) / 10 : 0,
  };
}

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

  // 최근 거래 조회 (계좌별)
  app.get("/api/accounts/:accountId/trades", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.accountId);
      const account = await storage.getKiwoomAccount(accountId);
      if (!account || account.userId !== user!.id) return res.status(403).json({ error: "Forbidden" });
      
      const logs = await storage.getTradingLogs(accountId, 5);
      const trades = logs
        .filter((log: any) => log.action === "order" && log.success)
        .map((log: any) => ({
          id: log.id,
          stockCode: log.details?.stockCode || "",
          stockName: log.details?.stockName || "",
          side: log.details?.side || "", // buy/sell
          quantity: log.details?.quantity || 0,
          price: log.details?.price || 0,
          amount: (log.details?.quantity || 0) * (log.details?.price || 0),
          profit: log.details?.profit || 0,
          profitRate: log.details?.profitRate || 0,
          createdAt: log.createdAt,
        }));
      res.json(trades);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 시세 조회
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

  // 레인보우 라인 조회 (BackAttack Line, 수식: BackAttackLine.md)
  app.get("/api/stocks/:stockCode/rainbow-lines", isAuthenticated, async (req, res) => {
    try {
      const chartItems = await kiwoomService.getStockChart(req.params.stockCode, "D", 260);
      if (!Array.isArray(chartItems) || chartItems.length < 10) {
        return res.json({ lines: null, message: "데이터 부족" });
      }
      const lines = calcRainbowLines(chartItems);
      res.json({ lines, dataPoints: chartItems.length });
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

  // 종목 기본정보 조회 (자동완성)
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

  // 전체 주문 내역 조회 (계정 통합)
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
  // BackAttack 레인보우 차트 라인 계산 (240봉 기준)
  app.get("/api/stocks/:stockCode/rainbow-lines", isAuthenticated, async (req, res) => {
    try {
      const { stockCode } = req.params;
      const chart = await kiwoomService.getStockChart(stockCode, "D", 260);
      if (!chart || chart.length < 10) return res.json({ lines: null, clWidth: 0 });

      const period = 240;
      const data = chart.slice(-Math.max(chart.length, period + 1));

      // valuewhen: 최고가 갱신 시점에만 CL 업데이트
      let CL = 0;
      for (let i = period; i < data.length; i++) {
        const slice = data.slice(i - period, i + 1);
        const prevSlice = data.slice(i - period, i);
        const curHighest = Math.max(...slice.map((d: any) => d.high));
        const prevHighest = prevSlice.length ? Math.max(...prevSlice.map((d: any) => d.high)) : 0;
        if (prevHighest < curHighest) {
          const lowest = Math.min(...slice.map((d: any) => d.low));
          CL = (curHighest + lowest) / 2;
        }
      }

      const recentSlice = data.slice(-period);
      const highest = Math.max(...recentSlice.map((d: any) => d.high));
      if (CL === 0) CL = (highest + Math.min(...recentSlice.map((d: any) => d.low))) / 2;

      const interval = (highest - CL) / 5;
      const CL1 = highest - interval * 2;
      const clWidth = highest > 0 ? (1 - CL1 / highest) * 100 : 0;

      res.json({
        lines: {
          max:   { price: highest,              label: "최고",  color: "#000000", width: 2 },
          p10:   { price: highest - interval*1, label: "10%",   color: "#9933CC", width: 1 },
          p20:   { price: highest - interval*2, label: "20%",   color: "#FF0000", width: 1 },
          p30:   { price: highest - interval*3, label: "30%",   color: "#FF8C00", width: 1 },
          p40:   { price: highest - interval*4, label: "40%",   color: "#FFD700", width: 1 },
          cl:    { price: highest - interval*5, label: "CL",    color: "#00CC00", width: 2 },
          p60:   { price: highest - interval*6, label: "60%",   color: "#0066FF", width: 1 },
          p70:   { price: highest - interval*7, label: "70%",   color: "#000080", width: 1 },
          p80:   { price: highest - interval*8, label: "80%",   color: "#9933CC", width: 1 },
          p90:   { price: highest - interval*9, label: "90%",   color: "#333333", width: 1 },
          min:   { price: highest - interval*10,label: "최하",  color: "#000000", width: 2 },
        },
        clWidth: Math.round(clWidth * 100) / 100,
        highest,
        CL,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
