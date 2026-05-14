// ai.routes.ts — AI 분석, AI 모델 관리 및 학습 통계 라우터
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertAiModelSchema, updateAiModelSchema } from "@shared/schema";
import { getAIService } from "../services/ai.service";
import { getNewsService } from "../services/news.service";
import { getKiwoomService } from "../services/kiwoom";
import { getUserKiwoomService } from "../services/user-kiwoom.service";
import { getAICouncilService } from "../services/ai-council.service";
import { getFeatureFlags } from "../config/feature-flags";
import { getDartService } from "../services/dart.service";

export function registerAiRoutes(app: Router) {
  const aiService = getAIService();
  const newsService = getNewsService();
  const kiwoomService = getKiwoomService();
  const aiCouncilService = getAICouncilService();
  const featureFlags = getFeatureFlags();
  const dartService = getDartService();
  const userKiwoomService = getUserKiwoomService();


  const collectAndPersistMaterials = async ({
    userId,
    stockCode,
    stockName,
    corpCode,
  }: {
    userId: string;
    stockCode: string;
    stockName: string;
    corpCode?: string;
  }) => {
    const [newsData, ratiosData, issues, filings] = await Promise.all([
      newsService.getStockNews(stockCode, stockName, 20),
      kiwoomService.getFinancialRatios(stockCode).catch(() => null),
      storage.getMarketIssuesByStock(stockCode).catch(() => []),
      dartService.getFilingsByStockCode(stockCode, 30),
    ]);

    const savedNews = await Promise.all(newsData.articles.map((article) =>
      storage.upsertNewsArticle({
        stockCode,
        stockName,
        title: article.title,
        description: article.description,
        link: article.link || `${stockCode}-${article.title}`,
        source: article.source || 'news',
        sentiment: article.sentiment,
        publishedAt: article.pubDate ? new Date(article.pubDate) : null,
        payload: article as any,
      }),
    ));

    const savedFilings = await Promise.all(filings.map((filing) =>
      storage.upsertCompanyFiling({
        stockCode,
        stockName,
        corpCode: filing.corpCode || corpCode || null,
        rceptNo: filing.rceptNo,
        reportNm: filing.reportNm,
        flrNm: filing.flrNm || null,
        rceptDt: filing.rceptDt || null,
        link: filing.link || null,
        source: filing.source,
        payload: filing.payload,
      }),
    ));

    const snapshot = await storage.createAnalysisMaterialSnapshot({
      userId,
      stockCode,
      stockName,
      corpCode: corpCode || null,
      financialSummary: ratiosData?.output || null,
      marketIssues: issues,
      filingIds: savedFilings.map((f) => f.id),
      newsIds: savedNews.map((n) => n.id),
    });

    return {
      snapshot,
      savedNews,
      savedFilings,
      issues,
      newsData,
      ratiosData: ratiosData?.output || null,
    };
  };

  const resolveCorpCode = async ({
    stockCode,
    corpCode,
  }: {
    stockCode: string;
    corpCode?: string;
  }) => {
    if (corpCode?.trim()) return corpCode.trim();

    try {
      const existingFilings = await storage.getCompanyFilings(stockCode, 1);
      const knownCorpCode = existingFilings.find((filing) => filing.corpCode)?.corpCode;
      if (knownCorpCode?.trim()) return knownCorpCode.trim();
    } catch {
      // ignore and fallback
    }

    return await dartService.resolveCorpCode(stockCode) || "";
  };

  const isSnapshotFresh = (collectedAt: Date | string | null | undefined, maxAgeMinutes: number = 30) => {
    if (!collectedAt) return false;
    const d = collectedAt instanceof Date ? collectedAt : new Date(collectedAt);
    if (Number.isNaN(d.getTime())) return false;
    return Date.now() - d.getTime() <= maxAgeMinutes * 60 * 1000;
  };

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

  // ─── 분석 재료 동기화 (뉴스/재무/공시/이슈 저장) ───────────────────────────
  app.post("/api/stocks/:stockCode/sync-materials", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const stockCode = req.params.stockCode;
      const stockName = String(req.body?.stockName || req.query?.stockName || stockCode);
      const corpCode = await resolveCorpCode({
        stockCode,
        corpCode: String(req.body?.corpCode || ""),
      });
      const forceSync = req.body?.force === true;
      const latest = await storage.getAnalysisMaterialSnapshots(user!.id, stockCode, 1);
      const latestSnapshot = latest[0];

      if (!forceSync && latestSnapshot && isSnapshotFresh(latestSnapshot.collectedAt, 30)) {
        return res.json({
          snapshotId: latestSnapshot.id,
          stockCode,
          stockName,
          newsCount: Array.isArray(latestSnapshot.newsIds) ? latestSnapshot.newsIds.length : 0,
          filingCount: Array.isArray(latestSnapshot.filingIds) ? latestSnapshot.filingIds.length : 0,
          issueCount: Array.isArray(latestSnapshot.marketIssues) ? latestSnapshot.marketIssues.length : 0,
          collectedAt: latestSnapshot.collectedAt,
          reused: true,
        });
      }

      const { snapshot, savedNews, savedFilings, issues } = await collectAndPersistMaterials({
        userId: user!.id,
        stockCode,
        stockName,
        corpCode,
      });

      res.json({
        snapshotId: snapshot.id,
        stockCode,
        stockName,
        newsCount: savedNews.length,
        filingCount: savedFilings.length,
        issueCount: issues.length,
        collectedAt: snapshot.collectedAt,
        reused: false,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stocks/:stockCode/materials", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const stockCode = req.params.stockCode;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || 10), 10), 1), 50);
      const snapshots = await storage.getAnalysisMaterialSnapshots(user!.id, stockCode, limit);
      res.json(snapshots);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── 통합 분석 (뉴스 + 재무 + 기술) ─────────────────────────────────────────
  app.post("/api/ai/integrated-analysis", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const { stockCode, stockName, currentPrice } = req.body;
      if (!stockCode || !stockName || !currentPrice) {
        return res.status(400).json({ error: "stockCode, stockName, currentPrice 필수" });
      }

      // 뉴스, 재무, 가격 + 저장된 재료 데이터 병렬 수집
      const [news, financialRatios, priceHistory, filings, marketIssues, materialSnapshots] = await Promise.allSettled([
        newsService.getStockNews(stockCode, stockName, 10),
        kiwoomService.getFinancialRatios(stockCode).catch(() => null),
        userKiwoomService.getChart(user!.id, stockCode, "D", 120).catch(() => null),
        storage.getCompanyFilings(stockCode, 10).catch(() => []),
        storage.getMarketIssuesByStock(stockCode).catch(() => []),
        storage.getAnalysisMaterialSnapshots(user!.id, stockCode, 1).catch(() => []),
      ]);

      const newsData = news.status === 'fulfilled' ? news.value : undefined;
      const ratiosOutput = financialRatios.status === 'fulfilled' ? financialRatios.value?.output : undefined;
      const ratiosData = Array.isArray(ratiosOutput) ? ratiosOutput[0] : ratiosOutput;
      const chartData = priceHistory.status === 'fulfilled' && priceHistory.value
        ? userKiwoomService.normalizeChartForPriceHistory(priceHistory.value as any[])
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
        usageContext: {
          userId: user!.id,
          accountId: req.body?.accountId ? Number(req.body.accountId) : null,
          source: 'api:integrated-analysis',
        },
      });

      let filingsData = filings.status === 'fulfilled' ? filings.value : [];
      let issuesData = marketIssues.status === 'fulfilled' ? marketIssues.value : [];
      let latestSnapshot = materialSnapshots.status === 'fulfilled' ? materialSnapshots.value?.[0] : null;
      let materialSyncMeta: {
        triggered: boolean;
        reused: boolean;
      } = {
        triggered: false,
        reused: false,
      };

      const shouldAutoSync = req.body?.syncMaterials !== false;
      const snapshotFresh = latestSnapshot ? isSnapshotFresh(latestSnapshot.collectedAt, 30) : false;
      if (latestSnapshot && snapshotFresh) {
        materialSyncMeta = { triggered: false, reused: true };
      }
      if ((!latestSnapshot || !snapshotFresh) && shouldAutoSync) {
        try {
          const synced = await collectAndPersistMaterials({
            userId: user!.id,
            stockCode,
            stockName,
            corpCode: await resolveCorpCode({
              stockCode,
              corpCode: req.body?.corpCode,
            }),
          });
          latestSnapshot = synced.snapshot;
          filingsData = synced.savedFilings;
          issuesData = synced.issues;
          materialSyncMeta = { triggered: true, reused: false };
        } catch (syncError: any) {
          console.warn('[ai.routes] material auto-sync failed:', syncError?.message);
        }
      }

      res.json({
        ...result,
        news: newsData,
        financialRatios: ratiosData,
        filings: filingsData,
        marketIssues: issuesData,
        materialSnapshotId: latestSnapshot?.id || null,
        materialSync: {
          ...materialSyncMeta,
          snapshotId: latestSnapshot?.id || null,
          collectedAt: latestSnapshot?.collectedAt || null,
        },
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
      const model = settings?.aiModel || "gpt-5-mini";
      const scopedAccountId = req.body?.accountId ? Number(req.body.accountId) : (settings?.defaultAccountId ?? null);
      const analysis = await aiService.analyzeStock(
        { stockCode, stockName, currentPrice },
        model,
        {
          userId: user!.id,
          accountId: scopedAccountId,
          source: 'api:analyze-stock',
        },
      );
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
      }, settings?.aiModel || "gpt-5-mini", {
        userId: user!.id,
        accountId,
        source: 'api:analyze-portfolio',
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
      const preferredModel = settings?.aiModel || "gpt-5-mini";
      const scopedAccountId = req.body?.accountId ? Number(req.body.accountId) : (settings?.defaultAccountId ?? null);

      const result = await aiCouncilService.conductShadowCouncil({
        stockCode,
        stockName,
        currentPrice: Number(currentPrice),
        preferredModel,
        userId: user!.id,
        accountId: scopedAccountId,
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
  // AI 모델 목록 (trading_performance 기반 실시간 통계 포함)
  app.get("/api/ai/models", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const models = await storage.getAiModels(user!.id);

      const enriched = await Promise.all(models.map(async (model) => {
        const perfs = await storage.getTradingPerformance(model.id, 1000);
        const closed = perfs.filter(p => p.exitPrice != null);
        if (closed.length === 0) return model;

        const wins = closed.filter(p => p.isWin);
        const winRate = (wins.length / closed.length) * 100;
        const totalReturn = closed.reduce((sum, p) => sum + parseFloat(p.profitLossRate?.toString() ?? '0'), 0);
        const avgReturn = totalReturn / closed.length;

        return {
          ...model,
          totalTrades: closed.length,
          winRate: winRate.toFixed(2),
          totalReturn: avgReturn.toFixed(4),
        };
      }));

      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI 일별 사용량/비용 조회
  app.get("/api/ai/usage-daily", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const fromDate = req.query.fromDate ? String(req.query.fromDate) : undefined;
      const toDate = req.query.toDate ? String(req.query.toDate) : undefined;
      const scopeTypeRaw = req.query.scopeType ? String(req.query.scopeType) : undefined;
      const scopeType = scopeTypeRaw === 'login' || scopeTypeRaw === 'account'
        ? scopeTypeRaw
        : undefined;
      const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 200;

      const rows = await storage.getAiUsageDaily(user!.id, {
        fromDate,
        toDate,
        scopeType,
        accountId: Number.isFinite(accountId) ? accountId : undefined,
        limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 1000)) : 200,
      });
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI 월 예산 설정 조회
  app.get("/api/ai/budget", isAuthenticated, async (req, res) => {
    try {
      const [budget, block] = await Promise.all([
        storage.getSystemConfig("ai_budget_usd"),
        storage.getSystemConfig("ai_budget_block"),
      ]);
      res.json({ budgetUsd: budget ? parseFloat(budget) : 0, blockOnExceed: block === 'true' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI 월 예산 설정 저장
  app.post("/api/ai/budget", isAuthenticated, async (req, res) => {
    try {
      const { budgetUsd, blockOnExceed } = req.body;
      if (typeof budgetUsd !== "number" || budgetUsd < 0) {
        return res.status(400).json({ error: "Invalid budget value" });
      }
      await Promise.all([
        storage.setSystemConfig("ai_budget_usd", String(budgetUsd)),
        typeof blockOnExceed === 'boolean'
          ? storage.setSystemConfig("ai_budget_block", blockOnExceed ? 'true' : 'false')
          : Promise.resolve(),
      ]);
      res.json({ success: true, budgetUsd, blockOnExceed: blockOnExceed ?? false });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 학습 요약 (모델별 최신 학습 기록 + 학습 플래그 상태)
  app.get("/api/ai/learning-summary", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const models = await storage.getAiModels(user!.id);

      const modelSummaries = await Promise.all(
        models.map(async (model) => {
          const records = await storage.getLearningRecords(model.id, 1);
          const latest = records[0] || null;
          const applied = latest ? Boolean((latest.appliedChanges as any)?.applied) : false;
          const recommendations = latest ? (((latest.appliedChanges as any)?.recommendations ?? []) as string[]) : [];

          return {
            modelId: model.id,
            modelName: model.modelName,
            isActive: model.isActive,
            latestRecord: latest
              ? {
                  createdAt: latest.createdAt,
                  totalTrades: latest.totalTrades ?? 0,
                  winRate: latest.winRate ?? null,
                  avgReturn: latest.avgReturn ?? null,
                  applied,
                  recommendations,
                }
              : null,
          };
        })
      );

      res.json({
        learningEnabled: featureFlags.enableAdvancedLearning,
        defaultScheduleTime: "16:00",
        models: modelSummaries,
      });
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

  app.get("/api/ai/models/:modelId/trading-settings", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const modelId = parseInt(req.params.modelId);
      const model = await storage.getAiModel(modelId);
      if (!model) return res.status(404).json({ error: "Model not found" });
      if (model.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });
      const settings = await storage.getAutoTradingSettings(modelId);
      res.json(settings || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/ai/models/:modelId/trading-settings", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const modelId = parseInt(req.params.modelId);
      const model = await storage.getAiModel(modelId);
      if (!model) return res.status(404).json({ error: "Model not found" });
      if (model.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });

      const { modelId: _ignore, id: _ignoreId, createdAt: _ignoreCreated, ...safeBody } = req.body;

      // 양수 정수 필드 검증
      if (safeBody.maxDailyTrades !== undefined) {
        const v = parseInt(String(safeBody.maxDailyTrades));
        if (!isFinite(v) || v < 1) return res.status(400).json({ error: '일일 최대 거래 횟수는 1 이상이어야 합니다.' });
        safeBody.maxDailyTrades = v;
      }
      for (const field of ['defaultPositionSize', 'maxPositionSize'] as const) {
        if (safeBody[field] !== undefined) {
          const v = parseFloat(String(safeBody[field]));
          if (!isFinite(v) || v < 1000) return res.status(400).json({ error: `${field}는 1,000원 이상이어야 합니다.` });
        }
      }

      const weights = [
        parseFloat(safeBody.themeWeight || "0"),
        parseFloat(safeBody.newsWeight || "0"),
        parseFloat(safeBody.financialsWeight || "0"),
        parseFloat(safeBody.liquidityWeight || "0"),
        parseFloat(safeBody.institutionalWeight || "0"),
      ];
      const weightSum = weights.reduce((a, b) => a + b, 0);
      if (Math.abs(weightSum - 100) > 0.5) {
        return res.status(400).json({ error: `가중치 합계가 100%여야 합니다. (현재: ${weightSum}%)` });
      }

      // entryLadderSettings 검증
      if (safeBody.entryLadderSettings !== undefined && safeBody.entryLadderSettings !== null) {
        const ladder = safeBody.entryLadderSettings;
        if (!Array.isArray(ladder)) {
          return res.status(400).json({ error: 'entryLadderSettings는 배열이어야 합니다.' });
        }
        const VALID_LINES = new Set([10, 20, 30, 40, 50]);
        for (const step of ladder) {
          if (!VALID_LINES.has(step.line)) {
            return res.status(400).json({ error: `라더 라인은 10/20/30/40/50만 허용됩니다. (입력값: ${step.line})` });
          }
          if (typeof step.units !== 'number' || step.units < 0 || step.units > 5) {
            return res.status(400).json({ error: `라인 ${step.line}: units는 0~5 정수여야 합니다.` });
          }
        }
        const maxUnitsPerStock = safeBody.maxUnitsPerStock ?? 5;
        const totalUnits = ladder.reduce((sum: number, s: any) => sum + (s.units || 0), 0);
        if (totalUnits > maxUnitsPerStock) {
          return res.status(400).json({ error: `라더 총 유닛(${totalUnits})이 maxUnitsPerStock(${maxUnitsPerStock})을 초과합니다.` });
        }
      }

      // hardMaxCapitalPerStock >= baseUnitSize 검증
      if (safeBody.hardMaxCapitalPerStock && safeBody.baseUnitSize) {
        const hardMax = parseFloat(String(safeBody.hardMaxCapitalPerStock));
        const baseUnit = parseFloat(String(safeBody.baseUnitSize));
        if (hardMax < baseUnit) {
          return res.status(400).json({ error: `hardMaxCapitalPerStock(${hardMax.toLocaleString()})는 baseUnitSize(${baseUnit.toLocaleString()}) 이상이어야 합니다.` });
        }
      }

      // stopLossPolicy shape 검증
      if (safeBody.stopLossPolicy !== undefined && safeBody.stopLossPolicy !== null) {
        const policy = safeBody.stopLossPolicy;
        const VALID_MODES = ['disabled', 'soft_ai_first', 'conditional', 'hard'];
        if (policy.mode && !VALID_MODES.includes(policy.mode)) {
          return res.status(400).json({ error: `stopLossPolicy.mode는 ${VALID_MODES.join(' / ')} 중 하나여야 합니다.` });
        }
        if (policy.hardCutLossPct !== undefined && (typeof policy.hardCutLossPct !== 'number' || policy.hardCutLossPct <= 0 || policy.hardCutLossPct > 50)) {
          return res.status(400).json({ error: 'stopLossPolicy.hardCutLossPct는 0~50 사이 숫자여야 합니다.' });
        }
      }

      const VALID_COOLDOWN_MODES = [
        'interval_120m',
        'interval_60m',
        'interval_30m',
        'daily_three_slots',
        'daily_once',
      ];
      const requestedCooldownMode = safeBody.aiEntryPolicy?.candidateDecisionCooldownMode;
      if (requestedCooldownMode !== undefined && !VALID_COOLDOWN_MODES.includes(requestedCooldownMode)) {
        return res.status(400).json({ error: `aiEntryPolicy.candidateDecisionCooldownMode는 ${VALID_COOLDOWN_MODES.join(' / ')} 중 하나여야 합니다.` });
      }
      const requestedDisableReeval = safeBody.aiEntryPolicy?.disableReevaluationForBoughtToday;
      if (requestedDisableReeval !== undefined && typeof requestedDisableReeval !== 'boolean') {
        return res.status(400).json({ error: 'aiEntryPolicy.disableReevaluationForBoughtToday는 boolean 이어야 합니다.' });
      }

      const existing = await storage.getAutoTradingSettings(modelId);
      const normalizedAiEntryPolicy = safeBody.aiEntryPolicy === undefined
        ? undefined
        : {
          ...(safeBody.aiEntryPolicy ?? {}),
          candidateDecisionCooldownMode: requestedCooldownMode ?? 'interval_120m',
          disableReevaluationForBoughtToday: requestedDisableReeval ?? false,
        };

      if (existing) {
        const updated = await storage.updateAutoTradingSettings(modelId, {
          ...safeBody,
          ...(normalizedAiEntryPolicy !== undefined ? { aiEntryPolicy: normalizedAiEntryPolicy } : {}),
          updatedAt: new Date(),
        });
        res.json(updated);
      } else {
        const created = await storage.createAutoTradingSettings({
          ...safeBody,
          modelId,
          aiEntryPolicy: normalizedAiEntryPolicy ?? {
            candidateDecisionCooldownMode: 'interval_120m',
            disableReevaluationForBoughtToday: false,
          },
        });
        res.json(created);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI 모델 학습 이력 조회
  app.get("/api/ai/models/:id/learning-records", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const modelId = parseInt(req.params.id);
      const model = await storage.getAiModel(modelId);
      if (!model) return res.status(404).json({ error: "Model not found" });
      if (model.userId !== user!.id) return res.status(403).json({ error: "Not authorized" });
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || 30), 10), 1), 100);
      const records = await storage.getLearningRecords(modelId, limit);
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
