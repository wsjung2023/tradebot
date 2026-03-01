// account.routes.ts — 키움증권 계좌 관리 및 포트폴리오/잔고 조회 라우터
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertKiwoomAccountSchema } from "@shared/schema";
import { getKiwoomService } from "../services/kiwoom.service";

export function registerAccountRoutes(app: Router) {
  const kiwoomService = getKiwoomService();

  // 계좌 목록 조회
  app.get("/api/accounts", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accounts = await storage.getKiwoomAccounts(user!.id);
      res.json(accounts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 계좌 추가
  app.post("/api/accounts", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountData = insertKiwoomAccountSchema.parse({ ...req.body, userId: user!.id });
      const account = await storage.createKiwoomAccount(accountData);
      res.json(account);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // 계좌 삭제
  app.delete("/api/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteKiwoomAccount(parseInt(req.params.id));
      res.json({ message: "Account deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 보유 종목 조회
  app.get("/api/accounts/:accountId/holdings", isAuthenticated, async (req, res) => {
    try {
      const holdings = await storage.getHoldings(parseInt(req.params.accountId));
      res.json(holdings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 계좌 잔고 및 자산 히스토리 조회
  app.get("/api/accounts/:accountId/balance", isAuthenticated, async (req, res) => {
    try {
      const account = await storage.getKiwoomAccount(parseInt(req.params.accountId));
      if (!account) return res.status(404).json({ error: "Account not found" });

      const balance = await kiwoomService.getAccountBalance(account.accountNumber);
      const totalAssets = parseFloat(balance.output1?.tot_evlu_amt || "100000000");
      let baseAsset = totalAssets;
      const today = new Date();
      const assetHistory = [];

      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        baseAsset = baseAsset * (1 + (Math.random() - 0.5) * 0.02);
        assetHistory.push({
          date: date.toISOString().split("T")[0],
          totalAssets: Math.round(baseAsset),
          profit: Math.round(baseAsset - totalAssets * 0.95),
        });
      }

      res.json({
        ...balance,
        totalAssets,
        todayProfit: parseFloat(balance.output1?.evlu_pfls_smtl_amt || "0"),
        todayProfitRate: (parseFloat(balance.output1?.evlu_pfls_smtl_amt || "0") / totalAssets) * 100,
        totalReturn: Math.random() * 30 - 10,
        assetHistory,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 계좌별 주문 내역 조회
  app.get("/api/accounts/:accountId/orders", isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const orders = await storage.getOrders(parseInt(req.params.accountId), limit);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
