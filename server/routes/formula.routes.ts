// formula.routes.ts — 조건식(스크리닝) 및 차트 수식 관리 라우터
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import {
  insertConditionFormulaSchema,
  insertChartFormulaSchema,
  insertFinancialSnapshotSchema,
  type InsertConditionFormula,
} from "@shared/schema";
import { parseFormula } from "../services/formula/parser";
import { FormulaEvaluator } from "../services/formula/evaluator";
import { getKiwoomService } from "../services/kiwoom";
import { z } from "zod";

export function registerFormulaRoutes(app: Router) {
  const kiwoomService = getKiwoomService();

  // 조건식 목록
  app.get("/api/conditions", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      res.json(await storage.getConditionFormulas(user!.id));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 조건식 생성
  app.post("/api/conditions", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      let formulaAst;
      try {
        formulaAst = req.body.rawFormula ? parseFormula(req.body.rawFormula) : { type: "empty", body: [] };
      } catch (e: any) {
        return res.status(400).json({ error: "Invalid formula syntax", details: e.message });
      }
      const data = insertConditionFormulaSchema.parse({
        conditionName: req.body.conditionName,
        description: req.body.description,
        marketType: req.body.marketType || "ALL",
        rawFormula: req.body.rawFormula,
        isActive: req.body.isActive ?? false,
        isRealTimeMonitoring: req.body.isRealTimeMonitoring ?? false,
        userId: user!.id,
        formulaAst,
      });
      res.status(201).json(await storage.createConditionFormula(data));
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", details: error.errors });
      res.status(500).json({ error: "Failed to create condition formula" });
    }
  });

  // 조건식 단건 조회
  app.get("/api/conditions/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const condition = await storage.getConditionFormula(parseInt(req.params.id));
      if (!condition) return res.status(404).json({ error: "Condition formula not found" });
      if (condition.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });
      res.json(condition);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 조건식 수정
  app.put("/api/conditions/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const conditionId = parseInt(req.params.id);
      const existing = await storage.getConditionFormula(conditionId);
      if (!existing) return res.status(404).json({ error: "Condition formula not found" });
      if (existing.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });

      const update: Partial<InsertConditionFormula> = {};
      if (req.body.conditionName !== undefined) update.conditionName = req.body.conditionName;
      if (req.body.description !== undefined) update.description = req.body.description;
      if (req.body.marketType !== undefined) update.marketType = req.body.marketType;
      if (req.body.isActive !== undefined) update.isActive = req.body.isActive;
      if (req.body.isRealTimeMonitoring !== undefined) update.isRealTimeMonitoring = req.body.isRealTimeMonitoring;
      if (req.body.rawFormula !== undefined) {
        update.rawFormula = req.body.rawFormula;
        try {
          update.formulaAst = req.body.rawFormula ? parseFormula(req.body.rawFormula) : { type: "empty", body: [] };
        } catch (e: any) {
          return res.status(400).json({ error: "Invalid formula syntax", details: e.message });
        }
      }

      const validated = insertConditionFormulaSchema.partial().parse(update);
      res.json(await storage.updateConditionFormula(conditionId, validated));
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", details: error.errors });
      res.status(500).json({ error: "Failed to update condition formula" });
    }
  });

  // 조건식 삭제
  app.delete("/api/conditions/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const conditionId = parseInt(req.params.id);
      const existing = await storage.getConditionFormula(conditionId);
      if (!existing) return res.status(404).json({ error: "Condition formula not found" });
      if (existing.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });
      await storage.deleteConditionFormula(conditionId);
      res.json({ message: "Condition formula deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 조건식 실행 (종목 스크리닝)
  app.post("/api/conditions/:id/run", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const conditionId = parseInt(req.params.id);
      const condition = await storage.getConditionFormula(conditionId);
      if (!condition) return res.status(404).json({ error: "Condition formula not found" });
      if (condition.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });

      const searchResponse = await kiwoomService.getConditionSearchResults(condition.conditionName, 0);
      const results = searchResponse?.output1 || searchResponse?.output || [];

      for (const result of results) {
        const stockCode = (result as any).stock_code || (result as any).stck_cd;
        const stockName = (result as any).stock_name || (result as any).stck_nm;
        const currentPrice = (result as any).current_price || (result as any).stck_prpr;
        const changeRate = (result as any).change_rate || (result as any).prdy_ctrt;
        if (!stockCode || !stockName) continue;
        await storage.createConditionResult({
          conditionId, stockCode, stockName,
          matchScore: null, currentPrice: currentPrice || null,
          changeRate: changeRate || null, volume: null,
          passedFilters: true, metadata: result as any,
        });
      }

      await storage.updateConditionFormula(conditionId, { matchCount: results.length, lastMatchedAt: new Date() });
      res.json({ message: "Condition search executed successfully", matchCount: results.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 조건식 결과 조회
  app.get("/api/conditions/:id/results", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const conditionId = parseInt(req.params.id);
      const condition = await storage.getConditionFormula(conditionId);
      if (!condition) return res.status(404).json({ error: "Condition formula not found" });
      if (condition.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });
      res.json(await storage.getConditionResults(conditionId));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 차트 수식 목록
  app.get("/api/chart-formulas", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      res.json(await storage.getChartFormulas(user!.id));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 차트 수식 생성
  app.post("/api/chart-formulas", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const { rawFormula, ...rest } = req.body;
      if (!rawFormula) return res.status(400).json({ error: "Formula text is required" });
      let formulaAst;
      try { formulaAst = parseFormula(rawFormula); }
      catch (e: any) { return res.status(400).json({ error: "Invalid formula syntax", details: e.message }); }
      const data = insertChartFormulaSchema.parse({ ...rest, userId: user!.id, rawFormula, formulaAst });
      res.status(201).json(await storage.createChartFormula(data));
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", details: error.errors });
      res.status(500).json({ error: "Failed to create chart formula" });
    }
  });

  // 차트 수식 단건 조회
  app.get("/api/chart-formulas/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const formula = await storage.getChartFormula(parseInt(req.params.id));
      if (!formula) return res.status(404).json({ error: "Chart formula not found" });
      if (formula.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });
      res.json(formula);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 차트 수식 수정
  app.put("/api/chart-formulas/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const formulaId = parseInt(req.params.id);
      const existing = await storage.getChartFormula(formulaId);
      if (!existing) return res.status(404).json({ error: "Chart formula not found" });
      if (existing.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });
      const updates: any = { ...req.body };
      if (req.body.rawFormula) {
        try { updates.formulaAst = parseFormula(req.body.rawFormula); }
        catch (e: any) { return res.status(400).json({ error: "Invalid formula syntax", details: e.message }); }
      }
      res.json(await storage.updateChartFormula(formulaId, updates));
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", details: error.errors });
      res.status(500).json({ error: "Failed to update chart formula" });
    }
  });

  // 차트 수식 삭제
  app.delete("/api/chart-formulas/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const formulaId = parseInt(req.params.id);
      const existing = await storage.getChartFormula(formulaId);
      if (!existing) return res.status(404).json({ error: "Chart formula not found" });
      if (existing.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });
      await storage.deleteChartFormula(formulaId);
      res.json({ message: "Chart formula deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 차트 수식 평가 (백테스트)
  app.post("/api/chart-formulas/:id/evaluate", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const formulaId = parseInt(req.params.id);
      const formula = await storage.getChartFormula(formulaId);
      if (!formula) return res.status(404).json({ error: "Chart formula not found" });
      if (formula.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });

      const { stockCode, period = "D" } = req.body;
      if (!stockCode) return res.status(400).json({ error: "Stock code is required" });

      const chartData = await kiwoomService.getStockChart(stockCode, period);
      const ohlcvData = (chartData.output2 || []).map((c: any) => ({
        date: c.stck_bsop_date || "",
        open: parseFloat(c.stck_oprc) || 0,
        high: parseFloat(c.stck_hgpr) || 0,
        low: parseFloat(c.stck_lwpr) || 0,
        close: parseFloat(c.stck_clpr) || 0,
        volume: parseInt(c.acml_vol) || 0,
      }));

      const evaluator = new FormulaEvaluator();
      const results = evaluator.evaluate(formula.formulaAst as any, ohlcvData);

      res.json({
        stockCode, period,
        formulaName: formula.formulaName,
        signalLine: {
          color: formula.color || "green",
          name: formula.formulaName,
          values: ohlcvData.map((d: any, i: number) => ({ date: d.date, value: results[i] })),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to evaluate chart formula" });
    }
  });

  // 종목 재무 데이터 조회
  app.get("/api/stocks/:code/fundamentals", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getFinancialSnapshots(req.params.code));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 재무 데이터 동기화
  app.post("/api/stocks/sync-financials", isAuthenticated, async (req, res) => {
    try {
      const { stockCodes } = req.body;
      if (!Array.isArray(stockCodes) || stockCodes.length === 0) {
        return res.status(400).json({ error: "Stock codes array is required" });
      }
      const results = [];
      for (const stockCode of stockCodes) {
        try {
          const financialData = await kiwoomService.getFinancialStatements(stockCode);
          if (financialData.output && Array.isArray(financialData.output)) {
            for (const yearData of financialData.output) {
              const fiscalYear = parseInt(yearData.stac_yymm?.substring(0, 4) || "0");
              if (fiscalYear > 0) {
                const snap = insertFinancialSnapshotSchema.parse({
                  stockCode, fiscalYear,
                  revenue: yearData.sale_account || null,
                  operatingProfit: yearData.bsop_prti || null,
                  netIncome: yearData.ntin || null,
                  totalAssets: yearData.total_aset || null,
                  totalLiabilities: yearData.total_lblt || null,
                  totalEquity: yearData.cpfn || null,
                  debtRatio: null, roe: null, roa: null, isHealthy: true,
                });
                const existing = await storage.getFinancialSnapshot(stockCode, fiscalYear);
                existing ? await storage.updateFinancialSnapshot(existing.id, snap) : await storage.createFinancialSnapshot(snap);
              }
            }
          }
          results.push({ stockCode, success: true });
        } catch (e: any) {
          results.push({ stockCode, success: false, error: e.message });
        }
      }
      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 장이슈 종목 조회
  app.get("/api/market-issues", isAuthenticated, async (req, res) => {
    try {
      const dateParam = req.query.date as string;
      const issueDate = dateParam || new Date().toISOString().split("T")[0].replace(/-/g, "");
      res.json(await storage.getMarketIssues(issueDate));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 종목별 장이슈 조회
  app.get("/api/market-issues/stock/:code", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getMarketIssuesByStock(req.params.code));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

