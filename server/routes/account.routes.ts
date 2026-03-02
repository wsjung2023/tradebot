// account.routes.ts — 키움증권 계좌 관리 및 잔고 동기화 라우터
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertKiwoomAccountSchema } from "@shared/schema";
import { decrypt } from "../utils/crypto";

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

  // 보유 종목 조회 (DB 기준)
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

  // 키움 API 자격증명 제공 (브라우저가 직접 Kiwoom API 호출할 때 사용)
  // HTTPS + 인증세션 보호 하에 복호화된 키 전달
  app.get("/api/kiwoom/credentials", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const settings = await storage.getUserSettings(user!.id);
      const hasUserKeys = !!settings?.kiwoomAppKey && !!settings?.kiwoomAppSecret;
      const hasServerKeys = !!process.env.KIWOOM_APP_KEY && !!process.env.KIWOOM_APP_SECRET;

      if (!hasUserKeys && !hasServerKeys) {
        return res.status(400).json({ error: "API 키가 설정되지 않았습니다. 설정 페이지에서 키움 API 키를 입력해주세요." });
      }

      const appKey = hasUserKeys ? decrypt(settings!.kiwoomAppKey!) : process.env.KIWOOM_APP_KEY!;
      const appSecret = hasUserKeys ? decrypt(settings!.kiwoomAppSecret!) : process.env.KIWOOM_APP_SECRET!;

      res.json({
        appKey,
        appSecret,
        baseUrl: "https://openapi.kiwoom.com:9443",
        mockBaseUrl: "https://openapivts.kiwoom.com:9443",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 브라우저가 Kiwoom API 호출 후 결과를 서버에 저장
  app.post("/api/accounts/:accountId/sync-balance", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.accountId);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const { output1, output2 } = req.body;

      if (Array.isArray(output2)) {
        for (const item of output2) {
          const stockCode = item.pdno;
          if (!stockCode) continue;
          const updates = {
            stockName: item.prdt_name || "",
            quantity: parseInt(item.hldg_qty || "0", 10),
            averagePrice: item.pchs_avg_pric || "0",
            currentPrice: item.prpr || "0",
            profitLoss: item.evlu_pfls_amt || "0",
            profitLossRate: item.evlu_pfls_rt || "0",
          };
          const existing = await storage.getHoldingByStock(account.id, stockCode);
          if (existing) {
            await storage.updateHolding(existing.id, updates);
          } else {
            await storage.createHolding({ accountId: account.id, stockCode, ...updates });
          }
        }
      }

      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 잔고 조회 — 브라우저가 직접 Kiwoom 호출 후 캐시된 보유종목 반환
  app.get("/api/accounts/:accountId/balance", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.accountId);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const snapshots = await (storage as any).getFinancialSnapshots?.(accountId, 30) ?? [];
      const assetHistory = snapshots.map((s: any) => ({
        date: s.date,
        totalAssets: parseFloat(s.totalAssets || "0"),
        profit: parseFloat(s.profit || "0"),
      }));

      res.json({ assetHistory });
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
