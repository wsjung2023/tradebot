// autotrading.routes.ts - auto-trading related routes
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { AgentTimeoutError, callViaAgent } from "../services/agent-proxy.service";
import { getUserKiwoomService } from "../services/user-kiwoom.service";
import { RainbowChartAnalyzer } from "../formula/rainbow-chart";
import { normalizeChartDataAsc } from "../utils/chart-normalization";
import { z } from "zod";


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

      const logsWithKst = logs.map((row) => ({
        ...row,
        decidedAtKst: toKstDateTime(row.decidedAt),
      }));

      const dailySummaryMap = new Map<string, { total: number; accepted: number; rejected: number }>();
      for (const row of logsWithKst) {
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

      // stockCodes 미전달 시 에이전트로 조건검색 실행
      if (!stockCodes || stockCodes.length === 0) {
        const seq = effectiveSeq;
        console.log(`[backattack-scan] stockCodes 없음 → 에이전트 condition.run(seq=${seq}) 실행`);
        try {
          const conditionResult = await callViaAgent(user.id, "condition.run", { seq }, 30000);
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
        } catch (agentErr: any) {
          if (agentErr instanceof AgentTimeoutError) {
            return res.status(503).json({ error: `에이전트 응답 없음: ${agentErr.message}` });
          }
          return res.status(500).json({ error: `조건검색 실행 실패: ${agentErr.message}` });
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
          await new Promise((r) => setTimeout(r, 100));
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
}
