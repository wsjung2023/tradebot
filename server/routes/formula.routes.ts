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
import { AgentTimeoutError } from "../services/agent-proxy.service";
import { getUserKiwoomService } from "../services/user-kiwoom.service";
import { z } from "zod";
import { normalizeChartDataAsc } from "../utils/chart-normalization";

export function registerFormulaRoutes(app: Router) {
  const userKiwoomService = getUserKiwoomService();

  const getConditionListForUser = async (userId: string) => userKiwoomService.getConditionList(userId);
  const getConditionSearchResultsForUser = async (userId: string, seq: string) => userKiwoomService.runCondition(userId, seq);

  // 키움 조건식 목록
  app.get("/api/kiwoom/conditions", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const conditions = await getConditionListForUser(user!.id);
      res.json(conditions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 키움 조건검색 실행
  app.post("/api/kiwoom/conditions/:seq/run", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const results = await getConditionSearchResultsForUser(user!.id, req.params.seq);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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

  // 키움 HTS 조건검색식 목록을 가져와서 tradebot 조건식으로 저장
  app.get("/api/conditions/hts-list", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const list = await getConditionListForUser(user!.id);
      if (!Array.isArray(list) || list.length === 0) {
        return res.json({ imported: 0, conditions: [] });
      }
      const existing = await storage.getConditionFormulas(user!.id);
      const existingNames = new Set(existing.map((c) => c.conditionName));
      const toImport = list.filter((c: any) => !existingNames.has(c.condition_name));
      const imported = await Promise.all(
        toImport.map((c: any) =>
          storage.createConditionFormula({
            conditionName: c.condition_name,
            description: `HTS 조건검색식 (seq: ${c.condition_index})`,
            marketType: "ALL",
            rawFormula: `hts:${c.condition_index}`,
            isActive: false,
            isRealTimeMonitoring: false,
            userId: user!.id,
            formulaAst: { type: "hts", seq: c.condition_index },
          })
        )
      );
      res.json({ imported: imported.length, conditions: imported });
    } catch (error: any) {
      console.error("[hts-list] 조건식 불러오기 실패:", error?.message ?? error);
      res.status(500).json({ error: error.message });
    }
  });

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

      // formula_ast.seq 에서 먼저 읽기 (가장 신뢰할 수 있는 소스)
      const formulaAst = (condition as any).formulaAst as any;
      let conditionSeq = String(
        (condition as any).kiwoomSeq ??
        formulaAst?.seq ??
        ""
      ).trim();

      if (!conditionSeq) {
        // rawFormula가 "hts:30" 형태이면 파싱
        const rawFormula = String((condition as any).rawFormula ?? "");
        const htsMatch = rawFormula.match(/^hts:(\d+)$/);
        if (htsMatch) {
          conditionSeq = htsMatch[1];
        }
      }

      if (!conditionSeq) {
        try {
          const rows = await getConditionListForUser(user!.id);
          const matched = rows.find((row: any) => row.condition_name === condition.conditionName);
          if (matched) {
            conditionSeq = String(matched.condition_index);
          }
        } catch (seqResolveError) {
          console.warn("[Formula] Kiwoom 조건식 seq 자동해결 실패:", seqResolveError);
        }
      }

      if (!conditionSeq) {
        return res.status(400).json({ error: "조건식 seq를 확인할 수 없습니다." });
      }

      console.log(`[Formula] 조건식 실행: id=${conditionId} name=${condition.conditionName} seq=${conditionSeq}`);

      const results = await getConditionSearchResultsForUser(user!.id, conditionSeq);

      for (const result of results) {
        const stockCode = (result as any).stock_code || (result as any).stck_cd;
        const stockName = (result as any).stock_name || (result as any).stck_nm;
        const rawPrice = (result as any).current_price || (result as any).stck_prpr;
        const rawRate = (result as any).change_rate || (result as any).prdy_ctrt;
        if (!stockCode || !stockName) continue;

        let parsedPrice: string | null = null;
        if (rawPrice != null) {
          const n = parseFloat(String(rawPrice));
          if (!isNaN(n)) parsedPrice = String(Math.min(Math.abs(n), 9999999999.99));
        }
        let parsedRate: string | null = null;
        if (rawRate != null) {
          const n = parseFloat(String(rawRate));
          if (!isNaN(n)) parsedRate = String(Math.max(-9999.9999, Math.min(9999.9999, n)));
        }

        await storage.createConditionResult({
          conditionId, stockCode, stockName,
          matchScore: null, currentPrice: parsedPrice, 
          changeRate: parsedRate, volume: null,
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

      const chartData = await userKiwoomService.getChart(user!.id, stockCode, period, 250);
      const ohlcvData = normalizeChartDataAsc(chartData);

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
      const user = getCurrentUser(req);
      const { stockCodes } = req.body;
      if (!Array.isArray(stockCodes) || stockCodes.length === 0) {
        return res.status(400).json({ error: "Stock codes array is required" });
      }
      const results = [];
      for (const stockCode of stockCodes) {
        try {
          const financialData = await userKiwoomService.getFinancials(user!.id, stockCode);
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
