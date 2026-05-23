// trading.routes.ts - 실시간 시세 조회, 주문 처리 및 거래 로그 라우터
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertOrderSchema } from "@shared/schema";
import { AgentTimeoutError } from "../services/agent-proxy.service";
import { getUserKiwoomService } from "../services/user-kiwoom.service";
import { RainbowChartAnalyzer } from "../formula/rainbow-chart";
import { getDartService } from "../services/dart.service";
import { extractErrorDiagnostics } from "../utils/error-diagnostics";

export function registerTradingRoutes(app: Router) {
  const userKiwoomService = getUserKiwoomService();

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
      const user = getCurrentUser(req);
      const price = await userKiwoomService.getPrice(user!.id, req.params.stockCode);
      res.json(price);
    } catch (error: any) {
      if (error instanceof AgentTimeoutError) return res.status(503).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // 호가 조회
  app.get("/api/stocks/:stockCode/orderbook", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const orderbook = await userKiwoomService.getOrderbook(user!.id, req.params.stockCode);
      res.json(orderbook);
    } catch (error: any) {
      if (error instanceof AgentTimeoutError) return res.status(503).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // 차트 조회
  app.get("/api/stocks/:stockCode/chart", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const period = (req.query.period as string) || "D";
      const chart = await userKiwoomService.getChart(user!.id, req.params.stockCode, period);
      res.json(chart);
    } catch (error: any) {
      if (error instanceof AgentTimeoutError) return res.status(503).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // 레인보우 봉별 차트 데이터 (BackAttack Line — per-bar, 동적 선)
  // 반환: OHLCV + line0(MIN)~line10(MAX) 각 봉마다 레인보우 라인 가격, oldest-first 정렬
  app.get("/api/stocks/:stockCode/rainbow-chart", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const period = (req.query.period as string) || "D";
      // 기간별 lookback: 일봉 240봉, 주봉 100봉, 월봉 60봉
      const lookback = period === "M" ? 60 : period === "W" ? 100 : 240;
      const fetchCount = lookback + 200; // lookback + 표시 구간
      const rawData = await userKiwoomService.getChart(user!.id, req.params.stockCode, period, fetchCount);
      const chartItems: any[] = Array.isArray(rawData) ? rawData : (rawData?.items || []);
      if (chartItems.length < lookback) return res.json([]);

      // Kiwoom API → 최신순(newest-first). 수식은 oldest-first 필요
      const oldestFirst = [...chartItems].reverse();

      const perBarData = RainbowChartAnalyzer.computePerBarChartData(oldestFirst, lookback);
      // perBarData는 oldest-first (차트에 바로 사용 가능)
      res.json(perBarData);
    } catch (error: any) {
      if (error instanceof AgentTimeoutError) return res.status(503).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // 레인보우 라인 조회 (현재 스냅샷 — BackAttack Line summary)
  app.get("/api/stocks/:stockCode/rainbow-lines", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const rawData = await userKiwoomService.getChart(user!.id, req.params.stockCode, "D", 260);
      const chartItems: any[] = Array.isArray(rawData) ? rawData : (rawData?.items || []);
      if (chartItems.length < 10) return res.json({ lines: null, clWidth: 0, message: "데이터 부족" });
      if (chartItems.length < 240) return res.json({ lines: null, clWidth: 0, message: "데이터 부족 (240봉 미만)" });

      // Kiwoom API → 최신순(newest-first). 수식은 oldest-first 필요
      const oldestFirst = [...chartItems].reverse();
      const result = RainbowChartAnalyzer.analyze(req.params.stockCode, oldestFirst, 240);

      const COLORS: Record<string, string> = {
        MAX: "#0f172a", "90%": "#334155", "80%": "#1e40af", "70%": "#3b82f6",
        "60%": "#64748b", CL: "#22c55e", "40%": "#64748b", "30%": "#eab308",
        "20%": "#f97316", "10%": "#ef4444", MIN: "#7c3aed",
      };
      const lines = result.lines.map((l) => ({
        label: l.name,
        price: l.price,
        color: COLORS[l.name] ?? "#888888",
        width: l.name === "CL" || l.name === "MAX" || l.name === "MIN" ? 2 : 1,
      }));

      res.json({
        lines,
        clWidth: result.clWidth,
        currentPosition: result.currentPosition,
        CL: result.CL,
        recommendation: result.recommendation,
        dataPoints: chartItems.length,
      });
    } catch (error: any) {
      if (error instanceof AgentTimeoutError) return res.status(503).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // 종목 검색
  app.get("/api/stocks/search", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const keyword = (req.query.query ?? req.query.q ?? "") as string;
      if (!keyword.trim()) return res.json([]);
      const results = await userKiwoomService.searchStock(user!.id, keyword);
      res.json(Array.isArray(results) ? results : (results?.items || []));
    } catch (error: any) {
      if (error instanceof AgentTimeoutError) return res.status(503).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // 종목 기본정보 조회 (자동완성)
  app.get("/api/stocks/:stockCode/info", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const info = await userKiwoomService.getStockInfo(user!.id, req.params.stockCode);
      res.json(info);
    } catch (error: any) {
      if (error instanceof AgentTimeoutError) return res.status(503).json({ error: error.message });
      res.status(404).json({ error: error.message });
    }
  });

  // 종목 상세정보 조회 (기본정보 + 재무비율 통합)
  // GET /api/stocks/:stockCode/details
  app.get("/api/stocks/:stockCode/details", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const stockCode = req.params.stockCode;

      const dartService = getDartService();
      const [infoResult, financialsResult, dartResult] = await Promise.allSettled([
        userKiwoomService.getStockInfo(user!.id, stockCode),
        userKiwoomService.getFinancials(user!.id, stockCode),
        dartService.getFinancialStatements(stockCode),
      ]);

      const info = infoResult.status === "fulfilled" ? infoResult.value : null;
      const financials = financialsResult.status === "fulfilled" ? financialsResult.value : null;
      const dart = dartResult.status === "fulfilled" ? dartResult.value : {};

      // 재무 데이터 정규화 — 에이전트·레거시 모두 대응
      const fin = financials?.output?.[0] || financials?.[0] || financials || {};
      const rawInfo = (info as any)?.raw || info || {};

      const details = {
        stockCode,
        name: (info as any)?.name || (info as any)?.stk_nm || (rawInfo as any)?.stk_nm || stockCode,
        marketName: (info as any)?.marketName || (rawInfo as any)?.mrkt_cls_nm || "",
        currentPrice: (info as any)?.currentPrice || (rawInfo as any)?.cur_prc || 0,
        // 재무비율
        per: (() => {
          const v = Number((rawInfo as any)?.per ?? fin?.per);
          if (v !== 0) return String(v);
          // per=0 (적자 등) → 현재가/EPS로 계산
          const eps = Number((rawInfo as any)?.eps ?? fin?.eps);
          const price = Number((info as any)?.currentPrice ?? (rawInfo as any)?.cur_prc);
          if (eps && price) return (price / eps).toFixed(2);
          return "-";
        })(),
        pbr:    String(fin?.pbr   || (rawInfo as any)?.pbr   || (rawInfo as any)?.PBR   || "-"),
        roe:    String(fin?.roe   || (rawInfo as any)?.roe   || (rawInfo as any)?.ROE   || "-"),
        eps:    String(fin?.eps   || (rawInfo as any)?.eps   || (rawInfo as any)?.EPS   || "-"),
        bps:    String(fin?.bps   || (rawInfo as any)?.bps   || (rawInfo as any)?.BPS   || "-"),
        // 부채비율/유보율: DART 또는 계산
        debtRatio: (() => {
          if ((dart as any)?.totalAssets && (dart as any)?.totalDebt) {
            const equity = Number((dart as any).totalAssets) - Number((dart as any).totalDebt);
            if (equity > 0) return String((Number((dart as any).totalDebt) / equity * 100).toFixed(2));
          }
          return "-";
        })(),
        reserveRatio: (() => {
          const retained = Number((dart as any)?.retainedEarnings);
          const cap = Number((rawInfo as any)?.cap) * 100_000_000 || Number((dart as any)?.capital);
          if (retained && cap) return String((retained / cap * 100).toFixed(2));
          return "-";
        })(),
        // 총자산/총부채: DART
        totalAssets: (dart as any)?.totalAssets || "-",
        totalDebt:   (dart as any)?.totalDebt   || "-",
        // 재무제표: Kiwoom ka10001 (억원→원) + DART fallback
        revenue: (() => {
          const kv = Number((rawInfo as any)?.sale_amt);
          if (kv) return String(kv * 100_000_000);
          return (dart as any)?.revenue || "-";
        })(),
        operatingProfit: (() => {
          const kv = Number((rawInfo as any)?.bus_pro);
          if (kv) return String(kv * 100_000_000);
          return (dart as any)?.operatingProfit || "-";
        })(),
        netIncome: (() => {
          const kv = Number((rawInfo as any)?.cup_nga);
          if (kv) return String(kv * 100_000_000);
          return (dart as any)?.netIncome || "-";
        })(),
        capital: (() => {
          const kv = Number((rawInfo as any)?.cap || fin?.cpfn);
          if (kv) return String(kv * 100_000_000);
          return (dart as any)?.capital || "-";
        })(),
        // 원본 응답 (디버깅용)
        _raw: process.env.NODE_ENV !== "production" ? { info, financials } : undefined,
      };

      res.json(details);
    } catch (error: any) {
      if (error instanceof AgentTimeoutError) return res.status(503).json({ error: error.message });
      res.status(500).json({ error: error.message });
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
    let orderData: any = null;
    let order: any = null;
    let account: any = null;
    const user = getCurrentUser(req);
    try {
      orderData = insertOrderSchema.parse(req.body);
      order = await storage.createOrder(orderData);
      account = await storage.getKiwoomAccount(orderData.accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const kiwoomOrder = await userKiwoomService.placeOrder(user!.id, {
        stockCode: orderData.stockCode,
        orderType: orderData.orderType as "buy" | "sell",
        orderMethod: (orderData.orderMethod as "market" | "limit") || "market",
        orderQuantity: orderData.orderQuantity,
        orderPrice: orderData.orderPrice ? parseFloat(orderData.orderPrice) : undefined,
        accountNumber: account.accountNumber,
      }, orderData.accountId);

      const updatedOrder = await storage.updateOrder(order.id, {
        orderNumber: kiwoomOrder?.output?.ord_no || kiwoomOrder?.output?.ODNO,
      });

      await storage.createTradingLog({
        accountId: orderData.accountId,
        action: "place_order",
        details: { order: updatedOrder, kiwoomResponse: kiwoomOrder },
        success: true,
      });

      // 수동 매매 저널 적재
      const kstDate = new Date(Date.now() + 9 * 3600000);
      const tradeDate = kstDate.toISOString().slice(0, 10).replace(/-/g, '');
      const tradeTime = kstDate.toISOString().slice(11, 19);

      await storage.createTradeJournal({
        userId: user!.id,
        accountId: account.id,
        stockCode: orderData.stockCode,
        stockName: orderData.stockName || orderData.stockCode,
        tradeDate,
        tradeTime,
        tradeType: orderData.orderType === 'buy' ? 'buy' : 'sell',
        price: orderData.orderPrice ? parseFloat(orderData.orderPrice).toFixed(2) : '0',
        quantity: orderData.orderQuantity,
        totalAmount: orderData.orderPrice ? (parseFloat(orderData.orderPrice) * orderData.orderQuantity).toFixed(2) : '0',
        isAutoTrading: false,
        memo: '수동 주문'
      });

      res.json(updatedOrder);
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      const diagnostics = extractErrorDiagnostics(error);

      if (order?.id) {
        try {
          const existingDetails =
            order?.details && typeof order.details === "object" ? (order.details as Record<string, unknown>) : {};
          await storage.updateOrder(order.id, {
            orderStatus: "failed",
            errorMessage: errMsg,
            details: {
              ...existingDetails,
              lastFailure: diagnostics,
            },
          });
        } catch {
          // error_message 칼럼이 없는 구버전 스키마 fallback
          await storage.updateOrder(order.id, { orderStatus: "failed" });
        }
      }

      if (orderData?.accountId) {
        try {
          await storage.createTradingLog({
            accountId: orderData.accountId,
            action: "place_order",
            success: false,
            errorMessage: errMsg,
            details: {
              orderId: order?.id ?? null,
              stockCode: orderData.stockCode ?? null,
              stockName: orderData.stockName ?? null,
              orderType: orderData.orderType ?? null,
              orderQuantity: orderData.orderQuantity ?? null,
              orderPrice: orderData.orderPrice ?? null,
              accountId: account?.id ?? orderData.accountId,
              errorDiagnostics: diagnostics,
            },
          });
        } catch (logErr) {
          console.error("[orders] failed to persist failure trading log:", logErr);
        }
      }

      res.status(400).json({ error: errMsg });
    }
  });

  // 전체 주문 내역 조회 (계정 통합)
  app.get("/api/all-orders", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accounts = await storage.getKiwoomAccounts(user!.id);
      if (accounts.length === 0) return res.json([]);

      const requestedLimit = Number(req.query.limit ?? 1000);
      const perAccountLimit = Number.isFinite(requestedLimit)
        ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 5000)
        : 1000;

      const allOrders = await Promise.all(
        accounts.map((a) => storage.getOrders(a.id, perAccountLimit))
      );
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

  // 매매 저널 (개별 트랜잭션) 조회
  app.get("/api/trade-journal", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const { startDate, endDate, stockCode, tradeType, limit } = req.query;
      
      const entries = await storage.getTradeJournalEntries(user!.id, {
        startDate: startDate as string,
        endDate: endDate as string,
        stockCode: stockCode as string,
        tradeType: tradeType as string,
        limit: limit ? parseInt(limit as string) : undefined
      });
      
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/trading-performance/summary", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const groupBy = (req.query.groupBy as string) || "day";
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const modelIdParam = req.query.modelId ? Number(req.query.modelId) : undefined;

      if (!["day", "month", "stock"].includes(groupBy)) {
        return res.status(400).json({ error: "Invalid groupBy parameter" });
      }
      if (startDate && isNaN(new Date(startDate).getTime())) {
        return res.status(400).json({ error: "Invalid startDate format" });
      }
      if (endDate && isNaN(new Date(endDate).getTime())) {
        return res.status(400).json({ error: "Invalid endDate format" });
      }

      const models = await storage.getAiModels(user!.id);
      if (models.length === 0) return res.json([]);

      const modelIds = modelIdParam
        ? models.filter(m => m.id === modelIdParam).map(m => m.id)
        : models.map(m => m.id);
      if (modelIds.length === 0) return res.json([]);

      const { db: drizzleDb } = await import("../db");
      const { sql } = await import("drizzle-orm");

      const chunks: any[] = [];

      let selectExpr: string;
      let groupExpr: string;
      let orderExpr: string;

      if (groupBy === "month") {
        selectExpr = `to_char(tp.entry_time, 'YYYY-MM') as "groupKey"`;
        groupExpr = `to_char(tp.entry_time, 'YYYY-MM')`;
        orderExpr = `"groupKey" ASC`;
      } else if (groupBy === "stock") {
        selectExpr = `tp.stock_code as "groupKey", tp.stock_name as "stockName"`;
        groupExpr = `tp.stock_code, tp.stock_name`;
        orderExpr = `"totalPnL" DESC`;
      } else {
        selectExpr = `to_char(tp.entry_time, 'YYYY-MM-DD') as "groupKey"`;
        groupExpr = `to_char(tp.entry_time, 'YYYY-MM-DD')`;
        orderExpr = `"groupKey" ASC`;
      }

      chunks.push(sql.raw(`
        SELECT
          ${selectExpr},
          COUNT(*) FILTER (WHERE tp.exit_price IS NULL)::int as "buyCount",
          COUNT(*) FILTER (WHERE tp.exit_price IS NOT NULL)::int as "sellCount",
          COUNT(*)::int as "totalCount",
          COALESCE(SUM(tp.profit_loss), 0)::numeric as "totalPnL",
          CASE WHEN COUNT(*) FILTER (WHERE tp.is_win IS NOT NULL) > 0
            THEN (COUNT(*) FILTER (WHERE tp.is_win = true)::numeric / NULLIF(COUNT(*) FILTER (WHERE tp.is_win IS NOT NULL), 0) * 100)
            ELSE 0
          END as "winRate",
          CASE WHEN COUNT(*) FILTER (WHERE tp.profit_loss_rate IS NOT NULL) > 0
            THEN AVG(tp.profit_loss_rate)
            ELSE 0
          END as "avgProfitRate"
        FROM trading_performance tp
        WHERE tp.model_id IN (`));

      chunks.push(sql.join(modelIds.map(id => sql`${id}`), sql.raw(",")));
      chunks.push(sql.raw(`)`));

      if (startDate) {
        chunks.push(sql` AND tp.entry_time >= ${new Date(startDate)}`);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        chunks.push(sql` AND tp.entry_time < ${end}`);
      }

      chunks.push(sql.raw(`
        GROUP BY ${groupExpr}
        ORDER BY ${orderExpr}
      `));

      const finalQuery = sql.join(chunks, sql.raw(""));
      const result = await drizzleDb.execute(finalQuery);

      const rows = (result as any).rows || result;
      res.json(rows.map((r: any) => ({
        groupKey: r.groupKey,
        stockName: r.stockName || undefined,
        buyCount: Number(r.buyCount) || 0,
        sellCount: Number(r.sellCount) || 0,
        totalCount: Number(r.totalCount) || 0,
        totalPnL: Number(r.totalPnL) || 0,
        winRate: Number(Number(r.winRate).toFixed(1)) || 0,
        avgProfitRate: Number(Number(r.avgProfitRate).toFixed(2)) || 0,
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
