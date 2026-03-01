// watchlist.routes.ts — 관심종목, 알림, 사용자 설정, 관심종목 시그널 라우터
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertWatchlistSchema, insertAlertSchema, insertWatchlistSignalSchema } from "@shared/schema";
import { z } from "zod";

export function registerWatchlistRoutes(app: Router) {

  // 관심종목 목록
  app.get("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      res.json(await storage.getWatchlist(user!.id));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 관심종목 추가
  app.post("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const data = insertWatchlistSchema.parse({ ...req.body, userId: user!.id });
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
      res.json(await storage.getUserSettings(user!.id));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 사용자 설정 수정
  app.patch("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      res.json(await storage.updateUserSettings(user!.id, req.body));
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
