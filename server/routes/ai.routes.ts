// ai.routes.ts — AI 분석, AI 모델 관리 및 학습 통계 라우터
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertAiModelSchema, updateAiModelSchema } from "@shared/schema";
import { getAIService } from "../services/ai.service";
import { getNewsService } from "../services/news.service";
import { getKiwoomService } from "../services/kiwoom";
import { getAICouncilService } from "../services/ai-council.service";
import { getFeatureFlags } from "../config/feature-flags";

export function registerAiRoutes(app: Router) {
  const aiService = getAIService();
  const newsService = getNewsService();
  const kiwoomService = getKiwoomService();
  const aiCouncilService = getAICouncilService();
  const featureFlags = getFeatureFlags();

  // ─── 종목 뉴스 조회 ─────────────────────────────────────────────────────────
  app.get("/api/news/stock/:stockCode", isAuthenticated, async (req, res) => {
    try {
      const { stockCode } = req.params;
      const stockName = (req.query.name as string) || stockCode;
      const count = Math.min(parseInt(req.query.count as string) || 10, 20);
      const news = await newsService.getStockNews(stockCode, stockName, count);
      res.json(news);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── 통합 분석 (뉴스 + 재무 + 기술) ─────────────────────────────────────────
  app.post("/api/ai/integrated-analysis", isAuthenticated, async (req, res) => {
    try {
      const { stockCode, stockName, currentPrice } = req.body;
      if (!stockCode || !stockName || !currentPrice) {
        return res.status(400).json({ error: "stockCode, stockName, currentPrice 필수" });
      }

      // 뉴스, 재무, 가격 데이터 병렬 수집
      const [news, financialRatios, priceHistory] = await Promise.allSettled([
        newsService.getStockNews(stockCode, stockName, 10),
        kiwoomService.getFinancialRatios(stockCode).catch(() => null),
        kiwoomService.getStockChart(stockCode, 'D').catch(() => null),
      ]);

      const newsData = news.status === 'fulfilled' ? news.value : undefined;
      const ratiosOutput = financialRatios.status === 'fulfilled' ? financialRatios.value?.output : undefined;
      const ratiosData = Array.isArray(ratiosOutput) ? ratiosOutput[0] : ratiosOutput;
      const chartData = priceHistory.status === 'fulfilled' && priceHistory.value
        ? (priceHistory.value as any[]).slice(0, 30).map((c: any) => ({
            date: c.dt || c.date || '',
            price: Number(c.cls_prc || c.close || 0),
            volume: Number(c.trde_qty || c.volume || 0),
          }))
        : undefined;

      const result = await aiService.integratedAnalysis({
        stockCode,
        stockName,
        currentPrice: Number(currentPrice),
        financialRatios: ratiosData ? {
          per: ratiosData.per || '0',
          pbr: ratiosData.pbr || '0',
          eps: ratiosData.eps || '0',
          bps: ratiosData.bps || '0',
          roe: ratiosData.roe || '0',
        } : undefined,
        priceHistory: chartData,
        news: newsData,
      });

      res.json({
        ...result,
        news: newsData,
        financialRatios: ratiosData,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 종목 AI 분석 (사용자 설정 모델 적용)
  app.post("/api/ai/analyze-stock", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const { stockCode, stockName, currentPrice } = req.body;
      const settings = await storage.getUserSettings(user!.id);
      const model = settings?.aiModel || "gpt-5.1";
      const analysis = await aiService.analyzeStock({ stockCode, stockName, currentPrice }, model);
      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 포트폴리오 AI 분석
  app.post("/api/ai/analyze-portfolio", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const { accountId } = req.body;
      const holdings = await storage.getHoldings(accountId);
      const settings = await storage.getUserSettings(user!.id);
      const analysis = await aiService.analyzePortfolio({
        holdings,
        riskLevel: (settings?.riskLevel || "medium") as "low" | "medium" | "high",
        investmentGoal: "growth",
      });
      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // AI Council Shadow 분석
  app.post("/api/ai/council-analysis", isAuthenticated, async (req, res) => {
    try {
      if (!featureFlags.enableAICouncil) {
        return res.status(403).json({
          error: "AI Council disabled",
          code: "AI_COUNCIL_DISABLED",
        });
      }

      const user = getCurrentUser(req);
      const { stockCode, stockName, currentPrice } = req.body;
      if (!stockCode || !stockName || !currentPrice) {
        return res.status(400).json({ error: "stockCode, stockName, currentPrice 필수" });
      }

      const settings = await storage.getUserSettings(user!.id);
      const preferredModel = settings?.aiModel || "gpt-5.1";

      const result = await aiCouncilService.conductShadowCouncil({
        stockCode,
        stockName,
        currentPrice: Number(currentPrice),
        preferredModel,
      });

      const saved = await storage.createAiCouncilSession({
        userId: user!.id,
        stockCode,
        stockName,
        sessionData: result as any,
        finalAction: result.chairman.action,
        finalConfidence: String(result.chairman.confidence),
        targetPrice: null,
      });

      res.json({ ...result, sessionId: saved.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/council-sessions", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10), 1), 100);
      const sessions = await storage.getAiCouncilSessions(user!.id, limit);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  // AI 모델 목록
  app.get("/api/ai/models", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const models = await storage.getAiModels(user!.id);
      res.json(models);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI 모델 생성
  app.post("/api/ai/models", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const modelData = insertAiModelSchema.parse({ ...req.body, userId: user!.id });
      const model = await storage.createAiModel(modelData);
      res.json(model);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // AI 모델 수정
  app.patch("/api/ai/models/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const modelId = parseInt(req.params.id);
      const existing = await storage.getAiModel(modelId);
      if (!existing) return res.status(404).json({ error: "Model not found" });
      if (existing.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });
      const validated = updateAiModelSchema.parse(req.body);
      const model = await storage.updateAiModel(modelId, validated);
      res.json(model);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // AI 모델 삭제
  app.delete("/api/ai/models/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const modelId = parseInt(req.params.id);
      const existing = await storage.getAiModel(modelId);
      if (!existing) return res.status(404).json({ error: "Model not found" });
      if (existing.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });
      await storage.deleteAiModel(modelId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI 모델 추천 목록
  app.get("/api/ai/models/:modelId/recommendations", isAuthenticated, async (req, res) => {
    try {
      const recommendations = await storage.getAiRecommendations(parseInt(req.params.modelId));
      res.json(recommendations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI 모델 학습 통계
  app.get("/api/ai/models/:id/learning-stats", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const modelId = parseInt(req.params.id);
      const model = await storage.getAiModel(modelId);
      if (!model) return res.status(404).json({ error: "Model not found" });
      if (model.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });
      const { LearningService } = await import("../services/learning.service");
      const learningService = new LearningService();
      const result = await learningService.optimizeModel(modelId, false);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
