// watchlist.routes.ts — 관심종목, 알림, 사용자 설정, 관심종목 시그널 라우터
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertWatchlistSchema, insertAlertSchema, insertWatchlistSignalSchema } from "@shared/schema";
import { encrypt } from "../utils/crypto";
import { z } from "zod";
import { getKiwoomService } from "../services/kiwoom";

export function registerWatchlistRoutes(app: Router) {
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
        const kiwoom = getKiwoomService();
        const codes = list.map((item) => item.stockCode);
        const priceList = await kiwoom.getWatchlistInfo(codes);
        const priceMap: Record<string, any> = {};
        for (const price of priceList) {
          priceMap[price.stockCode] = price;
        }

        return res.json(list.map((item) => ({ ...item, kiwoomData: priceMap[item.stockCode] ?? null })));
      } catch (kiwoomError) {
        console.warn("[Watchlist] Kiwoom 시세 조회 실패, DB 데이터만 반환:", kiwoomError);
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
          const kiwoom = getKiwoomService();
          const info = await kiwoom.getStockInfo(String(stockCode));
          if (info.name) stockName = info.name;
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

  // 관심종목 삭제
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
}
