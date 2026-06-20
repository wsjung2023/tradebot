// autotrading.routes.ts - auto-trading related routes
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { AgentTimeoutError } from "../services/agent-proxy.service";
import { getUserKiwoomService } from "../services/user-kiwoom.service";
import { RainbowChartAnalyzer } from "../formula/rainbow-chart";
import { normalizeChartDataAsc } from "../utils/chart-normalization";
import { getAIService } from "../services/ai.service";
import { z } from "zod";
import { checkAutoApplyAllowed } from "../services/tier-limits.service";
import { getSimulationService } from "../services/simulation.service";


export function registerAutoTradingRoutes(app: Router) {
  const userKiwoomService = getUserKiwoomService();
  const notificationQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    unreadOnly: z
      .union([
        z.literal("true"),
        z.literal("false"),
        z.literal("1"),
        z.literal("0"),
        z.boolean(),
        z.number().int().min(0).max(1),
      ])
      .optional()
      .transform((value) => value === true || value === "true" || value === "1" || value === 1),
    severity: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(["info", "warn", "crit"]))
      .optional(),
    type: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9_:-]+$/i, "invalid_type")
      .optional(),
  });

  const candidateDecisionQuerySchema = z.object({
    modelId: z.coerce.number().int().positive().optional(),
    accepted: z
      .union([
        z.literal("true"),
        z.literal("false"),
        z.literal("1"),
        z.literal("0"),
        z.boolean(),
        z.number().int().min(0).max(1),
      ])
      .optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    offset: z.coerce.number().int().min(0).max(5000).optional(),
  });

  const parseBool = (value: unknown): boolean | undefined => {
    if (value === undefined) return undefined;
    return value === true || value === "true" || value === "1" || value === 1;
  };

  const parseKstDateStart = (dateStr?: string): Date | undefined => {
    if (!dateStr) return undefined;
    return new Date(`${dateStr}T00:00:00+09:00`);
  };

  const parseKstDateEnd = (dateStr?: string): Date | undefined => {
    if (!dateStr) return undefined;
    return new Date(`${dateStr}T23:59:59.999+09:00`);
  };

  const toKstDateTime = (value: Date | string | null | undefined): string | null => {
    if (!value) return null;
    const base = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(base.getTime())) return null;
    const kst = new Date(base.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 19).replace("T", " ");
  };

  const toKstDay = (value: Date | string | null | undefined): string => {
    const kstDateTime = toKstDateTime(value);
    return kstDateTime ? kstDateTime.slice(0, 10) : new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  };

  app.get("/api/auto-trading/engine-status", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const run = await storage.getAutoTradingRun(user!.id);
      if (!run) {
        return res.status(200).json({
          initialized: false,
          run: null,
          message: "auto_trading_runs 레코드가 아직 생성되지 않았습니다.",
        });
      }
      res.json({
        initialized: true,
        run,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auto-trading/notifications", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const parsed = notificationQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          error: "invalid_notification_query",
          details: parsed.error.flatten(),
        });
      }
      const limit = parsed.data.limit ?? 50;
      const unreadOnly = parsed.data.unreadOnly ?? false;
      const severity = parsed.data.severity;
      const type = parsed.data.type;
      const notifications = await storage.getEngineNotifications(user!.id, limit, unreadOnly, severity, type);
      res.json({ notifications });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auto-trading/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const notificationId = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(notificationId) || notificationId <= 0) {
        return res.status(400).json({ error: "invalid_notification_id" });
      }
      const updated = await storage.markEngineNotificationRead(user!.id, notificationId);
      if (!updated) {
        return res.status(404).json({ error: "notification_not_found" });
      }
      res.json({ notification: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auto-trading/notifications/summary", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const summary = await storage.getEngineNotificationSummary(user!.id);
      res.json({ summary });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auto-trading/notifications/unread-count", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const unreadCount = await storage.getUnreadEngineNotificationCount(user!.id);
      res.json({ unreadCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auto-trading/notifications/read-all", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const updatedCount = await storage.markAllEngineNotificationsRead(user!.id);
      res.json({ updatedCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auto-trading/candidates", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const candidates = await storage.getAllCandidateStocksForUser(user!.id);
      res.json({ candidates });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auto-trading/candidate-decisions", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const parsed = candidateDecisionQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          error: "invalid_candidate_decision_query",
          details: parsed.error.flatten(),
        });
      }

      const accepted = parseBool(parsed.data.accepted);
      const from = parseKstDateStart(parsed.data.from);
      const to = parseKstDateEnd(parsed.data.to);

      if (from && Number.isNaN(from.getTime())) return res.status(400).json({ error: "invalid_from_date" });
      if (to && Number.isNaN(to.getTime())) return res.status(400).json({ error: "invalid_to_date" });
      if (from && to && from > to) return res.status(400).json({ error: "invalid_date_range" });

      const logs = await storage.getCandidateDecisionLogsForUser(user!.id, {
        modelId: parsed.data.modelId,
        accepted,
        from,
        to,
        limit: parsed.data.limit ?? 200,
        offset: parsed.data.offset ?? 0,
      });

      // 일별 요약은 결과 필터(선정/탈락)와 무관하게 동일 기간/모델 기준 전체를 집계한다.
      // 그렇지 않으면 accepted=false(탈락) 필터에서 선정 수치가 항상 0으로 보이는 혼선이 발생한다.
      const summaryLogs = await storage.getCandidateDecisionLogsForUser(user!.id, {
        modelId: parsed.data.modelId,
        from,
        to,
        // 요약 집계는 충분히 큰 상한으로 조회(일반 화면 범위에서 요약 누락 방지)
        limit: 5000,
        offset: 0,
      });

      const logsWithKst = logs.map((row) => ({
        ...row,
        decidedAtKst: toKstDateTime(row.decidedAt),
      }));
      const summaryLogsWithKst = summaryLogs.map((row) => ({
        ...row,
        decidedAtKst: toKstDateTime(row.decidedAt),
      }));
      const dailySummaryMap = new Map<string, { total: number; accepted: number; rejected: number }>();
      for (const row of summaryLogsWithKst) {
        const kstDay = toKstDay(row.decidedAt);
        const current = dailySummaryMap.get(kstDay) ?? { total: 0, accepted: 0, rejected: 0 };
        current.total += 1;
        if (row.accepted) current.accepted += 1;
        else current.rejected += 1;
        dailySummaryMap.set(kstDay, current);
      }

      const dailySummary = Array.from(dailySummaryMap.entries())
        .map(([date, value]) => ({ date, ...value }))
        .sort((a, b) => b.date.localeCompare(a.date));

      res.json({
        filters: {
          modelId: parsed.data.modelId ?? null,
          accepted: accepted ?? null,
          from: parsed.data.from ?? null,
          to: parsed.data.to ?? null,
          limit: parsed.data.limit ?? 200,
          offset: parsed.data.offset ?? 0,
        },
        total: logs.length,
        logs: logsWithKst,
        dailySummary,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/auto-trading/backattack-scan
   * Run backattack scan:
   * - If stockCodes are provided, analyze those symbols.
   * - Otherwise run condition search by seq (default: 30).
   * - Return all analyzed symbols with recommendation metadata.
   */
  app.post("/api/auto-trading/backattack-scan", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) return res.status(401).json({ error: "인증이 필요합니다." });

      let { stockCodes, conditionSeq } = req.body as { stockCodes?: string[]; conditionSeq?: string };
      const effectiveSeq = (conditionSeq || "30").trim();
      const conditionName = "뒷차기2";

      // 원본 조건검색 결과(종목명/현재가/등락률 포함)
      let conditionResultFull: any[] = [];

      // stockCodes 미전달 시 직접 조건검색 실행
      if (!stockCodes || stockCodes.length === 0) {
        const seq = effectiveSeq;
        console.log(`[backattack-scan] stockCodes 없음 → condition.run(seq=${seq}) 직접 실행`);
        try {
          const conditionResult = await getUserKiwoomService().runCondition(user.id, seq);
          if (Array.isArray(conditionResult) && conditionResult.length > 0) {
            conditionResultFull = conditionResult;
            stockCodes = conditionResult
              .map((item: any) => item.stock_code || item.stck_cd || item.code)
              .filter(Boolean);
            console.log(`[backattack-scan] 조건검색 결과: ${stockCodes.length}개 종목`);
          } else {
            return res.json({
              message: `${conditionName} 조건에 현재 매칭된 종목이 없습니다.`,
              conditionName, totalMatches: 0, processedCount: 0,
              recommendationCount: 0, stocks: [],
              sync: { syncedModels: 0, syncedCandidates: 0 },
            });
          }
        } catch (condErr: any) {
          return res.status(500).json({ error: `조건검색 실행 실패: ${condErr.message}` });
        }
      }

      // 보조 메타 맵
      const nameByCode: Record<string, string> = {};
      const priceByCode: Record<string, number> = {};
      const changeRateByCode: Record<string, number> = {};
      for (const item of conditionResultFull) {
        const code = item.stock_code || item.stck_cd || item.code;
        const name = item.stock_name || item.stck_nm || item.name;
        const price = Number(item.current_price || item.stck_prpr || item.cur_prc || 0);
        const rawRate = Number(item.change_rate || item.prdy_ctrt || 0);
        const changeRate = Math.abs(rawRate) > 100 ? rawRate / 1000 : rawRate;
        if (code) {
          if (name) nameByCode[code] = name;
          if (price) priceByCode[code] = price;
          changeRateByCode[code] = changeRate;
        }
      }

      const stockList = (stockCodes || []).map((code: string) => ({
        stock_code: code,
        stock_name: nameByCode[code] || code,
      }));

      const stocks: any[] = [];
      const errors: Array<{ stockCode: string; stockName: string; error: string }> = [];
      let processedCount = 0;
      let recommendationCount = 0;

      for (const stock of stockList) {
        const stockCode = stock.stock_code;
        const stockName = stock.stock_name || "Unknown";
        if (!stockCode) continue;

        try {
          const rawChartData = await userKiwoomService.getChart(user.id, stockCode, "D", 400);
          const normalized = normalizeChartDataAsc(rawChartData);
          if (!normalized || normalized.length < 240) {
            throw new Error(`차트 데이터 부족: ${normalized?.length || 0}개 (240개 필요)`);
          }

          const rainbowResult = RainbowChartAnalyzer.analyze(stockCode, normalized, 240);
          const { currentPosition, signals, recommendation, clWidth, CL } = rainbowResult;

          const isInBuyZone = currentPosition >= 40 && currentPosition <= 60;
          const hasGoodCLWidth = clWidth >= 10;
          const isRecommended = isInBuyZone && hasGoodCLWidth;

          if (isRecommended) recommendationCount++;

          const currentPrice = priceByCode[stockCode] || rainbowResult.current;
          const changeRate = changeRateByCode[stockCode] || 0;

          console.log(
            `[backattack-scan] ${stockName}(${stockCode}) ` +
            `CL위치=${currentPosition.toFixed(1)}% CL폭=${clWidth.toFixed(1)}% ` +
            `CL=${CL.toLocaleString('ko-KR')} → ${isRecommended ? '추천' : '참고'}`
          );

          stocks.push({
            stockCode,
            stockName,
            currentPrice,
            changeRate,
            isRecommended,
            currentPosition,
            clWidth,
            CL,
            recommendation,
            signals: {
              nearCL: signals.nearCL,
              clWidthGood: hasGoodCLWidth,
              inBuyZone: isInBuyZone,
              inSellZone: signals.aboveCL && !isInBuyZone,
            },
            rainbowAnalysis: {
              current: rainbowResult.current,
              CL: rainbowResult.CL,
              clWidth: rainbowResult.clWidth,
              currentPosition: rainbowResult.currentPosition,
              recommendation: rainbowResult.recommendation,
              lines: rainbowResult.lines,
              signals: rainbowResult.signals,
            },
          });
        } catch (error: any) {
          console.error(`[backattack-scan] ${stockName}(${stockCode}) 오류: ${error.message}`);
          errors.push({ stockCode, stockName, error: error.message });
        }

        processedCount++;
        if (processedCount < stockList.length) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      // 추천 종목 우선 정렬
      stocks.sort((a, b) => {
        if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1;
        return Math.abs(a.currentPosition - 50) - Math.abs(b.currentPosition - 50);
      });

      // 핵심: 수동 스캔 결과를 자동매매 후보(candidate_stocks)와 동기화
      let syncedModels = 0;
      let syncedCandidates = 0;
      try {
        const activeModels = await storage.getActiveAiModels();
        const userModels = activeModels.filter((m) => m.userId === user.id);

        for (const model of userModels) {
          const settings = await storage.getAutoTradingSettings(model.id);
          const conditionSequences: Array<{ conditionId?: string | number; name?: string }> =
            (settings?.conditionSearchSequences as any) ?? [];

          const matchedSequence = conditionSequences.find(
            (seq) => String(seq?.conditionId ?? "").trim() === effectiveSeq,
          );
          if (!matchedSequence) continue;

          await storage.clearCandidateStocks(user.id, model.id);

          for (const row of stockList) {
            const code = String(row.stock_code || "").trim();
            if (!code) continue;
            await storage.upsertCandidateStock({
              userId: user.id,
              modelId: model.id,
              stockCode: code,
              stockName: row.stock_name || code,
              source: matchedSequence.name || effectiveSeq,
            });
            syncedCandidates++;
          }

          syncedModels++;
          console.log(
            `[backattack-scan] 후보 동기화 완료 user=${user.id} model=${model.id} seq=${effectiveSeq} count=${stockList.length}`,
          );
        }
      } catch (syncErr: any) {
        console.error(`[backattack-scan] 후보 동기화 오류: ${syncErr?.message || syncErr}`);
      }

      res.json({
        message: "뒷차기2 스캔 완료",
        conditionName,
        conditionSeq: effectiveSeq,
        totalMatches: stockList.length,
        processedCount,
        recommendationCount,
        errorCount: errors.length,
        sync: {
          syncedModels,
          syncedCandidates,
        },
        stocks,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      if (error instanceof AgentTimeoutError) return res.status(503).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ── 종목별 분할매도 계획 (Holding Exit Plans) ──────────────────────────────────

  const exitStageSchema = z.object({
    priority: z.number().int().positive(),
    triggerType: z.enum(['profit_rate', 'rainbow_line', 'loss_rate']),
    triggerValue: z.number(),
    sellRatio: z.number().min(0).max(1),
    label: z.string().max(100),
    fulfilled: z.boolean().default(false),
  });

  const upsertExitPlanSchema = z.object({
    takeProfitPercent: z.number().positive().nullable().optional(),
    stopLossPercent: z.number().positive().nullable().optional(),
    exitStages: z.array(exitStageSchema).max(10).nullable().optional(),
  });

  async function verifyModelOwnership(userId: string, modelId: number) {
    const models = await storage.getAiModels(userId);
    return models.find((m: any) => m.id === modelId);
  }

  // GET /api/auto-trading/exit-plan/:modelId/:stockCode
  app.get('/api/auto-trading/exit-plan/:modelId/:stockCode', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(req.params.modelId);
      const stockCode = req.params.stockCode;
      if (!await verifyModelOwnership(user.id, modelId)) return res.status(403).json({ error: 'forbidden' });
      const plan = await storage.getHoldingExitPlan(modelId, stockCode);
      res.json({ plan: plan ?? null });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // PUT /api/auto-trading/exit-plan/:modelId/:stockCode
  app.put('/api/auto-trading/exit-plan/:modelId/:stockCode', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(req.params.modelId);
      const stockCode = req.params.stockCode;
      if (!await verifyModelOwnership(user.id, modelId)) return res.status(403).json({ error: 'forbidden' });
      const body = upsertExitPlanSchema.parse(req.body);
      const stages = body.exitStages?.map((s, i) => ({ ...s, priority: i + 1, fulfilled: false })) ?? null;
      const plan = await storage.upsertHoldingExitPlan({
        modelId,
        stockCode,
        takeProfitPercent: body.takeProfitPercent != null ? String(body.takeProfitPercent) : undefined,
        stopLossPercent: body.stopLossPercent != null ? String(body.stopLossPercent) : undefined,
        exitStages: stages,
        source: 'manual',
      } as any);
      res.json({ plan });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // DELETE /api/auto-trading/exit-plan/:modelId/:stockCode
  app.delete('/api/auto-trading/exit-plan/:modelId/:stockCode', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(req.params.modelId);
      const stockCode = req.params.stockCode;
      if (!await verifyModelOwnership(user.id, modelId)) return res.status(403).json({ error: 'forbidden' });
      await storage.deleteHoldingExitPlan(modelId, stockCode);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/auto-trading/exit-plan/:modelId/:stockCode/generate
  app.post('/api/auto-trading/exit-plan/:modelId/:stockCode/generate', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(req.params.modelId);
      const stockCode = req.params.stockCode;
      const model = await verifyModelOwnership(user.id, modelId);
      if (!model) return res.status(403).json({ error: 'forbidden' });
      const config = (model.config as any) || {};
      const accountId = config.accountId;
      if (!accountId) return res.status(400).json({ error: 'accountId not set on model' });

      const holding = await storage.getHoldingByStock(accountId, stockCode);
      if (!holding) return res.status(404).json({ error: 'holding not found' });

      const avgPrice = parseFloat(holding.averagePrice?.toString() || '0');
      const currentPrice = parseFloat(holding.currentPrice?.toString() || '0') || avgPrice;
      const profitRatePct = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;

      const perf = await storage.getTradingPerformanceByStock(modelId, stockCode);
      const filledEntrySteps = Array.isArray(perf?.filledEntrySteps)
        ? (perf!.filledEntrySteps as number[]).filter((n: number) => Number.isFinite(n))
        : [];
      const holdingDays = perf?.createdAt
        ? Math.floor((Date.now() - new Date(perf.createdAt).getTime()) / 86400000)
        : 0;

      let currentRainbowLine = 50;
      let ma5: number | undefined, ma20: number | undefined, ma60: number | undefined, ma120: number | undefined;
      let recentHigh: number | undefined, recentLow: number | undefined;
      let high52w: number | undefined, low52w: number | undefined;

      try {
        const chartData = await userKiwoomService.getChart(user.id, stockCode, 'D', 250);
        const ohlcv = normalizeChartDataAsc(chartData?.output || chartData);

        // 레인보우 CL
        const analysis = RainbowChartAnalyzer.analyze(stockCode, ohlcv, 240);
        const range = analysis.highest - analysis.lowest;
        if (range > 0) {
          const pct = ((currentPrice - analysis.lowest) / range) * 100;
          currentRainbowLine = Math.min(100, Math.max(10, Math.round(pct / 10) * 10));
        }

        // 이동평균 계산
        const closes = ohlcv.map((c: any) => Number(c.close)).filter(Boolean);
        const ma = (n: number) => closes.length >= n
          ? closes.slice(-n).reduce((a: number, b: number) => a + b, 0) / n
          : undefined;
        ma5 = ma(5); ma20 = ma(20); ma60 = ma(60); ma120 = ma(120);

        // 최근 60일 고점/저점
        const recent60 = ohlcv.slice(-60);
        recentHigh = Math.max(...recent60.map((c: any) => Number(c.high)).filter(Boolean));
        recentLow = Math.min(...recent60.map((c: any) => Number(c.low)).filter(Boolean));

        // 52주(250거래일) 고점/저점
        high52w = Math.max(...ohlcv.map((c: any) => Number(c.high)).filter(Boolean));
        low52w = Math.min(...ohlcv.map((c: any) => Number(c.low)).filter(Boolean));
      } catch { /* ignore */ }

      const userSettings = await storage.getUserSettings(user.id);
      const aiModel = userSettings?.aiModel || 'gpt-5-mini';
      const aiService = getAIService();

      const result = await aiService.generateHoldingExitPlan({
        stockCode,
        stockName: holding.stockName || stockCode,
        averagePrice: avgPrice,
        currentPrice,
        profitRatePct,
        currentRainbowLine,
        quantity: holding.quantity,
        filledEntrySteps,
        holdingDays,
        ma5, ma20, ma60, ma120,
        recentHigh, recentLow,
        high52w, low52w,
      }, aiModel, { userId: user.id, accountId, source: 'exit-plan-generate' });

      const plan = await storage.upsertHoldingExitPlan({
        modelId,
        stockCode,
        exitStages: result.exitStages,
        aiReasoning: result.reasoning,
        source: 'ai_batch',
        generatedAt: new Date(),
      } as any);

      res.json({ plan });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/auto-trading/exit-plans/:modelId
  app.get('/api/auto-trading/exit-plans/:modelId', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(req.params.modelId);
      if (!await verifyModelOwnership(user.id, modelId)) return res.status(403).json({ error: 'forbidden' });
      const plans = await storage.getHoldingExitPlansForModel(modelId);
      res.json({ plans });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // DELETE /api/auto-trading/exit-plans/:modelId  — 모델 전체 계획 일괄 삭제
  app.delete('/api/auto-trading/exit-plans/:modelId', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(req.params.modelId);
      if (!await verifyModelOwnership(user.id, modelId)) return res.status(403).json({ error: 'forbidden' });
      const plans = await storage.getHoldingExitPlansForModel(modelId);
      await Promise.all(plans.map((p: any) => storage.deleteHoldingExitPlan(modelId, p.stockCode)));
      res.json({ ok: true, deleted: plans.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ==================== Learning Suggestions ====================

  // GET /api/auto-trading/suggestions/pending-count — 사용자 전체 pending 제안 수 (반드시 /:modelId 앞에 등록)
  app.get('/api/auto-trading/suggestions/pending-count', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const count = await storage.countPendingLearningSuggestions(user.id);
      res.json({ count });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/auto-trading/suggestions/:modelId — 제안 목록 (?status=pending,auto_applied 복수 가능)
  app.get('/api/auto-trading/suggestions/:modelId', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(req.params.modelId);
      if (!await verifyModelOwnership(user.id, modelId)) return res.status(403).json({ error: 'forbidden' });
      const rawStatus = req.query.status as string | undefined;
      const status = rawStatus?.includes(',') ? rawStatus.split(',').map(s => s.trim()) : rawStatus;
      const suggestions = await storage.getLearningSuggestions(modelId, status);
      res.json(suggestions);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/auto-trading/suggestions/:id/apply — 개별 제안 적용
  app.post('/api/auto-trading/suggestions/:id/apply', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const id = parseInt(req.params.id);
      const suggestion = await storage.applyLearningSuggestion(id, user.id);
      if (!suggestion) return res.status(404).json({ error: 'not found or forbidden' });
      res.json(suggestion);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/auto-trading/suggestions/:id/dismiss — 개별 제안 무시
  app.post('/api/auto-trading/suggestions/:id/dismiss', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateLearningSuggestionStatus(id, 'dismissed');
      if (!updated) return res.status(404).json({ error: 'not found' });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/auto-trading/suggestions/:modelId/dismiss-all — 모델 전체 pending 제안 무시
  app.post('/api/auto-trading/suggestions/:modelId/dismiss-all', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(req.params.modelId);
      if (!await verifyModelOwnership(user.id, modelId)) return res.status(403).json({ error: 'forbidden' });
      await storage.dismissAllLearningSuggestions(modelId);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // PATCH /api/auto-trading/settings/:modelId/auto-apply-toggle — 자동적용 모드 토글
  app.patch('/api/auto-trading/settings/:modelId/auto-apply-toggle', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(req.params.modelId);
      if (!await verifyModelOwnership(user.id, modelId)) return res.status(403).json({ error: 'forbidden' });
      const { autoApply } = req.body as { autoApply: boolean };
      if (autoApply && !await checkAutoApplyAllowed(user.id)) {
        return res.status(403).json({ error: '학습 자동 적용은 Pro 이상 플랜에서 사용 가능합니다.', code: 'TIER_AUTOPLAY_BLOCKED' });
      }
      const settings = await storage.getAutoTradingSettings(modelId);
      if (!settings) return res.status(404).json({ error: 'settings not found' });
      const currentPolicy = (settings.learningPolicy as Record<string, any>) ?? {};
      await storage.updateAutoTradingSettings(modelId, {
        learningPolicy: { ...currentPolicy, autoApply: Boolean(autoApply) },
      });
      // 토글 ON 전환 시 현재 pending 제안 즉시 적용
      let appliedCount = 0;
      if (autoApply) {
        const pending = await storage.getLearningSuggestions(modelId, 'pending');
        for (const s of pending) {
          const applied = await storage.applyLearningSuggestion(s.id, user.id);
          if (applied) {
            await storage.updateLearningSuggestionStatus(s.id, 'auto_applied');
            appliedCount++;
          }
        }
      }
      res.json({ ok: true, autoApply: Boolean(autoApply), appliedCount });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/auto-trading/simulation/run — 전방 섀도우 시뮬레이션 1사이클 수동 실행 (Track 1)
  // 실주문 미호출·실계좌 무영향. 원본 모델의 신선 후보를 시뮬 모델/계좌로 평가.
  app.post('/api/auto-trading/simulation/run', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(String((req.body as any)?.modelId));
      if (!Number.isFinite(modelId)) return res.status(400).json({ error: 'modelId required' });
      if (!await verifyModelOwnership(user.id, modelId)) return res.status(403).json({ error: 'forbidden' });
      const result = await getSimulationService().runSimCycle(modelId);
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/auto-trading/simulation/race/run — 변종 시합 1사이클(반복 호출로 누적). 실주문 미호출.
  app.post('/api/auto-trading/simulation/race/run', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(String((req.body as any)?.modelId));
      if (!Number.isFinite(modelId)) return res.status(400).json({ error: 'modelId required' });
      const count = Number((req.body as any)?.count);
      if (!await verifyModelOwnership(user.id, modelId)) return res.status(403).json({ error: 'forbidden' });
      const result = await getSimulationService().runRaceCycle(modelId, Number.isFinite(count) ? count : undefined);
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/auto-trading/simulation/race/settle — 변종 채점→1등을 검증된 설정으로 보관(자동 적용 없음).
  app.post('/api/auto-trading/simulation/race/settle', isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const modelId = parseInt(String((req.body as any)?.modelId));
      if (!Number.isFinite(modelId)) return res.status(400).json({ error: 'modelId required' });
      const minTrades = Number((req.body as any)?.minTrades);
      if (!await verifyModelOwnership(user.id, modelId)) return res.status(403).json({ error: 'forbidden' });
      const result = await getSimulationService().settleRace(modelId, Number.isFinite(minTrades) ? minTrades : undefined);
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
