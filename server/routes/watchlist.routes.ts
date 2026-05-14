// watchlist.routes.ts — 관심종목, 알림, 사용자 설정, 관심종목 시그널 라우터
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertWatchlistSchema, insertAlertSchema, insertWatchlistSignalSchema } from "@shared/schema";
import { encrypt } from "../utils/crypto";
import { z } from "zod";
import { AgentTimeoutError } from "../services/agent-proxy.service";
import { getUserKiwoomService } from "../services/user-kiwoom.service";
import { RainbowChartAnalyzer } from "../formula/rainbow-chart";
import { normalizeChartDataAsc } from "../utils/chart-normalization";

export function registerWatchlistRoutes(app: Router) {
  const userKiwoomService = getUserKiwoomService();
  const isMissingWatchlistSyncTableError = (error: any) => {
    const message = String(error?.message ?? "");
    const code = String(error?.code ?? "");
    return code === "42P01" || message.includes("watchlist_sync_snapshots") || message.includes("relation");
  };

  const formatSettingsResponse = (settings: any) => {
    if (!settings) return settings;

    return {
      ...settings,
      hasKiwoomKeys: !!settings.kiwoomAppKey && !!settings.kiwoomAppSecret,
      kiwoomAppKey: undefined,
      kiwoomAppSecret: undefined,
    };
  };

  // 관심종목 목록 (Kiwoom 시세 병합)
  app.get("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const list = await storage.getWatchlist(user!.id);
      if (list.length === 0) return res.json([]);

      try {
        const codes = list.map((item) => item.stockCode);
        const priceList: any[] = await userKiwoomService.getWatchlist(user!.id, codes);
        const priceMap: Record<string, any> = {};
        for (const price of priceList) {
          priceMap[price.stockCode] = price;
        }
        return res.json(list.map((item) => ({ ...item, kiwoomData: priceMap[item.stockCode] ?? null })));
      } catch (kiwoomError) {
        console.warn("[Watchlist] 에이전트 시세 조회 실패, DB 데이터만 반환:", kiwoomError);
        return res.json(list);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 관심종목 추가 (종목명 없으면 자동 조회)
  app.post("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      let { stockCode, stockName, ...rest } = req.body;

      if (stockCode && (!stockName || stockName === stockCode)) {
        try {
          const info = await userKiwoomService.getStockInfo(user!.id, String(stockCode));
          if (info?.name) stockName = info.name;
        } catch {
          stockName = stockName || stockCode;
        }
      }

      const data = insertWatchlistSchema.parse({
        ...rest,
        stockCode,
        stockName: stockName || stockCode,
        userId: user!.id,
      });
      res.json(await storage.createWatchlistItem(data));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });


  // Kiwoom HTS 관심종목 동기화 (서버 fetch -> DB 저장/업데이트)

  // HTS 동기화 스냅샷 조회
  app.get("/api/watchlist/sync-snapshots", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const snapshots = await storage.getWatchlistSyncSnapshots(user!.id);
      res.json(snapshots);
    } catch (error: any) {
      if (isMissingWatchlistSyncTableError(error)) {
        return res.status(503).json({
          error: "watchlist_sync_snapshots 테이블이 없습니다. `npm run db:push` 후 서버를 재시작하세요.",
          code: "WATCHLIST_SYNC_TABLE_MISSING",
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // 관심종목 삭제
  // 키움 시세 새로고침 (반드시 /:id 라우트보다 앞에 위치)
  app.post("/api/watchlist/sync/kiwoom", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const list = await storage.getWatchlist(user!.id);
      if (list.length === 0) return res.json({ message: "관심종목이 없습니다", updated: 0 });
      const codes = list.map((item) => item.stockCode);
      const priceList: any[] = await userKiwoomService.getWatchlist(user!.id, codes);
      const priceMap: Record<string, any> = {};
      for (const price of priceList) { priceMap[price.stockCode] = price; }
      const result = list.map((item) => ({ ...item, kiwoomData: priceMap[item.stockCode] ?? null }));
      
      // DB에 스냅샷 저장
      for (const item of result) {
        const syncedPrice = priceMap[item.stockCode];
        if (syncedPrice) {
          await storage.upsertWatchlistSyncSnapshot({
            userId: user!.id,
            stockCode: item.stockCode,
            stockName: item.stockName || "",
            syncedPrice: (syncedPrice.currentPrice || syncedPrice.price || "0").toString(),
            rawPayload: syncedPrice,
            source: "kiwoom_api",
          });
        }
      }
      
      res.json({ message: "키움 시세 새로고침 완료", updated: result.length, items: result });
    } catch (error: any) {
      if (isMissingWatchlistSyncTableError(error)) {
        return res.status(503).json({
          error: "watchlist_sync_snapshots 테이블이 없습니다. `npm run db:push` 후 서버를 재시작하세요.",
          code: "WATCHLIST_SYNC_TABLE_MISSING",
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

    app.delete("/api/watchlist/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteWatchlistItem(parseInt(req.params.id));
      res.json({ message: "Item removed from watchlist" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 알림 목록
  app.get("/api/alerts", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      res.json(await storage.getAlerts(user!.id));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 알림 추가
  app.post("/api/alerts", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const data = insertAlertSchema.parse({ ...req.body, userId: user!.id });
      res.json(await storage.createAlert(data));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // 알림 삭제
  app.delete("/api/alerts/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteAlert(parseInt(req.params.id));
      res.json({ message: "Alert deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 사용자 설정 조회
  app.get("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const settings = await storage.getUserSettings(user!.id);
      res.json(formatSettingsResponse(settings));
    } catch (error: any) {
      console.error('[SETTINGS ERROR]', error?.message, error?.stack?.split('\n').slice(0,3).join('|'));
      res.status(500).json({ error: error.message });
    }
  });

  // 사용자 설정 수정
  app.patch("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const updates = { ...req.body };

      if (typeof updates.kiwoomAppKey === "string" && updates.kiwoomAppKey.trim()) {
        updates.kiwoomAppKey = encrypt(updates.kiwoomAppKey.trim());
      } else {
        delete updates.kiwoomAppKey;
      }

      if (typeof updates.kiwoomAppSecret === "string" && updates.kiwoomAppSecret.trim()) {
        updates.kiwoomAppSecret = encrypt(updates.kiwoomAppSecret.trim());
      } else {
        delete updates.kiwoomAppSecret;
      }

      const settings = await storage.updateUserSettings(user!.id, updates);
      res.json(formatSettingsResponse(settings));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // 관심종목 시그널 조회
  app.get("/api/watchlist/:id/signals", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const watchlistId = parseInt(req.params.id);
      const items = await storage.getWatchlist(user!.id);
      if (!items.find((w) => w.id === watchlistId)) {
        return res.status(404).json({ error: "Watchlist item not found" });
      }
      res.json(await storage.getWatchlistSignals(watchlistId));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 관심종목 시그널 추가
  app.post("/api/watchlist/:id/signals", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const watchlistId = parseInt(req.params.id);
      const items = await storage.getWatchlist(user!.id);
      if (!items.find((w) => w.id === watchlistId)) {
        return res.status(404).json({ error: "Watchlist item not found" });
      }
      const data = insertWatchlistSignalSchema.parse({ ...req.body, watchlistId });
      res.status(201).json(await storage.createWatchlistSignal(data));
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", details: error.errors });
      res.status(500).json({ error: "Failed to create watchlist signal" });
    }
  });

  // 관심종목 시그널 삭제
  app.delete("/api/watchlist/:id/signals/:signalId", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const watchlistId = parseInt(req.params.id);
      const items = await storage.getWatchlist(user!.id);
      if (!items.find((w) => w.id === watchlistId)) {
        return res.status(404).json({ error: "Watchlist item not found" });
      }
      await storage.deleteWatchlistSignal(parseInt(req.params.signalId));
      res.json({ message: "Watchlist signal deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── /api/watchlist-signals — 사용자 전체 시그널 조회/삭제/생성 ────────────
  // watchlist-signals 페이지가 사용하는 flat 라우트

  app.get("/api/watchlist-signals", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const signals = await storage.getAllUserWatchlistSignals(user!.id);
      res.json(signals);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/watchlist-signals/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const signalId = parseInt(req.params.id);
      if (isNaN(signalId)) return res.status(400).json({ error: "Invalid signal id" });
      const allSignals = await storage.getAllUserWatchlistSignals(user!.id);
      const owned = allSignals.find(s => s.id === signalId);
      if (!owned) return res.status(404).json({ error: "Signal not found" });
      await storage.deleteWatchlistSignal(signalId);
      res.json({ message: "Signal deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/watchlist-signals/generate-all", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const watchlistItems = await storage.getWatchlist(user!.id);
      if (!watchlistItems.length) {
        return res.json({ message: "관심종목이 없습니다", generated: 0, failed: 0, total: 0 });
      }

      let generated = 0;
      let failed = 0;
      const errors: Array<{ stockCode: string; stockName: string; error: string }> = [];

      for (const item of watchlistItems) {
        try {
          const rawChartData = await userKiwoomService.getChart(user!.id, item.stockCode, "D", 400);
          const normalized = normalizeChartDataAsc(rawChartData);
          if (!normalized || normalized.length < 240) {
            throw new Error(`차트 데이터 부족: ${normalized?.length || 0}개 (240개 필요)`);
          }

          const rainbow = RainbowChartAnalyzer.analyze(item.stockCode, normalized, 240);
          const strength = RainbowChartAnalyzer.getSignalStrength(rainbow);

          let currentSignal: string;
          if (rainbow.currentPosition <= 30) {
            currentSignal = "buy";
          } else if (rainbow.currentPosition >= 70) {
            currentSignal = "sell";
          } else {
            currentSignal = "neutral";
          }

          const signalData = {
            currentPosition: rainbow.currentPosition,
            CL: rainbow.CL,
            clWidth: rainbow.clWidth,
            current: rainbow.current,
            recommendation: rainbow.recommendation,
            currentZone: rainbow.currentZone,
            signals: rainbow.signals,
            lines: rainbow.lines.map(l => ({ name: l.name, price: l.price, zone: l.zone })),
          };

          const existingSignals = await storage.getWatchlistSignals(item.id);
          if (existingSignals.length > 0) {
            await storage.updateWatchlistSignal(existingSignals[0].id, {
              currentSignal,
              signalStrength: strength.toFixed(2),
              signalData,
              lastCalculatedAt: new Date(),
              updatedAt: new Date(),
            });
          } else {
            await storage.createWatchlistSignal({
              watchlistId: item.id,
              currentSignal,
              signalStrength: strength.toFixed(2),
              signalData,
            });
          }

          generated++;
          console.log(`[signal-gen] ${item.stockName}(${item.stockCode}) → ${currentSignal} (pos=${rainbow.currentPosition.toFixed(1)}%, strength=${strength})`);

          if (generated + failed < watchlistItems.length) {
            await new Promise((r) => setTimeout(r, 100));
          }
        } catch (err: any) {
          failed++;
          errors.push({ stockCode: item.stockCode, stockName: item.stockName, error: err.message });
          console.error(`[signal-gen] ${item.stockName}(${item.stockCode}) 실패: ${err.message}`);
        }
      }

      res.json({
        message: `시그널 생성 완료: ${generated}건 성공, ${failed}건 실패`,
        generated,
        failed,
        total: watchlistItems.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

}
