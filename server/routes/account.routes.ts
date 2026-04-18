// account.routes.ts — 키움증권 계좌 관리 + 서버사이드 Kiwoom API 프록시
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { insertKiwoomAccountSchema } from "@shared/schema";
import { z } from "zod";
import { callViaAgent, AgentTimeoutError } from "../services/agent-proxy.service";
import { parseHoldingItem } from "../utils/balance-parser";
import { isAgentConnected, getAgentLastSeenSecondsAgo } from "./kiwoom-agent.routes";

// NOTE: 과거 "에이전트 timeout 시 서버가 직접 키움 REST 호출" fallback이 있었으나
//       Replit 서버 IP가 키움 OpenAPI 포털에 등록되어 있지 않아 항상 8050(IP 미등록)으로 실패.
//       매 호출마다 무의미한 외부 요청 + 로그 오염만 발생시키므로 2026-04 제거됨.
//       에이전트 timeout = 503 AGENT_TIMEOUT 으로 즉시 응답한다.

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

  // 보안 하드닝: 브라우저로 키움 시크릿 전달 금지 (완전 비활성)
  app.get("/api/kiwoom/credentials", isAuthenticated, async (_req, res) => {
    return res.status(410).json({
      error: "이 엔드포인트는 보안상 완전 비활성화되었습니다. 키움 호출은 서버/에이전트 경유만 지원합니다.",
    });
  });

  // ── 잔고 조회 — 집 PC 에이전트를 통해 키움 REST 호출 ──────────────────────
  app.get("/api/accounts/:accountId/fetch-balance", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountId = parseInt(req.params.accountId);
      const account = await getAuthorizedAccount(user!.id, accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      // ── 에이전트 미연결 조기 거절 (15초 기다릴 필요 없음) ──────────────────
      // 임계값 적응형: 장중(09:00-16:00 KST 평일)에는 60초, 장외에는 360초
      // 장외 에이전트 idle 폴링 기본값(300초) + 60초 여유를 두어 오판을 방지한다.
      // 단, 실제 미연결 시 callViaAgent가 15초 timeout을 일으키지 않도록
      // 장외에서도 360초를 초과한 경우엔 즉시 거절한다.
      const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const kstHour = nowKst.getUTCHours();
      const kstDay = nowKst.getUTCDay(); // 0=일, 6=토
      const isMarketHours = kstDay >= 1 && kstDay <= 5 && kstHour >= 9 && kstHour < 16;
      const agentConnectThresholdSec = isMarketHours ? 60 : 360;
      if (!isAgentConnected(agentConnectThresholdSec)) {
        const ago = getAgentLastSeenSecondsAgo();
        const agoLabel = ago === null ? "한 번도 폴링 없음" : `마지막 폴링 ${ago}초 전`;
        return res.status(503).json({
          error: `집 PC 에이전트가 연결되어 있지 않습니다 (${agoLabel}). 에이전트를 실행하고 다시 시도해 주세요.`,
          errorCode: "AGENT_OFFLINE",
        });
      }

      const balancePayload = {
        accountNumber: account.accountNumber,
        accountType: account.accountType || "real",
      };
      // dedupeKey: 같은 계좌로 동시에 여러 요청이 오면 하나의 에이전트 job만 등록
      const dedupeKey = `balance.get:${accountId}`;
      let result: any;
      try {
        // 장외(주말/야간)에도 에이전트 폴링 대기를 감안해 45초 timeout 사용
        // (에이전트 POLL_INTERVAL_IDLE=20초 + Kiwoom API 응답시간 여유)
        result = await callViaAgent(user!.id, "balance.get", balancePayload, 45000, dedupeKey);
      } catch (firstErr: any) {
        const msg = String(firstErr?.message ?? "");
        // 빈 응답(JSONDecodeError) 또는 토큰 오류 → 토큰 강제 갱신 후 재시도
        // "Token이 유효하지 않습니다" (대문자) / "8005" / "인증에 실패" 모두 포함
        const msgLower = msg.toLowerCase();
        const isTokenError = msgLower.includes("token") || msg.includes("8005") || msg.includes("인증에 실패") || msg.includes("401");
        if (msg.includes("Expecting value") || msg.includes("빈 응답") || isTokenError) {
          console.warn("[fetch-balance] 첫 시도 실패 → 토큰 갱신 후 재시도:", msg);
          try {
            await callViaAgent(user!.id, "token.refresh", { accountType: balancePayload.accountType }, 8000);
          } catch (_) { /* 갱신 실패 무시 */ }
          // 재시도도 실패하면 그대로 throw — Replit IP는 키움 포털 미등록이라 직접 호출 불가
          result = await callViaAgent(user!.id, "balance.get", balancePayload, 45000, dedupeKey);
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

      // DB 보유종목 동기화 (parseHoldingItem: server/utils/balance-parser.ts)
      // 먼저 기존 보유종목 전체 삭제 후 새로 받은 종목만 저장 (stale 데이터 방지)
      await storage.deleteHoldingsByAccount(account.id);
      for (const item of output2) {
        const parsed = parseHoldingItem(item);
        if (!parsed.stockCode) continue;
        const { stockCode, ...updates } = parsed;
        console.log(`[fetch-balance] 종목 파싱: code=${stockCode} name=${updates.stockName} qty=${updates.quantity} avgPrc=${updates.averagePrice} curPrc=${updates.currentPrice} pl=${updates.profitLoss} plRate=${updates.profitLossRate} rawFields={pchs_avg_pric:${item.pchs_avg_pric},pur_pric:${item.pur_pric},prft_rt:${item.prft_rt},evltv_prft:${item.evltv_prft}}`);
        await storage.createHolding({ accountId: account.id, stockCode, ...updates });
      }

      // 총 자산 = 주식 평가금액 + 예수금
      const totalAssetsWithDeposit = totalAssets + depositAmount;
      const todayProfitRate = totalAssetsWithDeposit > 0 ? (todayProfit / totalAssetsWithDeposit) * 100 : 0;

      // 마지막 잔고 캐시를 계좌 레코드에 저장 (페이지 진입 시 표시용)
      await storage.updateKiwoomAccount(account.id, {
        lastTotalAssets: String(totalAssetsWithDeposit),
        lastDepositAmount: String(depositAmount),
        lastTodayProfit: String(todayProfit),
        lastTodayProfitRate: String(todayProfitRate),
        lastBalanceFetchedAt: new Date(),
      });

      res.json({
        output1,
        output2,
        totalAssets: totalAssetsWithDeposit,
        stockEvalAmount: totalAssets,
        depositAmount,
        todayProfit,
        todayProfitRate,
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
        await storage.deleteHoldingsByAccount(account.id);
        for (const item of output2) {
          const parsed = parseHoldingItem(item);
          if (!parsed.stockCode) continue;
          const { stockCode, ...updates } = parsed;
          console.log(`[sync-balance] 종목 파싱: code=${stockCode} name=${updates.stockName} avgPrc=${updates.averagePrice} plRate=${updates.profitLossRate} rawFields={pchs_avg_pric:${item.pchs_avg_pric},pur_pric:${item.pur_pric},prft_rt:${item.prft_rt}}`);
          await storage.createHolding({ accountId: account.id, stockCode, ...updates });
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
      const holdings = await storage.getAllHoldingsForUser(user!.id);
      res.json({ holdings });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
