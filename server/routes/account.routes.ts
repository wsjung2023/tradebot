// account.routes.ts — 키움증권 계좌 관리 + 서버사이드 Kiwoom API 프록시
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertKiwoomAccountSchema } from "@shared/schema";
import { decrypt } from "../utils/crypto";
import { createKiwoomService } from "../services/kiwoom";
import { z } from "zod";

export function registerAccountRoutes(app: Router) {
  // 계좌번호 정규화: 숫자만 추출 후, 정확히 8자리이면 주식 상품코드 "11" 자동 추가
  const normalizeAccountNumber = (accountNumber: string) => {
    const digits = accountNumber.replace(/\D/g, "");
    return digits.length === 8 ? digits + "11" : digits;
  };

  const getAuthorizedAccount = async (userId: string, accountId: number) => {
    const account = await storage.getKiwoomAccount(accountId);
    if (!account || account.userId !== userId) return null;
    return account;
  };

  // 계좌번호 기반 전용 키 조회 (KIWOOM_KEY_{번호} / KIWOOM_SECRET_{번호})
  const getAccountSpecificKeys = (accountNumber: string) => {
    const digits = accountNumber.replace(/\D/g, "").slice(0, 8); // 앞 8자리 기준
    const appKey = process.env[`KIWOOM_KEY_${digits}`];
    const appSecret = process.env[`KIWOOM_SECRET_${digits}`];
    if (appKey && appSecret) return { appKey, appSecret };
    return null;
  };

  const getUserApiKeys = async (userId: string, accountNumber?: string) => {
    // 1순위: 계좌번호 전용 키 (실계좌별 분리)
    if (accountNumber) {
      const specific = getAccountSpecificKeys(accountNumber);
      if (specific) return specific;
    }
    // 2순위: 사용자 설정에 저장된 키
    const settings = await storage.getUserSettings(userId);
    const hasUserKeys = !!settings?.kiwoomAppKey && !!settings?.kiwoomAppSecret;
    if (hasUserKeys) {
      return {
        appKey: decrypt(settings!.kiwoomAppKey!),
        appSecret: decrypt(settings!.kiwoomAppSecret!),
      };
    }
    // 3순위: 서버 공통 환경변수 (모의 전용 폴백)
    const hasServerKeys = !!process.env.KIWOOM_APP_KEY && !!process.env.KIWOOM_APP_SECRET;
    if (!hasServerKeys) return null;
    return {
      appKey: process.env.KIWOOM_APP_KEY!,
      appSecret: process.env.KIWOOM_APP_SECRET!,
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

  // 계좌 수정 (accountType, accountName 변경)
  const patchAccountSchema = z.object({
    accountType: z.enum(["mock", "real"]).optional(),
    accountName: z.string().min(1).optional(),
  });

  app.patch("/api/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.id);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const updates = patchAccountSchema.parse(req.body);
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "변경할 항목이 없습니다." });
      }

      const updated = await storage.updateKiwoomAccount(accountId, updates);
      res.json(updated);
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

  // API 자격증명 제공 (클라이언트 폴백용)
  app.get("/api/kiwoom/credentials", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const keys = await getUserApiKeys(user!.id);
      if (!keys) {
        return res.status(400).json({ error: "API 키가 설정되지 않았습니다." });
      }
      res.json({
        appKey: keys.appKey,
        appSecret: keys.appSecret,
        baseUrl: "https://api.kiwoom.com",
        mockBaseUrl: "https://mockapi.kiwoom.com",
      });
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

      const accountType = (account.accountType as "mock" | "real") || "real";
      const keys = await getUserApiKeys(user!.id, account.accountNumber);
      if (!keys) {
        return res.status(400).json({
          error: "API 키 없음: 설정 페이지에서 키움 API 키를 입력해주세요.",
          errorCode: "NO_API_KEY",
        });
      }

      const kiwoom = createKiwoomService({ ...keys, accountType });

      let data: any;
      try {
        data = await kiwoom.getAccountBalance(account.accountNumber, accountType);
      } catch (err: any) {
        const msg = err.message || "";
        // 특정 에러 원인별 구체적 메시지
        if (msg.includes("API 키가 설정되지 않았습니다")) {
          return res.status(400).json({ error: "API 키 없음: 설정 페이지에서 키움 API 키를 입력해주세요.", errorCode: "NO_API_KEY" });
        }
        if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("timeout") || msg.includes("ECONNABORTED")) {
          return res.status(503).json({ error: "서버 미연결: Kiwoom API 서버에 연결할 수 없습니다. 네트워크를 확인하세요.", errorCode: "SERVER_UNREACHABLE" });
        }
        if (msg.includes("8030") || msg.includes("계좌 타입") || msg.includes("투자구분")) {
          return res.status(400).json({ error: "계좌 타입 불일치: 계좌의 실전/모의 설정이 API 키와 맞지 않습니다.", errorCode: "ACCOUNT_TYPE_MISMATCH" });
        }
        if (msg.includes("인증 실패") || msg.includes("auth error")) {
          return res.status(401).json({ error: "인증 실패: API 키가 올바르지 않습니다. 키움 OpenAPI 페이지에서 확인하세요.", errorCode: "AUTH_FAILED" });
        }
        return res.status(500).json({ error: msg || "잔고 조회 중 오류가 발생했습니다.", errorCode: "UNKNOWN" });
      }

      // 8030 자동 전환 감지: 실제 사용된 서버 타입이 요청한 타입과 다른 경우
      const usedAccountType: "mock" | "real" = data.usedAccountType || accountType;
      let autoSwitched = false;

      if (usedAccountType !== accountType) {
        autoSwitched = true;
        console.warn(`⚠️  [fetch-balance] 계좌 타입 자동 전환 감지: ${accountType} → ${usedAccountType}. DB 업데이트 중...`);
        try {
          await storage.updateKiwoomAccount(accountId, { accountType: usedAccountType });
          console.log(`✅  [fetch-balance] accountType DB 업데이트 완료: ${usedAccountType}`);
        } catch (dbErr: any) {
          console.error("[fetch-balance] DB 업데이트 실패:", dbErr.message);
        }
      }

      // DB에 보유종목 동기화
      const output2 = data.output2 || [];
      for (const item of output2) {
        // Kiwoom REST API: acnt_pdno, KIS fallback: pdno
        const stockCode = item.acnt_pdno || item.pdno || item.stk_cd;
        if (!stockCode) continue;
        const updates = {
          stockName: item.prdt_name || item.stk_nm || "",
          quantity: parseInt(item.hldg_qty || item.rmnd_qty || "0", 10),
          averagePrice: item.pchs_avg_pric || item.avg_pric || "0",
          currentPrice: item.prpr || item.cur_prc || "0",
          profitLoss: item.evlu_pfls_amt || item.evlu_pfls || "0",
          profitLossRate: item.evlu_pfls_rt || item.pfls_rt || "0",
        };
        const existing = await storage.getHoldingByStock(account.id, stockCode);
        if (existing) {
          await storage.updateHolding(existing.id, updates);
        } else {
          await storage.createHolding({ accountId: account.id, stockCode, ...updates });
        }
      }

      const output1 = data.output1 || {} as any;
      const totalAssets = parseFloat(output1.tot_evlu_amt || output1.acnt_tot_evlu_amt || "0");
      const todayProfit = parseFloat(output1.evlu_pfls_smtl_amt || output1.tot_evlu_pfls || "0");

      res.json({
        output1,
        output2,
        totalAssets,
        todayProfit,
        todayProfitRate: totalAssets > 0 ? (todayProfit / totalAssets) * 100 : 0,
        autoSwitched,
        usedAccountType,
      });
    } catch (error: any) {
      console.error("[fetch-balance] 오류:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Kiwoom API 연결 테스트 (api.kiwoom.com 443 포트) ──
  app.get("/api/kiwoom/test-connection", isAuthenticated, async (req, res) => {
    const axios = (await import("axios")).default;
    const start = Date.now();
    try {
      const r = await axios.post(
        "https://api.kiwoom.com/oauth2/token",
        { grant_type: "client_credentials", appkey: "test", secretkey: "test" },
        { timeout: 5000, headers: { "Content-Type": "application/json;charset=UTF-8" } }
      );
      const ms = Date.now() - start;
      const code = (r.data as any)?.return_code;
      // return_code 3 = "인증 실패" — 서버 도달 성공을 의미
      res.json({ connected: true, ms, host: "api.kiwoom.com", port: 443, note: (r.data as any)?.return_msg });
    } catch (e: any) {
      res.json({ connected: false, ms: Date.now() - start, error: e.code || e.message, host: "api.kiwoom.com", port: 443 });
    }
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

  // 브라우저 폴백 결과 서버 동기화 (클라이언트 직접 호출 성공 시)
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
