// account.routes.ts — 키움증권 계좌 관리 + 서버사이드 Kiwoom API 프록시
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertKiwoomAccountSchema } from "@shared/schema";
import { decrypt } from "../utils/crypto";
import { createKiwoomService } from "../services/kiwoom";

export function registerAccountRoutes(app: Router) {
  const normalizeAccountNumber = (accountNumber: string) => accountNumber.replace(/\D/g, "");

  const getAuthorizedAccount = async (userId: string, accountId: number) => {
    const account = await storage.getKiwoomAccount(accountId);
    if (!account || account.userId !== userId) return null;
    return account;
  };

  const getUserApiKeys = async (userId: string) => {
    const settings = await storage.getUserSettings(userId);
    const hasUserKeys = !!settings?.kiwoomAppKey && !!settings?.kiwoomAppSecret;
    const hasServerKeys = !!process.env.KIWOOM_APP_KEY && !!process.env.KIWOOM_APP_SECRET;
    if (!hasUserKeys && !hasServerKeys) return null;
    return {
      appKey: hasUserKeys ? decrypt(settings!.kiwoomAppKey!) : process.env.KIWOOM_APP_KEY!,
      appSecret: hasUserKeys ? decrypt(settings!.kiwoomAppSecret!) : process.env.KIWOOM_APP_SECRET!,
    };
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

  // ── 서버사이드 잔고 조회 (서버가 Kiwoom API 직접 호출) ──────────────────────
  // 이전의 클라이언트사이드 CORS 방식 대체
  app.get("/api/accounts/:accountId/fetch-balance", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.accountId);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const keys = await getUserApiKeys(user!.id);
      if (!keys) {
        return res.status(400).json({ error: "API 키가 설정되지 않았습니다. 설정 페이지에서 키움 API 키를 입력해주세요." });
      }

      const accountType = (account.accountType as "mock" | "real") || "real";
      const kiwoom = createKiwoomService(keys);
      const data = await kiwoom.getAccountBalance(account.accountNumber, accountType);

      // DB에 보유종목 동기화
      const output2 = data.output2 || [];
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

      const output1 = data.output1 || {} as any;
      const totalAssets = parseFloat(output1.tot_evlu_amt || "0");
      const todayProfit = parseFloat(output1.evlu_pfls_smtl_amt || "0");

      res.json({
        output1,
        output2,
        totalAssets,
        todayProfit,
        todayProfitRate: totalAssets > 0 ? (todayProfit / totalAssets) * 100 : 0,
      });
    } catch (error: any) {
      const isNetworkError = error.code === "ECONNABORTED" || error.code === "ECONNREFUSED"
        || error.code === "ENOTFOUND" || error.message?.includes("timeout")
        || error.message?.includes("ECONNRESET");
      if (isNetworkError) {
        return res.status(503).json({
          error: "KIWOOM_NETWORK_BLOCKED",
          message: "서버에서 Kiwoom API(9443포트)에 접근 불가. 한국 서버 배포가 필요합니다.",
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ── Kiwoom API 연결 테스트 (배포 환경에서 9443 포트 접근 가능 여부 확인) ──
  app.get("/api/kiwoom/test-connection", isAuthenticated, async (req, res) => {
    const net = await import("net");
    const start = Date.now();
    await new Promise<void>((resolve) => {
      const sock = new net.Socket();
      sock.setTimeout(5000);
      sock.on("connect", () => {
        sock.destroy();
        res.json({ connected: true, ms: Date.now() - start, host: "openapi.kiwoom.com", port: 9443 });
        resolve();
      });
      sock.on("error", (e: any) => {
        sock.destroy();
        res.json({ connected: false, ms: Date.now() - start, error: e.code, host: "openapi.kiwoom.com", port: 9443 });
        resolve();
      });
      sock.on("timeout", () => {
        sock.destroy();
        res.json({ connected: false, ms: Date.now() - start, error: "TIMEOUT", host: "openapi.kiwoom.com", port: 9443 });
        resolve();
      });
      sock.connect(9443, "openapi.kiwoom.com");
    });
  });

  // 잔고 히스토리 조회 (자산 추이 차트용)
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
