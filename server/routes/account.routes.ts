// account.routes.ts — 키움증권 계좌 관리 + 서버사이드 Kiwoom API 프록시
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertKiwoomAccountSchema } from "@shared/schema";
import { z } from "zod";
import { callViaAgent, AgentTimeoutError } from "../services/agent-proxy.service";

export function registerAccountRoutes(app: Router) {
  const normalizeAccountNumber = (accountNumber: string) => {
    const digits = accountNumber.replace(/\D/g, "");
    return digits.length === 8 ? digits + "11" : digits;
  };

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

  // API 자격증명 제공 (클라이언트 폴백용) — 환경변수에서 직접 반환
  app.get("/api/kiwoom/credentials", isAuthenticated, async (_req, res) => {
    try {
      const appKey = process.env.KIWOOM_APP_KEY;
      const appSecret = process.env.KIWOOM_APP_SECRET;
      if (!appKey || !appSecret) {
        return res.status(400).json({ error: "서버에 KIWOOM API 키가 설정되지 않았습니다. 집 PC 에이전트를 사용하세요." });
      }
      res.json({
        appKey,
        appSecret,
        baseUrl: "https://api.kiwoom.com",
        mockBaseUrl: "https://mockapi.kiwoom.com",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── 잔고 조회 — 집 PC 에이전트를 통해 키움 REST 호출 ──────────────────────
  app.get("/api/accounts/:accountId/fetch-balance", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.accountId);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const balancePayload = {
        accountNumber: account.accountNumber,
        accountType: account.accountType || "real",
      };
      // dedupeKey: 같은 계좌로 동시에 여러 요청이 오면 하나의 에이전트 job만 등록
      const dedupeKey = `balance.get:${accountId}`;
      let result: any;
      try {
        result = await callViaAgent(user!.id, "balance.get", balancePayload, 15000, dedupeKey);
      } catch (firstErr: any) {
        const msg = String(firstErr?.message ?? "");
        // 빈 응답(JSONDecodeError) 또는 토큰 오류 → 토큰 강제 갱신 후 재시도
        if (msg.includes("Expecting value") || msg.includes("빈 응답") || msg.includes("token") || msg.includes("401")) {
          console.warn("[fetch-balance] 첫 시도 실패 → 토큰 갱신 후 재시도:", msg);
          try {
            await callViaAgent(user!.id, "token.refresh", { accountType: balancePayload.accountType }, 8000);
          } catch (_) { /* 갱신 실패 무시 */ }
          result = await callViaAgent(user!.id, "balance.get", balancePayload, 15000, dedupeKey);
        } else {
          throw firstErr;
        }
      }

      // ────────────────────────────────────────────────────────────────────
      // ⚠️  잔고 파싱 로직 — 변경 금지 (재발 방지 2025)
      // ────────────────────────────────────────────────────────────────────
      // 키움 API는 실계좌/모의계좌에 따라 응답 필드명이 다르다.
      // 에이전트 버전에 따라 raw / output1 / result 위치도 다를 수 있다.
      // 아래 우선순위를 임의로 바꾸면 특정 계좌에서 0원이 표시된다.
      //
      // 실계좌 주요 필드:
      //   주식 평가금액: raw.tot_evlt_amt
      //   예수금:        raw.prsm_dpst_aset_amt
      //   평가손익:      raw.tot_evlt_pl
      //   보유종목 목록: raw.acnt_evlt_remn_indv_tot (배열)
      //     종목코드: stk_cd / 종목명: stk_nm / 수량: rmnd_qty / 현재가: cur_prc
      //
      // 모의계좌 주요 필드:
      //   주식 평가금액: raw.tot_evlu_amt
      //   예수금:        raw.dnca_tot_amt
      //   평가손익:      raw.tot_evlu_pfls
      //     종목코드: acnt_pdno / 종목명: prdt_name / 수량: hldg_qty / 현재가: prpr
      //
      // 총 자산 = tot_evlt_amt(주식평가) + prsm_dpst_aset_amt(예수금)
      // 주식 평가금액만 totalAssets로 쓰면 예수금이 빠진다 → 절대 금지
      // ────────────────────────────────────────────────────────────────────

      // 에이전트 응답: { output1, output2, raw, totalEvaluationAmount, depositAmount, todayProfit }
      // raw가 최우선: 구버전 에이전트는 output1={}로 반환하지만 raw에는 실제 데이터가 있음
      const raw: any = result?.raw || {};
      const output1: any = Object.keys(result?.output1 || {}).length > 0
        ? result.output1
        : raw;
      const output2: any[] = (result?.output2 && result.output2.length > 0)
        ? result.output2
        : (result?.holdings || raw.acnt_evlt_remn_indv_tot || []);

      // 숫자 파싱 헬퍼 (0 문자열 폴백 지원)
      const parseNum = (...fields: (string | undefined | null)[]): number => {
        for (const v of fields) {
          if (v && v !== "0") return parseFloat(v);
        }
        return 0;
      };

      // raw 최상위 필드 우선 → output1 → 에이전트가 계산한 totalEvaluationAmount 순
      const totalAssets = parseNum(
        raw.tot_evlt_amt, raw.tot_evlu_amt, raw.acnt_tot_evlu_amt,
        output1.tot_evlt_amt, output1.tot_evlu_amt,
        result?.totalEvaluationAmount,
      );
      const depositAmount = parseNum(
        raw.prsm_dpst_aset_amt, raw.dnca_tot_amt,
        output1.prsm_dpst_aset_amt, output1.dnca_tot_amt,
        result?.depositAmount,
      );
      const todayProfit = parseNum(
        raw.tot_evlt_pl, raw.tot_evlu_pfls,
        output1.tot_evlt_pl, output1.evlu_pfls_smtl_amt, output1.tot_evlu_pfls,
        result?.todayProfit,
      );

      // DB 보유종목 동기화
      // cleanStr: 빈 문자열·"0"·공백만 있는 경우를 null로 처리 → 폴백 작동하게
      const cleanStr = (v: any): string => {
        const s = String(v ?? "").trim();
        return s && s !== "0" ? s : "";
      };
      for (const item of output2) {
        const stockCode = item.acnt_pdno || item.pdno || item.stk_cd || item.stockCode;
        if (!stockCode) continue;
        const updates = {
          stockName: item.prdt_name || item.stk_nm || item.stockName || "",
          quantity: parseInt(item.hldg_qty || item.rmnd_qty || String(item.quantity ?? "0"), 10),
          averagePrice: cleanStr(item.pchs_avg_pric) || cleanStr(item.avg_pric) || cleanStr(item.averagePrice) || "0",
          currentPrice: cleanStr(item.prpr) || cleanStr(item.cur_prc) || cleanStr(item.currentPrice) || "0",
          profitLoss: cleanStr(item.evlu_pfls_amt) || cleanStr(item.evlu_pfls) || "0",
          profitLossRate: cleanStr(item.evlu_pfls_rt) || cleanStr(item.pfls_rt) || "0",
        };
        const existing = await storage.getHoldingByStock(account.id, stockCode);
        if (existing) await storage.updateHolding(existing.id, updates);
        else await storage.createHolding({ accountId: account.id, stockCode, ...updates });
      }

      // 총 자산 = 주식 평가금액 + 예수금
      const totalAssetsWithDeposit = totalAssets + depositAmount;

      res.json({
        output1,
        output2,
        totalAssets: totalAssetsWithDeposit,
        stockEvalAmount: totalAssets,
        depositAmount,
        todayProfit,
        todayProfitRate: totalAssetsWithDeposit > 0 ? (todayProfit / totalAssetsWithDeposit) * 100 : 0,
      });
    } catch (err: any) {
      console.error("[fetch-balance] 오류:", err.message);
      if (err instanceof AgentTimeoutError) {
        return res.status(503).json({ error: err.message, errorCode: "AGENT_TIMEOUT" });
      }
      res.status(500).json({ error: err.message || "잔고 조회 중 오류가 발생했습니다.", errorCode: "UNKNOWN" });
    }
  });

  // ── 에이전트 연결 테스트 (집 PC 에이전트 ping) ──
  app.get("/api/kiwoom/test-connection", isAuthenticated, async (req, res) => {
    const start = Date.now();
    try {
      const user = getCurrentUser(req);
      const result = await callViaAgent(user!.id, "ping", {}, 8000);
      res.json({ connected: true, ms: Date.now() - start, mode: result?.mode, agent: true });
    } catch (err: any) {
      res.json({ connected: false, ms: Date.now() - start, error: err.message, agent: true });
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

  // 자산 추이 조회 (최근 30일)
  app.get("/api/accounts/:accountId/asset-snapshots", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.accountId);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      // 실제 자산 스냅샷이 쌓이면 여기서 조회
      // 현재는 스냅샷 저장 기능 미구현 → 빈 배열 반환 (가짜 데이터 표시 금지)
      res.json([]);
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
