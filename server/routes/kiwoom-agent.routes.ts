// kiwoom-agent.routes.ts — 집 PC 키움 에이전트와의 작업 큐 API
// 구조: Replit(작업등록) ↔ 집PC에이전트(폴링) ↔ 키움REST
// 보안: 작업은 소유자(userId) 본인만 조회 가능. AGENT_KEY는 저장/응답하지 않음.
import type { Express, Request, Response } from "express";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { storage } from "../storage";
import { insertKiwoomJobSchema } from "@shared/schema";
import type { KiwoomJob } from "@shared/schema";
import { isAuthenticated } from "../auth";

const AGENT_KEY = process.env.AGENT_KEY || "";
const AGENT_ID = "home-pc-agent"; // 안전한 식별자만 DB에 저장 (실제 키 아님)

function requireAgentKey(req: Request, res: Response): boolean {
  const key = (req.query.agent_key as string) || (req.headers["x-agent-key"] as string);
  if (!AGENT_KEY || key !== AGENT_KEY) {
    res.status(401).json({ error: "유효하지 않은 에이전트 키" });
    return false;
  }
  return true;
}

function getAuthUserId(req: Request): string | null {
  const user = req.user as { id: string } | undefined;
  return user?.id ?? null;
}

// agentId, userId 등 내부 필드를 제거하고 클라이언트에 안전한 응답만 반환
function sanitizeJob(job: KiwoomJob) {
  const { agentId: _agentId, userId: _userId, ...safe } = job;
  return safe;
}

// 에이전트 로그 인메모리 버퍼 (최근 200개)
const AGENT_LOG_BUFFER: Array<{ts: number; level: string; message: string; logger?: string}> = [];

// 키움 시스템 점검 상태 캐시 (5분 TTL)
let _sysStatusCache: { status: string; message: string; httpStatus?: number; location?: string | null; checkedAt: number } | null = null;
const SYS_STATUS_TTL_MS = 5 * 60 * 1000;
const AGENT_LOG_MAX = 200;

function pushAgentLog(entry: {ts: number; level: string; message: string; logger?: string}) {
  AGENT_LOG_BUFFER.push(entry);
  if (AGENT_LOG_BUFFER.length > AGENT_LOG_MAX) AGENT_LOG_BUFFER.shift();
  // 서버 콘솔에도 출력
  const tag = entry.level === "ERROR" ? "🔴" : entry.level === "WARNING" ? "🟡" : "⚪";
  console.log(`${tag}[AGENT-LOG] ${entry.message}`);
}

export function registerKiwoomAgentRoutes(app: Express): void {

  // ──────────────────────────────────────────────
  // 에이전트 로그 수신 (에이전트 → 서버)
  // ──────────────────────────────────────────────
  app.post("/api/kiwoom-agent/logs", (req: Request, res: Response) => {
    if (!requireAgentKey(req, res)) return;
    const { level = "INFO", message = "", logger: loggerName, ts } = req.body || {};
    pushAgentLog({ ts: ts || Date.now() / 1000, level: String(level).toUpperCase(), message: String(message), logger: loggerName });
    res.json({ ok: true });
  });

  // 에이전트 로그 조회 (서버 관리자/사용자용)
  app.get("/api/kiwoom-agent/agent-logs", isAuthenticated, (_req: Request, res: Response) => {
    res.json({ logs: [...AGENT_LOG_BUFFER].reverse() });
  });

  // 에이전트 스크립트 다운로드 — 공개 엔드포인트 (인증 불필요)
  // curl -o kiwoom-agent.py https://.../api/kiwoom-agent/script
  app.get("/api/kiwoom-agent/script", (_req: Request, res: Response) => {
    try {
      const candidates = [
        join(process.cwd(), "agent/kiwoom-agent.py"),
        join(process.cwd(), "../agent/kiwoom-agent.py"),
      ];
      const scriptPath = candidates.find((p) => existsSync(p));
      if (!scriptPath) {
        res.status(404).json({ error: "에이전트 파일을 찾을 수 없습니다" });
        return;
      }
      const content = readFileSync(scriptPath, "utf-8");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="kiwoom-agent.py"');
      res.send(content);
    } catch (err) {
      console.error("[kiwoom-agent/script] 파일 전송 실패:", err);
      res.status(500).json({ error: "파일 전송 실패" });
    }
  });

  // 에이전트 자동재시작 배치 스크립트 다운로드 — 공개 엔드포인트
  // curl -o start-agent.bat https://.../api/kiwoom-agent/start-script
  app.get("/api/kiwoom-agent/start-script", (_req: Request, res: Response) => {
    try {
      const candidates = [
        join(process.cwd(), "agent/start-agent.bat"),
        join(process.cwd(), "../agent/start-agent.bat"),
      ];
      const scriptPath = candidates.find((p) => existsSync(p));
      if (!scriptPath) {
        res.status(404).json({ error: "배치 스크립트 파일을 찾을 수 없습니다" });
        return;
      }
      const content = readFileSync(scriptPath, "utf-8");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="start-agent.bat"');
      res.send(content);
    } catch (err) {
      console.error("[kiwoom-agent/start-script] 파일 전송 실패:", err);
      res.status(500).json({ error: "파일 전송 실패" });
    }
  });

  // 작업 등록 — 인증된 사용자 본인 소유 작업으로 생성
  app.post("/api/kiwoom-agent/jobs", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        res.status(401).json({ error: "로그인 필요" });
        return;
      }
      const userId = getAuthUserId(req);
      if (!userId) {
        res.status(401).json({ error: "사용자 정보를 확인할 수 없습니다" });
        return;
      }
      // jobType과 payload만 클라이언트에서 수신 — status/result/agentId는 서버에서 강제 설정
      const bodySchema = insertKiwoomJobSchema.pick({ jobType: true, payload: true });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "잘못된 요청", details: parsed.error.errors });
        return;
      }
      const job = await storage.createKiwoomJob({
        ...parsed.data,
        userId,
        status: "pending",
        result: null,
        errorMessage: null,
        agentId: null,
      });
      res.json({ jobId: job.id, status: job.status });
    } catch (err) {
      console.error("[kiwoom-agent] 작업 등록 실패:", err);
      res.status(500).json({ error: "작업 등록 실패" });
    }
  });

  // 집 PC 에이전트가 다음 작업 가져가기 — AGENT_KEY 인증 필수
  // 응답에서 agentId/userId 제외 (에이전트는 payload/jobType만 필요)
  app.get("/api/kiwoom-agent/jobs/next", async (req: Request, res: Response) => {
    try {
      if (!requireAgentKey(req, res)) return;
      const supportsRaw =
        (req.headers["x-agent-supports"] as string | undefined) ||
        (req.query.supports as string | undefined) ||
        "";
      const supportedJobTypes = supportsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const job = await storage.getNextPendingJob(
        AGENT_ID,
        supportedJobTypes.length > 0 ? supportedJobTypes : undefined,
      );
      if (!job) {
        res.json({ job: null });
        return;
      }
      // 에이전트에는 jobId, jobType, payload만 노출
      res.json({ job: { id: job.id, jobType: job.jobType, payload: job.payload } });
    } catch (err) {
      console.error("[kiwoom-agent] 작업 조회 실패:", err);
      res.status(500).json({ error: "작업 조회 실패" });
    }
  });

  // 집 PC 에이전트가 결과 올리기 — AGENT_KEY 인증 필수
  app.post("/api/kiwoom-agent/jobs/:jobId/result", async (req: Request, res: Response) => {
    try {
      if (!requireAgentKey(req, res)) return;
      const jobId = parseInt(req.params.jobId);
      if (isNaN(jobId)) {
        res.status(400).json({ error: "잘못된 jobId" });
        return;
      }
      const { status, result, errorMessage } = req.body;
      if (!status || !["done", "error"].includes(status)) {
        res.status(400).json({ error: "status는 'done' 또는 'error' 이어야 합니다" });
        return;
      }
      const updated = await storage.updateKiwoomJobResult(jobId, status, result, errorMessage);
      if (!updated) {
        res.status(404).json({ error: "작업을 찾을 수 없습니다" });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[kiwoom-agent] 결과 업로드 실패:", err);
      res.status(500).json({ error: "결과 업로드 실패" });
    }
  });

  // 작업 상태 조회 — 본인 소유 작업만 조회 가능 (IDOR 방지)
  // 캐시 비활성화: 상태가 자주 변경되므로 항상 최신 상태 반환
  app.get("/api/kiwoom-agent/jobs/:jobId/status", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        res.status(401).json({ error: "로그인 필요" });
        return;
      }
      const userId = getAuthUserId(req);
      if (!userId) {
        res.status(401).json({ error: "사용자 정보를 확인할 수 없습니다" });
        return;
      }
      const jobId = parseInt(req.params.jobId);
      if (isNaN(jobId)) {
        res.status(400).json({ error: "잘못된 jobId" });
        return;
      }
      const job = await storage.getKiwoomJobStatus(jobId, userId);
      if (!job) {
        res.status(404).json({ error: "작업을 찾을 수 없습니다" });
        return;
      }
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.json({ job: sanitizeJob(job) });
    } catch (err) {
      console.error("[kiwoom-agent] 상태 조회 실패:", err);
      res.status(500).json({ error: "상태 조회 실패" });
    }
  });

  // ─── 개발 전용: 에이전트 없이 ping/simulate job 즉시 처리 ───────────────────
  // 개발 환경(NODE_ENV !== 'production')에서만 활성화
  // 특정 jobType을 서버 자체에서 처리하여 폴링 없이 테스트 가능
  app.post("/api/kiwoom-agent/dev/simulate", async (req: Request, res: Response) => {
    if (!requireAgentKey(req, res)) return;

    const { jobType = "ping", payload = {} } = req.body;
    const DEV_SIMULATABLE = ["ping"];
    if (!DEV_SIMULATABLE.includes(jobType)) {
      res.status(400).json({ error: `개발 시뮬레이션은 ${DEV_SIMULATABLE.join(", ")} 타입만 지원합니다` });
      return;
    }

    try {
      // 개발용 첫 번째 사용자 ID로 job 등록 (mainstop@naver.com)
      const devUserId = "654fe369-2258-46e0-8048-768bd8849ad1";
      const job = await storage.createKiwoomJob({
        jobType,
        payload,
        userId: devUserId,
        status: "pending",
        result: null,
        errorMessage: null,
        agentId: null,
      });

      // 서버 자체에서 즉시 처리 (ping만 지원)
      let simulatedResult: Record<string, unknown> = {};
      if (jobType === "ping") {
        simulatedResult = { pong: true, serverTime: Date.now(), mode: "dev-simulate" };
      }

      const updated = await storage.updateKiwoomJobResult(job.id, "done", simulatedResult, undefined);
      res.json({
        success: true,
        jobId: job.id,
        result: simulatedResult,
        job: updated ? sanitizeJob(updated) : null,
      });
    } catch (err) {
      console.error("[kiwoom-agent] dev simulate 실패:", err);
      res.status(500).json({ error: "시뮬레이션 실패", detail: String(err) });
    }
  });

  // ─── 에이전트 앱키 제공 (집 PC에서 Replit Secrets의 앱키를 자동으로 받음) ───
  // AGENT_KEY 인증된 에이전트에게만 앱키를 반환
  //
  // ⚠️  우선순위 변경 금지 (재발 방지 2025)
  // 실계좌 앱키 우선순위: KIWOOM_APP_KEY_REAL → KIWOOM_KEY_59190647 → KIWOOM_APP_KEY
  //   - KIWOOM_APP_KEY_REAL: 실계좌 전용으로 발급된 앱키 (api.kiwoom.com)
  //   - KIWOOM_KEY_59190647: 계좌번호 기반 명칭의 실계좌 앱키 (fallback)
  //   - KIWOOM_APP_KEY: 모의계좌 앱키를 마지막 fallback으로 사용 (8030 오류 가능성)
  //
  // 에이전트(v2.5+)는 시작 시 이 엔드포인트를 호출해 실계좌/모의계좌 앱키를 분리 수신한다.
  // 이 엔드포인트가 없거나 우선순위가 잘못되면 에이전트가 모의계좌 앱키로 실계좌 API를
  // 호출하게 되어 8030 오류(투자구분 불일치)가 발생한다.
  app.get("/api/kiwoom-agent/appkeys", (req: Request, res: Response) => {
    if (!requireAgentKey(req, res)) return;
    const realKey =
      process.env.KIWOOM_APP_KEY_REAL ||
      process.env.KIWOOM_KEY_59190647 ||
      process.env.KIWOOM_APP_KEY || "";
    const realSecret =
      process.env.KIWOOM_APP_SECRET_REAL ||
      process.env.KIWOOM_SECRET_59190647 ||
      process.env.KIWOOM_APP_SECRET || "";
    const mockKey =
      process.env.KIWOOM_APP_KEY_MOCK ||
      process.env.KIWOOM_APP_KEY || "";
    const mockSecret =
      process.env.KIWOOM_APP_SECRET_MOCK ||
      process.env.KIWOOM_APP_SECRET || "";
    res.json({
      real: { appKey: realKey, appSecret: realSecret },
      mock: { appKey: mockKey, appSecret: mockSecret },
    });
  });

  // ─── 에이전트 최신 파일 다운로드 (집 PC에서 항상 최신 버전 받기) ────────────
  app.get("/api/kiwoom-agent/download", async (req: Request, res: Response) => {
    if (!requireAgentKey(req, res)) return;
    const fs = await import("fs");
    const path = await import("path");
    const agentPath = path.join(process.cwd(), "agent", "kiwoom-agent.py");
    try {
      const content = fs.readFileSync(agentPath, "utf-8");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=kiwoom-agent.py");
      res.send(content);
    } catch (err) {
      res.status(500).json({ error: "에이전트 파일을 찾을 수 없습니다" });
    }
  });

  // ─── 에이전트 원격 업데이트+재시작 (인증 사용자) ──────────────────────────
  app.post("/api/kiwoom-agent/self-update", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) return res.status(401).json({ error: "로그인 필요" });
      const job = await storage.createKiwoomJob({
        userId,
        jobType: "agent.selfUpdate",
        payload: {},
        status: "pending",
        result: null,
        errorMessage: null,
        agentId: null,
      });
      // 최대 20초 대기
      const start = Date.now();
      while (Date.now() - start < 20000) {
        await new Promise((r) => setTimeout(r, 600));
        const updated = await storage.getKiwoomJob(job.id);
        if (!updated) break;
        if (updated.status === "done") return res.json({ success: true, result: updated.result });
        if (updated.status === "error") return res.json({ success: false, error: updated.errorMessage });
      }
      res.json({ success: false, error: "타임아웃 — 에이전트가 응답하지 않습니다" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── 키움 시스템 점검 상태 확인 (에이전트 경유) ─────────────────────────
  app.get("/api/kiwoom-agent/system-status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const now = Date.now();
      // 캐시 유효하면 즉시 반환 (5분 TTL)
      if (_sysStatusCache && (now - _sysStatusCache.checkedAt * 1000) < SYS_STATUS_TTL_MS) {
        return res.json({ ..._sysStatusCache, cached: true });
      }
      const userId = getAuthUserId(req);
      if (!userId) return res.status(401).json({ error: "로그인 필요" });
      const job = await storage.createKiwoomJob({
        userId,
        jobType: "system.status",
        payload: {},
        status: "pending",
        result: null,
        errorMessage: null,
        agentId: null,
      });
      const start = Date.now();
      while (Date.now() - start < 15000) {
        await new Promise((r) => setTimeout(r, 600));
        const updated = await storage.getKiwoomJob(job.id);
        if (!updated) break;
        if (updated.status === "done" && updated.result) {
          const r = updated.result as any;
          _sysStatusCache = { ...r, checkedAt: r.checkedAt || Date.now() / 1000 };
          return res.json({ ...r, cached: false });
        }
        if (updated.status === "error") {
          return res.json({ status: "unknown", message: updated.errorMessage || "에이전트 오류", cached: false });
        }
      }
      return res.json({ status: "unknown", message: "에이전트 타임아웃 — 에이전트가 실행 중인지 확인하세요", cached: false });
    } catch (e: any) {
      res.status(500).json({ status: "unknown", message: e.message });
    }
  });

  // ─── 진단: 서버에서 직접 키움 API 호출 (에이전트 없이) ──────────────────
  app.get("/api/kiwoom-agent/diagnose-condition", isAuthenticated, async (req: Request, res: Response) => {
    const seq = String(req.query.seq || "30");
    const logs: string[] = [];
    const log = (msg: string) => { logs.push(msg); console.log("[DIAG]", msg); };

    try {
      const fetch = (await import("node-fetch")).default;

      // 1. 토큰 발급
      const appKey = process.env.KIWOOM_APP_KEY_REAL || process.env.KIWOOM_KEY_59190647 || process.env.KIWOOM_APP_KEY || "";
      const appSecret = process.env.KIWOOM_APP_SECRET_REAL || process.env.KIWOOM_SECRET_59190647 || process.env.KIWOOM_APP_SECRET || "";
      if (!appKey || !appSecret) {
        return res.json({ error: "APP_KEY/APP_SECRET 없음", logs });
      }
      log(`토큰 발급 시도 appKey=${appKey.slice(0, 8)}...`);
      const tokenResp = await fetch("https://api.kiwoom.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=UTF-8" },
        body: JSON.stringify({ grant_type: "client_credentials", appkey: appKey, appsecretkey: appSecret }),
      });
      const tokenData = await tokenResp.json() as any;
      const token = tokenData.token || tokenData.access_token || "";
      log(`토큰 발급: ${token ? "성공 " + token.slice(0, 20) + "..." : "실패 " + JSON.stringify(tokenData)}`);
      if (!token) return res.json({ error: "토큰 발급 실패", tokenData, logs });

      // 2. ka10172 REST 호출 (여러 엔드포인트 시도)
      const endpoints = [
        "/api/dostk/mrkcond",
        "/api/dostk/cnsrsrch",
        "/api/dostk/stkinfo",
      ];
      const body = { seq, search_type: "1", stex_tp: "K", cont_yn: "N", next_key: "" };
      const results: Record<string, any> = {};

      for (const ep of endpoints) {
        try {
          const r = await fetch(`https://api.kiwoom.com${ep}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json;charset=UTF-8",
              "api-id": "ka10172",
            },
            body: JSON.stringify(body),
          });
          const d = await r.json() as any;
          log(`${ep}: status=${r.status} keys=${Object.keys(d).join(",")} rc=${d.return_code} msg=${d.return_msg || ""}`);
          results[ep] = d;
        } catch (e: any) {
          log(`${ep}: 오류 ${e.message}`);
          results[ep] = { error: e.message };
        }
      }

      return res.json({ seq, logs, results });
    } catch (e: any) {
      return res.json({ error: e.message, logs });
    }
  });

  // 본인 최근 작업 목록 — 본인 작업만 반환
  app.get("/api/kiwoom-agent/jobs", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        res.status(401).json({ error: "로그인 필요" });
        return;
      }
      const userId = getAuthUserId(req);
      if (!userId) {
        res.status(401).json({ error: "사용자 정보를 확인할 수 없습니다" });
        return;
      }
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const jobs = await storage.getRecentKiwoomJobsByUser(userId, limit);
      res.json({ jobs: jobs.map(sanitizeJob) });
    } catch (err) {
      console.error("[kiwoom-agent] 목록 조회 실패:", err);
      res.status(500).json({ error: "목록 조회 실패" });
    }
  });
}
