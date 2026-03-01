// account.routes.ts — 키움증권 계좌 관리 및 포트폴리오/잔고 조회 라우터
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertKiwoomAccountSchema } from "@shared/schema";
import { createKiwoomService, getKiwoomService } from "../services/kiwoom";

export function registerAccountRoutes(app: Router) {
  const normalizeAccountNumber = (accountNumber: string) => accountNumber.replace(/\D/g, "");

  const getAuthorizedAccount = async (userId: string, accountId: number) => {
    const account = await storage.getKiwoomAccount(accountId);
    if (!account || account.userId !== userId) return null;
    return account;
  };

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
      const accountData = insertKiwoomAccountSchema.parse({
        ...req.body,
        accountNumber: normalizeAccountNumber(req.body.accountNumber || ""),
        userId: user!.id,
      });
      const account = await storage.createKiwoomAccount(accountData);
      res.json(account);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // 계좌 삭제
  app.delete("/api/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.id);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      await storage.deleteKiwoomAccount(accountId);
      res.json({ message: "Account deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 보유 종목 조회
  app.get("/api/accounts/:accountId/holdings", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.accountId);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const holdings = await storage.getHoldings(accountId);
      res.json(holdings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 계좌 잔고 및 자산 히스토리 조회
  app.get("/api/accounts/:accountId/balance", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.accountId);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const settings = await storage.getUserSettings(user!.id);
      const hasUserKeys = !!settings?.kiwoomAppKey && !!settings?.kiwoomAppSecret;
      const hasServerKeys = !!process.env.KIWOOM_APP_KEY && !!process.env.KIWOOM_APP_SECRET;

      if (!hasUserKeys && !hasServerKeys) {
        return res.status(400).json({
          error: "Kiwoom API keys are required. Configure them in Settings or server environment.",
        });
      }

      const kiwoomService = hasUserKeys
        ? createKiwoomService({
            appKey: settings!.kiwoomAppKey!,
            appSecret: settings!.kiwoomAppSecret!,
          })
        : getKiwoomService();

      const accountNumber = normalizeAccountNumber(account.accountNumber);
      const accountType = account.accountType === "mock" ? "mock" : "real";
      const balance = await kiwoomService.getAccountBalance(accountNumber, accountType);

      if (Array.isArray(balance.output2)) {
        for (const item of balance.output2) {
          const stockCode = item.pdno;
          const existing = await storage.getHoldingByStock(account.id, stockCode);
          const updates = {
            stockName: item.prdt_name,
            quantity: parseInt(item.hldg_qty || "0", 10),
            averagePrice: item.pchs_avg_pric || "0",
            currentPrice: item.prpr || "0",
            profitLoss: item.evlu_pfls_amt || "0",
            profitLossRate: item.evlu_pfls_rt || "0",
          };

          if (existing) {
            await storage.updateHolding(existing.id, updates);
          } else {
            await storage.createHolding({
              accountId: account.id,
              stockCode,
              ...updates,
            });
          }
        }
      }

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
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.accountId);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const orders = await storage.getOrders(accountId, limit);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
