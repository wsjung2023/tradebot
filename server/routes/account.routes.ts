// account.routes.ts — 키움증권 계좌 관리 + 서버사이드 Kiwoom API 프록시
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertKiwoomAccountSchema } from "@shared/schema";
import { z } from "zod";
import { checkRealAccountLimit, refreshUserAumTier } from "../services/tier-limits.service";
import { parseHoldingItem } from "../utils/balance-parser";
import { evaluateHoldingSyncGuard } from "../utils/holding-sync-guard";
import { getUserKiwoomService } from "../services/user-kiwoom.service";
import { encrypt, decrypt, isEncrypted } from "../utils/crypto";

export function registerAccountRoutes(app: Router) {
  const normalizeAccountNumber = (accountNumber: string, productCode?: string) => {
    const digits = accountNumber.replace(/\D/g, "");
    // 키움 계좌번호는 8자리 계좌번호 + 2자리 상품코드 형태가 될 수 있다.
    // 사용자가 8자리만 입력하면 화면에서 선택한 상품코드(10/11)를 보완한다.
    const normalizedProductCode = productCode === "10" || productCode === "11" ? productCode : "11";
    return digits.length === 8 ? digits + normalizedProductCode : digits;
  };

  const getAuthorizedAccount = async (userId: string, accountId: number) => {
    const account = await storage.getKiwoomAccount(accountId);
    if (!account || account.userId !== userId) return null;
    return account;
  };

  // 계좌 목록 조회
  function maskKey(val: string | null | undefined): string {
    if (!val) return "";
    const plain = isEncrypted(val) ? decrypt(val) : val;
    return plain.length <= 8 ? "****" : "****" + plain.slice(-4);
  }

  app.get("/api/accounts", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accounts = await storage.getKiwoomAccounts(user!.id);
      res.json(accounts.map((a: any) => ({
        ...a,
        hasApiKey: !!a.kiwoomAppKey,
        maskedApiKey: maskKey(a.kiwoomAppKey),
        kiwoomAppKey: undefined,
        kiwoomAppSecret: undefined,
      })));
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
        accountNumber: normalizeAccountNumber(req.body.accountNumber || "", req.body.productCode),
        userId: user!.id,
      });

      // 실계좌 추가 시 티어 한도 체크
      if (accountData.accountType === 'real') {
        const limit = await checkRealAccountLimit(user!.id);
        if (!limit.allowed) {
          return res.status(403).json({
            error: `실계좌는 현재 플랜에서 최대 ${limit.max}개까지 연결 가능합니다. (현재 ${limit.current}개)`,
            code: 'REAL_ACCOUNT_LIMIT_EXCEEDED',
          });
        }
      }

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
    isActive: z.boolean().optional(),
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

  // 계좌별 API 키 등록/교체
  app.put("/api/accounts/:id/api-key", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.id);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const { appKey, appSecret } = req.body;
      if (!appKey || !appSecret || appKey.length < 8 || appSecret.length < 8) {
        return res.status(400).json({ error: "APP KEY와 APP SECRET을 모두 입력해주세요" });
      }

      await storage.updateKiwoomAccount(accountId, {
        kiwoomAppKey: encrypt(appKey.trim()),
        kiwoomAppSecret: encrypt(appSecret.trim()),
      });

      // 캐시 무효화 → 다음 API 호출 시 새 키 사용
      getUserKiwoomService().invalidateAccountCache(accountId);

      res.json({ ok: true, masked: maskKey(encrypt(appKey.trim())) });
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

  // 보안 하드닝: 브라우저로 키움 시크릿 전달 금지 (완전 비활성)
  app.get("/api/kiwoom/credentials", isAuthenticated, async (_req, res) => {
    return res.status(410).json({
      error: "이 엔드포인트는 보안상 완전 비활성화되었습니다. 키움 호출은 서버/에이전트 경유만 지원합니다.",
    });
  });

  // ── 잔고 조회 — 서버 직접 키움 REST 호출 (Agent-less) ─────────────────────
  app.get("/api/accounts/:accountId/fetch-balance", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.accountId);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const userKiwoom = getUserKiwoomService();
      const result = await userKiwoom.getBalance(
        user!.id,
        account.accountNumber,
        (account.accountType || "real") as "mock" | "real",
        account.id,
      );

      const output1: any = result.output1 || {};
      const output2: any[] = result.output2 || [];

      const parseNum = (...fields: (string | undefined | null)[]): number => {
        for (const v of fields) { if (v && v !== "0") return parseFloat(v); }
        return 0;
      };

      const stockEvalAmount = parseNum(output1.evlu_amt_smtl_amt, output1.tot_evlu_amt);
      // prsm_dpst_aset_amt = 추정예탁자산 (주식평가 + 현금 - 미수금 등, 이미 총자산 개념)
      // dnca_tot_amt = D+0 현금 예수금
      const totalAssetsWithDeposit = parseNum(output1.prsm_dpst_aset_amt) || (stockEvalAmount + parseNum(output1.dnca_tot_amt));
      const depositAmount = parseNum(output1.dnca_tot_amt);
      const todayProfit = parseNum(output1.evlu_pfls_smtl_amt, output1.tot_evlu_pfls);

      // DB 보유종목 동기화 (parseHoldingItem: server/utils/balance-parser.ts)
      // 먼저 기존 보유종목 전체 삭제 후 새로 받은 종목만 저장 (stale 데이터 방지)
      const parsedHoldings: Array<{ stockCode: string; updates: ReturnType<typeof parseHoldingItem> }> = [];
      for (const item of output2) {
        const parsed = parseHoldingItem(item);
        if (!parsed.stockCode) continue;
        parsedHoldings.push({ stockCode: parsed.stockCode, updates: parsed });
      }
      const existingHoldings = await storage.getHoldings(account.id);
      const guard = evaluateHoldingSyncGuard({
        parsedHoldings: parsedHoldings.map((h) => h.updates),
        existingHoldingsCount: existingHoldings.length,
        expectedStockEvalAmount: stockEvalAmount,
      });
      if (guard.preserveExisting) {
        storage.createEngineNotification({
          userId: user!.id,
          severity: "warn",
          type: "SYNC",
          message: `[BalanceSyncGuard] account ${account.accountNumber} holdings snapshot flagged (${guard.reason}) - preserving existing ${existingHoldings.length}`,
          payload: {
            accountId: account.id,
            accountNumber: account.accountNumber,
            existingHoldingsCount: existingHoldings.length,
            parsedHoldingsCount: guard.parsedCount,
            evalCoverage: guard.evalCoverage,
            parsedEvalAmount: guard.parsedEvalAmount,
            expectedStockEvalAmount: guard.expectedStockEvalAmount,
          },
        }).catch(() => {});
      } else {
        await storage.deleteHoldingsByAccount(account.id);
        for (const { stockCode, updates } of parsedHoldings) {
          const { stockCode: _ignored, ...holdingUpdates } = updates;
          await storage.createHolding({ accountId: account.id, stockCode, ...holdingUpdates });
        }
      }

      const todayProfitRate = totalAssetsWithDeposit > 0 ? (todayProfit / totalAssetsWithDeposit) * 100 : 0;

      // 마지막 잔고 캐시를 계좌 레코드에 저장 (페이지 진입 시 표시용)
      await storage.updateKiwoomAccount(account.id, {
        lastTotalAssets: String(totalAssetsWithDeposit),
        lastDepositAmount: String(depositAmount),
        lastTodayProfit: String(todayProfit),
        lastTodayProfitRate: String(todayProfitRate),
        lastBalanceFetchedAt: new Date(),
      });
      // 실계좌 총 AUM 변경 반영 (구독 페이지 표시용, fire-and-forget)
      refreshUserAumTier(user!.id).catch(() => {});

      res.json({
        output1,
        output2,
        totalAssets: totalAssetsWithDeposit,
        stockEvalAmount,
        depositAmount,
        todayProfit,
        todayProfitRate,
      });
    } catch (err: any) {
      console.error("[fetch-balance] 오류:", err.message);
      res.status(500).json({ error: err.message || "잔고 조회 중 오류가 발생했습니다.", errorCode: "UNKNOWN" });
    }
  });

  // ── Kiwoom API 연결 테스트 (서버 직접 인증 확인) ──
  app.get("/api/kiwoom/test-connection", isAuthenticated, async (req, res) => {
    const start = Date.now();
    try {
      const user = getCurrentUser(req);
      const kiwoom = getUserKiwoomService();
      // 가벼운 시세 조회로 Kiwoom API 연결 확인
      await kiwoom.getPrice(user!.id, "005930");
      res.json({ connected: true, ms: Date.now() - start, mode: "direct", agent: false });
    } catch (err: any) {
      res.json({ connected: false, ms: Date.now() - start, error: err.message, agent: false });
    }
  });

  // 잔고 캐시 & 히스토리 조회
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

      // 마지막으로 성공한 잔고 조회 값 반환
      const cachedBalance = (account as any).lastTotalAssets != null ? {
        totalAssets: parseFloat((account as any).lastTotalAssets),
        depositAmount: parseFloat((account as any).lastDepositAmount || "0"),
        todayProfit: parseFloat((account as any).lastTodayProfit || "0"),
        todayProfitRate: parseFloat((account as any).lastTodayProfitRate || "0"),
        fetchedAt: (account as any).lastBalanceFetchedAt,
      } : null;

      res.json({ assetHistory, cachedBalance });
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
        const parseNum = (...fields: (string | undefined | null)[]): number => {
          for (const v of fields) { if (v && v !== "0") return parseFloat(v); }
          return 0;
        };
        const expectedStockEvalAmount = parseNum(output1?.evlu_amt_smtl_amt, output1?.tot_evlu_amt);
        const parsedHoldings: Array<{ stockCode: string; updates: ReturnType<typeof parseHoldingItem>; raw: any }> = [];
        for (const item of output2) {
          const parsed = parseHoldingItem(item);
          if (!parsed.stockCode) continue;
          parsedHoldings.push({ stockCode: parsed.stockCode, updates: parsed, raw: item });
        }

        const existingHoldings = await storage.getHoldings(account.id);
        const guard = evaluateHoldingSyncGuard({
          parsedHoldings: parsedHoldings.map((h) => h.updates),
          existingHoldingsCount: existingHoldings.length,
          expectedStockEvalAmount,
        });
        if (guard.preserveExisting) {
          storage.createEngineNotification({
            userId: user!.id,
            severity: "warn",
            type: "SYNC",
            message: `[BalanceSyncGuard] sync-balance account ${account.accountNumber} snapshot flagged (${guard.reason}) - preserving existing ${existingHoldings.length}`,
            payload: {
              accountId: account.id,
              accountNumber: account.accountNumber,
              existingHoldingsCount: existingHoldings.length,
              parsedHoldingsCount: guard.parsedCount,
              evalCoverage: guard.evalCoverage,
              parsedEvalAmount: guard.parsedEvalAmount,
              expectedStockEvalAmount: guard.expectedStockEvalAmount,
            },
          }).catch(() => {});
        } else {
          await storage.deleteHoldingsByAccount(account.id);
          for (const { stockCode, updates, raw } of parsedHoldings) {
            const { stockCode: _ignored, ...holdingUpdates } = updates;
            console.log(`[sync-balance] 종목 파싱: code=${stockCode} name=${holdingUpdates.stockName} avgPrc=${holdingUpdates.averagePrice} plRate=${holdingUpdates.profitLossRate} rawFields={pchs_avg_pric:${raw.pchs_avg_pric},pur_pric:${raw.pur_pric},prft_rt:${raw.prft_rt}}`);
            await storage.createHolding({ accountId: account.id, stockCode, ...holdingUpdates });
          }
        }
      }
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 자산 추이 조회 (최근 30일)
  app.get("/api/accounts/:accountId/asset-snapshots", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.accountId);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const daysRaw = req.query.days as string | undefined;
      const days = daysRaw ? parseInt(daysRaw) : 30;
      if (daysRaw && (isNaN(days) || days < 1)) {
        return res.status(400).json({ error: "Invalid days parameter" });
      }
      const snapshots = await storage.getAssetSnapshots(accountId, days);
      res.json(snapshots);
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
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const hasDateFilter = !!(startDate || endDate);
      const limit = hasDateFilter ? 10000 : (req.query.limit ? parseInt(req.query.limit as string) : 100);
      if (req.query.limit && isNaN(parseInt(req.query.limit as string))) {
        return res.status(400).json({ error: "Invalid limit parameter" });
      }
      let orders = await storage.getOrders(accountId, limit);
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) return res.status(400).json({ error: "Invalid startDate format" });
        orders = orders.filter(o => new Date(o.createdAt).getTime() >= start.getTime());
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) return res.status(400).json({ error: "Invalid endDate format" });
        end.setDate(end.getDate() + 1);
        orders = orders.filter(o => new Date(o.createdAt).getTime() < end.getTime());
      }
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/portfolio/holdings", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
      const accountType = req.query.accountType === "mock" || req.query.accountType === "real"
        ? req.query.accountType
        : undefined;
      const activeOnly = req.query.activeOnly !== "false";
      const holdings = await (storage as any).getAllHoldingsForUser(user!.id, {
        activeOnly,
        accountType,
        accountId: Number.isFinite(accountId) ? accountId : undefined,
      });
      res.json({ holdings });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
