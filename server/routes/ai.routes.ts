// ai.routes.ts — AI 분석, AI 모델 관리 및 학습 통계 라우터
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertAiModelSchema, updateAiModelSchema } from "@shared/schema";
import { getAIService } from "../services/ai.service";

export function registerAiRoutes(app: Router) {
  const aiService = getAIService();

  // 종목 AI 분석
  app.post("/api/ai/analyze-stock", isAuthenticated, async (req, res) => {
    try {
      const { stockCode, stockName, currentPrice } = req.body;
      const analysis = await aiService.analyzeStock({ stockCode, stockName, currentPrice });
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
