// kiwoom-agent.routes.ts — 집 PC 키움 에이전트와의 작업 큐 API
// 구조: Replit(작업등록) ↔ 집PC에이전트(폴링) ↔ 키움REST
// 보안: 작업은 소유자(userId) 본인만 조회 가능. AGENT_KEY는 저장/응답하지 않음.
import type { Express, Request, Response } from "express";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { timingSafeEqual, createHash } from "crypto";
import { storage } from "../storage";
import { insertKiwoomJobSchema } from "@shared/schema";
import type { KiwoomJob } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { sendTestAlert, isSmtpConfigured, getEmailProviderStatuses, validateWebhookUrl, type EmailProvider } from "../services/agent-alert.service";
import { resetUserAlertState } from "../jobs/agent-disconnect-watcher";

const AGENT_KEY = process.env.AGENT_KEY || "";
const AGENT_ID = "home-pc-agent"; // 안전한 식별자만 DB에 저장 (실제 키 아님)

// 에이전트 last-seen 추적 (메모리, 재시작 시 리셋)
let _agentLastSeen: Date | null = null;
let _agentPollCount = 0;
let _agentVersionHash: string | null = null; // 에이전트가 폴링 시 전송하는 버전 해시
function touchAgentSeen(versionHash: string | null | undefined) {
  _agentLastSeen = new Date();
  _agentPollCount++;
  // undefined = 헤더 파싱 전, null = 헤더 없음(구형 에이전트), string = 새 에이전트
  // null을 받으면 구형 에이전트로 간주해 해시를 null로 초기화 (stale 방지)
  if (versionHash !== undefined) _agentVersionHash = versionHash ?? null;
}

/**
 * 에이전트가 최근 maxAgeSec 초 안에 폴링했는지 여부.
 * 자동 cron(잔고/스캔/매매)에서 에이전트 미연결 시 사이클 skip 용도로 사용.
 * NOTE: autoscale 환경에선 인스턴스별로 메모리가 다르므로 false라도 다른 인스턴스에 polling이 있을 수 있다.
 *       다만 이 프로젝트의 cron은 단일 인스턴스에서만 도는 구조이므로 충분.
 */
export function isAgentConnected(maxAgeSec: number = 60): boolean {
  if (!_agentLastSeen) return false;
  const ageSec = (Date.now() - _agentLastSeen.getTime()) / 1000;
  return ageSec < maxAgeSec;
}

export function getAgentLastSeenSecondsAgo(): number | null {
  if (!_agentLastSeen) return null;
  return Math.round((Date.now() - _agentLastSeen.getTime()) / 1000);
}

// ─── 폴링 ON/OFF 스위치 (서버 인스턴스별 독립 메모리) ────────────────────
// AGENT_POLLING_DEFAULT=false 환경변수로 시작값 제어 가능
// 개발 서버: 기본 ON / 운영 서버: AGENT_POLLING_DEFAULT=false 로 기본 OFF
let _pollingEnabled = process.env.AGENT_POLLING_DEFAULT !== "false";
let _todayDispatchCount = 0; // 오늘 에이전트에 전달된 잡 수

function requireAgentKey(req: Request, res: Response): boolean {
  const queryKey = (req.query.agent_key as string) || "";
  const headerKey = (req.headers["x-agent-key"] as string) || "";
  const key = headerKey || queryKey;

  if (!AGENT_KEY || !key) {
    res.status(401).json({ error: "유효하지 않은 에이전트 키" });
    return false;
  }

  // 길이 동일 확인 후 timing-safe 비교 (키 비교 채널 누수 최소화)
  const expected = Buffer.from(AGENT_KEY);
  const provided = Buffer.from(key);
  const keyMatches = expected.length === provided.length && timingSafeEqual(expected, provided);
  if (!keyMatches) {
    res.status(401).json({ error: "유효하지 않은 에이전트 키" });
    return false;
  }

  if (process.env.NODE_ENV === "production" && queryKey && !headerKey) {
    console.warn("[kiwoom-agent] agent_key query 파라미터 사용 감지 (권장: x-agent-key 헤더)");
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


// ─── 자기 업데이트 진행 상황 SSE 브로드캐스트 ─────────────────────────────
// jobId → 진행 단계 목록 (에이전트가 POST /jobs/:jobId/progress 로 전송)
const _updateProgressStore = new Map<number, Array<{step: string; message: string; ts: number}>>();
// jobId → 연결된 SSE 클라이언트 Response 배열
const _updateSseClients = new Map<number, Response[]>();
// jobId → 업데이트 시점 메타데이터 (이력 기록용)
const _updateJobMeta = new Map<number, { agentHashBefore: string | null; serverHash: string | null }>();

function broadcastUpdateProgress(jobId: number, data: object) {
  const clients = _updateSseClients.get(jobId) ?? [];
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch { /* 클라이언트 연결 끊김 */ }
  }
}

async function recordUpdateForJob(jobId: number, success: boolean, errorMessage: string | null) {
  const meta = _updateJobMeta.get(jobId);
  try {
    await storage.createAgentUpdateLog({
      success,
      agentHashBefore: meta?.agentHashBefore ?? null,
      serverHash: meta?.serverHash ?? null,
      errorMessage: errorMessage ?? null,
    });
  } catch (e) {
    console.error("[update-history] DB 저장 실패:", e);
  }
}

function cleanupUpdateJob(jobId: number) {
  setTimeout(() => {
    _updateProgressStore.delete(jobId);
    _updateSseClients.delete(jobId);
    _updateJobMeta.delete(jobId);
  }, 60_000); // 1분 후 정리
}

// 키움 시스템 점검 상태 캐시
let _sysStatusCache: { status: string; message: string; httpStatus?: number; location?: string | null; checkedAt: number } | null = null;
const SYS_STATUS_TTL_MS = 10 * 60 * 1000;   // 정상/점검 결과: 10분
const SYS_STATUS_FAIL_TTL_MS = 2 * 60 * 1000; // 타임아웃/오류 결과: 2분
let _sysStatusPending = false;               // 진행 중 중복 요청 방지
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
  // 에이전트가 15초 간격으로 폴링하므로 서버는 요청마다 즉시 응답 후 종료
  // Autoscale 과금 구조: 연결 점유 시간 = 비용 → 즉시 응답이 가장 저렴
  app.get("/api/kiwoom-agent/jobs/next", async (req: Request, res: Response) => {
    try {
      if (!requireAgentKey(req, res)) return;
      // x-agent-version 헤더가 없는 구형 에이전트는 null로 명시 (stale 해시 방지)
      const agentVersionHeader = (req.headers["x-agent-version"] as string | undefined) ?? null;
      touchAgentSeen(agentVersionHeader);

      // 폴링 스위치 OFF 상태면 잡 없음 즉시 반환 (DB 쿼리 없음)
      if (!_pollingEnabled) {
        return res.json({ job: null, pollingDisabled: true });
      }

      const supportsRaw =
        (req.headers["x-agent-supports"] as string | undefined) ||
        (req.query.supports as string | undefined) ||
        "";
      const supportedJobTypes = supportsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const jobTypes = supportedJobTypes.length > 0 ? supportedJobTypes : undefined;

      const job = await storage.getNextPendingJob(AGENT_ID, jobTypes);
      if (job) {
        _todayDispatchCount++;
        res.json({ job: { id: job.id, jobType: job.jobType, payload: job.payload } });
      } else {
        res.json({ job: null });
      }
    } catch (err) {
      console.error("[kiwoom-agent] 작업 조회 실패:", err);
      if (!res.headersSent) res.status(500).json({ error: "작업 조회 실패" });
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
  // ⚠️  계좌번호별 앱키 지원 (v3.0+)
  // 키움은 계좌번호마다 별도의 앱키를 발급한다.
  // 시크릿 네이밍: KIWOOM_KEY_{계좌번호}, KIWOOM_SECRET_{계좌번호}
  // 에이전트는 작업(job)의 accountNumber로 맞는 키를 자동 선택한다.
  //
  // 하위 호환: real/mock 필드는 기본 폴백용으로 유지
  app.get("/api/kiwoom-agent/appkeys", (req: Request, res: Response) => {
    if (!requireAgentKey(req, res)) return;
    const knownAccounts = ["59190647", "51342627", "39083177"];
    const accountKeys: Record<string, { appKey: string; appSecret: string }> = {};
    for (const acnt of knownAccounts) {
      const k = process.env[`KIWOOM_KEY_${acnt}`];
      const s = process.env[`KIWOOM_SECRET_${acnt}`];
      if (k && s) {
        accountKeys[acnt] = { appKey: k, appSecret: s };
      }
    }

    // 기본 real 폴백: knownAccounts 순서대로 첫 번째 키 사용
    // NOTE: Object.values()는 JS numeric key를 오름차순 정렬하므로 반드시 knownAccounts 순서로 선택해야 함
    //       (Object.values 쓰면 "39083177"이 항상 첫 번째가 되어 3908-3177 계좌가 기본 실계좌로 잘못 설정됨)
    const primaryAccount = knownAccounts.map(a => accountKeys[a]).find(a => a);
    const realKey = process.env.KIWOOM_APP_KEY_REAL || primaryAccount?.appKey || process.env.KIWOOM_APP_KEY || "";
    const realSecret = process.env.KIWOOM_APP_SECRET_REAL || primaryAccount?.appSecret || process.env.KIWOOM_APP_SECRET || "";
    const mockKey = process.env.KIWOOM_APP_KEY || "";
    const mockSecret = process.env.KIWOOM_APP_SECRET || "";

    res.json({
      real: { appKey: realKey, appSecret: realSecret },
      mock: { appKey: mockKey, appSecret: mockSecret },
      accountKeys,
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

  // ─── 에이전트 진행 단계 수신 (에이전트 → 서버) ─────────────────────────
  // 에이전트가 업데이트 중 각 단계를 서버에 알리고, 서버가 SSE로 브로드캐스트
  app.post("/api/kiwoom-agent/jobs/:jobId/progress", (req: Request, res: Response) => {
    if (!requireAgentKey(req, res)) return;
    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) { res.status(400).json({ error: "잘못된 jobId" }); return; }
    const { step = "", message = "" } = req.body || {};
    const entry = { step: String(step), message: String(message), ts: Date.now() };
    const existing = _updateProgressStore.get(jobId) ?? [];
    existing.push(entry);
    _updateProgressStore.set(jobId, existing);
    broadcastUpdateProgress(jobId, { type: "step", ...entry });
    res.json({ ok: true });
  });

  // ─── 에이전트 원격 업데이트 — job 생성 후 jobId 즉시 반환 ────────────────
  app.post("/api/kiwoom-agent/self-update", isAuthenticated, async (req: Request, res: Response) => {
    const agentHashBefore = _agentVersionHash;

    // 업데이트 시 서버 파일 해시 계산
    let serverHashNow: string | null = null;
    try {
      const candidates = [
        join(process.cwd(), "agent/kiwoom-agent.py"),
        join(process.cwd(), "../agent/kiwoom-agent.py"),
      ];
      const scriptPath = candidates.find((p) => existsSync(p));
      if (scriptPath) {
        const content = readFileSync(scriptPath);
        serverHashNow = createHash("md5").update(content).digest("hex").slice(0, 8);
      }
    } catch (_) {}

    try {
      const userId = getAuthUserId(req);
      if (!userId) return res.status(401).json({ error: "로그인 필요" });

      // 업데이트 시작 시 현재 에이전트 해시 + 서버 파일 해시 캡처 (이력 기록용)
      const agentHashBefore = _agentVersionHash;
      let serverHashNow: string | null = null;
      try {
        const candidates = [
          join(process.cwd(), "agent/kiwoom-agent.py"),
          join(process.cwd(), "../agent/kiwoom-agent.py"),
        ];
        const scriptPath = candidates.find((p) => existsSync(p));
        if (scriptPath) {
          const content = readFileSync(scriptPath);
          serverHashNow = createHash("md5").update(content).digest("hex").slice(0, 8);
        }
      } catch (_) {}

      const job = await storage.createKiwoomJob({
        userId,
        jobType: "agent.selfUpdate",
        payload: {},
        status: "pending",
        result: null,
        errorMessage: null,
        agentId: null,
      });
      _updateProgressStore.set(job.id, []);
      _updateJobMeta.set(job.id, { agentHashBefore, serverHash: serverHashNow });
      res.json({ jobId: job.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── 에이전트 업데이트 이력 조회 ──────────────────────────────────────────
  app.get("/api/kiwoom-agent/update-history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 200);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const [history, total] = await Promise.all([
        storage.getAgentUpdateLogs(limit, offset),
        storage.countAgentUpdateLogs(),
      ]);
      res.json({ history, total });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── 업데이트 이력 개별 삭제 ─────────────────────────────────────────────
  app.delete("/api/kiwoom-agent/update-history/:id", isAuthenticated, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "유효하지 않은 ID입니다." });
      return;
    }
    try {
      await storage.deleteAgentUpdateLog(id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── 업데이트 이력 전체 삭제 ─────────────────────────────────────────────
  app.delete("/api/kiwoom-agent/update-history", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      await storage.deleteAllAgentUpdateLogs();
      console.log("[kiwoom-agent] 업데이트 이력 초기화 완료");
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── 업데이트 이력 개별 삭제 ─────────────────────────────────────────────
  app.delete("/api/kiwoom-agent/update-history/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "잘못된 id" });
        return;
      }
      await storage.deleteAgentUpdateLog(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── 업데이트 진행 상황 SSE 스트리밍 (프론트엔드 → 서버) ─────────────────
  // EventSource 로 연결하면 진행 단계 이벤트와 최종 결과를 실시간으로 수신
  app.get("/api/kiwoom-agent/self-update-progress/:jobId", isAuthenticated, async (req: Request, res: Response) => {
    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) { res.status(400).json({ error: "잘못된 jobId" }); return; }

    // SSE 헤더 설정
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // 이미 저장된 진행 단계 즉시 전송 (재연결 시)
    const existingSteps = _updateProgressStore.get(jobId) ?? [];
    for (const step of existingSteps) {
      res.write(`data: ${JSON.stringify({ type: "step", ...step })}\n\n`);
    }

    // SSE 클라이언트 등록
    const clients = _updateSseClients.get(jobId) ?? [];
    clients.push(res);
    _updateSseClients.set(jobId, clients);

    // 35초 타임아웃 내에서 job 완료 여부를 폴링
    const TIMEOUT_MS = 35_000;
    const startTime = Date.now();
    let finished = false;

    const checkInterval = setInterval(async () => {
      if (finished) return;
      try {
        const job = await storage.getKiwoomJobByIdInternal(jobId);
        if (!job) {
          finished = true;
          clearInterval(checkInterval);
          recordUpdateForJob(jobId, false, "작업을 찾을 수 없습니다");
          res.write(`data: ${JSON.stringify({ type: "error", error: "작업을 찾을 수 없습니다" })}\n\n`);
          res.end();
          cleanupUpdateJob(jobId);
          return;
        }
        if (job.status === "done") {
          finished = true;
          clearInterval(checkInterval);
          recordUpdateForJob(jobId, true, null);
          res.write(`data: ${JSON.stringify({ type: "done", success: true, result: job.result })}\n\n`);
          res.end();
          cleanupUpdateJob(jobId);
          return;
        }
        if (job.status === "error") {
          finished = true;
          clearInterval(checkInterval);
          recordUpdateForJob(jobId, false, job.errorMessage ?? "에이전트 오류");
          res.write(`data: ${JSON.stringify({ type: "done", success: false, error: job.errorMessage })}\n\n`);
          res.end();
          cleanupUpdateJob(jobId);
          return;
        }
        if (Date.now() - startTime > TIMEOUT_MS) {
          finished = true;
          clearInterval(checkInterval);
          recordUpdateForJob(jobId, false, "타임아웃 — 에이전트가 응답하지 않습니다");
          res.write(`data: ${JSON.stringify({ type: "timeout", error: "타임아웃 — 에이전트가 응답하지 않습니다" })}\n\n`);
          res.end();
          cleanupUpdateJob(jobId);
        }
      } catch {
        // 폴링 오류는 무시하고 계속
      }
    }, 800);

    // 클라이언트 연결 끊김 처리
    req.on("close", () => {
      finished = true;
      clearInterval(checkInterval);
      const list = _updateSseClients.get(jobId) ?? [];
      const idx = list.indexOf(res);
      if (idx !== -1) list.splice(idx, 1);
    });
  });

  // ─── 에이전트 연결 정보 — 설정 페이지용 ──────────────────────────────────
  app.get("/api/kiwoom-agent/connection-info", isAuthenticated, async (req: Request, res: Response) => {
    const domain = process.env.REPLIT_DOMAINS || "";
    const serverUrl = domain ? `https://${domain}` : "";
    const agentKeyConfigured = !!AGENT_KEY;
    const lastSeen = _agentLastSeen ? _agentLastSeen.toISOString() : null;
    const secondsAgo = _agentLastSeen ? Math.round((Date.now() - _agentLastSeen.getTime()) / 1000) : null;
    const isActive = secondsAgo !== null && secondsAgo < 30;
    res.json({
      serverUrl,
      agentKeyConfigured,
      agentLastSeen: lastSeen,
      agentLastSeenSecondsAgo: secondsAgo,
      isAgentActive: isActive,
      pollCount: _agentPollCount,
    });
  });

  // ─── 폴링 스위치 현황 조회 ─────────────────────────────────────────────
  app.get("/api/kiwoom-agent/polling-status", isAuthenticated, (req: Request, res: Response) => {
    const secondsAgo = _agentLastSeen
      ? Math.round((Date.now() - _agentLastSeen.getTime()) / 1000)
      : null;
    res.json({
      enabled: _pollingEnabled,
      isAgentConnected: secondsAgo !== null && secondsAgo < 60,
      agentLastSeenSecondsAgo: secondsAgo,
      todayPollCount: _agentPollCount,
      todayDispatchCount: _todayDispatchCount,
      agentVersionHash: _agentVersionHash,
    });
  });

  // ─── 서버 최신 에이전트 버전 해시 조회 ────────────────────────────────
  // 프론트엔드에서 에이전트 현재 버전과 비교해 업데이트 필요 여부를 판단
  // /script 엔드포인트와 동일한 다중 경로 폴백 사용
  app.get("/api/kiwoom-agent/version", isAuthenticated, (_req: Request, res: Response) => {
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
      const content = readFileSync(scriptPath);
      const hash = createHash("md5").update(content).digest("hex").slice(0, 8);
      res.json({
        serverHash: hash,
        size: content.length,
        scriptUrl: "/api/kiwoom-agent/script",
      });
    } catch (err) {
      console.error("[kiwoom-agent/version] 버전 해시 계산 실패:", err);
      res.status(500).json({ error: "버전 해시 계산 실패" });
    }
  });

  // ─── 폴링 스위치 ON/OFF 변경 ───────────────────────────────────────────
  app.post("/api/kiwoom-agent/polling-switch", isAuthenticated, (req: Request, res: Response) => {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled 값은 true/false 이어야 합니다" });
    }
    _pollingEnabled = enabled;
    console.log(`[AgentQueue] 폴링 스위치 ${enabled ? "ON" : "OFF"} (사용자 요청)`);
    res.json({ enabled: _pollingEnabled });
  });

  // ─── 키움 시스템 점검 상태 확인 (에이전트 경유) ─────────────────────────
  app.get("/api/kiwoom-agent/system-status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const now = Date.now();
      // 캐시 유효하면 즉시 반환
      if (_sysStatusCache) {
        const ttl = (_sysStatusCache.status === "ok" || _sysStatusCache.status === "maintenance")
          ? SYS_STATUS_TTL_MS : SYS_STATUS_FAIL_TTL_MS;
        if (now - _sysStatusCache.checkedAt * 1000 < ttl) {
          return res.json({ ..._sysStatusCache, cached: true });
        }
      }
      // 이미 진행 중인 요청이 있으면 현재 캐시(만료됐어도) 반환
      if (_sysStatusPending) {
        if (_sysStatusCache) {
          return res.json({ ..._sysStatusCache, cached: true, pending: true, source: "stale-cache" });
        }
        return res.status(202).json({
          pending: true,
          source: "pending-no-cache",
          message: "system.status 작업 진행 중",
        });
      }
      const userId = getAuthUserId(req);
      if (!userId) return res.status(401).json({ error: "로그인 필요" });
      _sysStatusPending = true;
      try {
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
          const updated = await storage.getKiwoomJobByIdInternal(job.id);
          if (!updated) break;
          if (updated.status === "done" && updated.result) {
            const r = updated.result as any;
            _sysStatusCache = { ...r, checkedAt: r.checkedAt || Date.now() / 1000 };
            return res.json({ ...r, cached: false });
          }
          if (updated.status === "error") {
            _sysStatusCache = { status: "unknown", message: updated.errorMessage || "에이전트 오류", checkedAt: Date.now() / 1000 };
            return res.json({ ..._sysStatusCache, cached: false });
          }
        }
        _sysStatusCache = { status: "unknown", message: "에이전트 타임아웃 — 에이전트가 실행 중인지 확인하세요", checkedAt: Date.now() / 1000 };
        return res.json({ ..._sysStatusCache, cached: false });
      } finally {
        _sysStatusPending = false;
      }
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
        body: JSON.stringify({ grant_type: "client_credentials", appkey: appKey, secretkey: appSecret }),
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

  // ─── 에이전트 알림 설정 타입 정의 ───────────────────────────────────
  interface AgentAlertConfig {
    enabled: boolean;
    email: string;
    webhookUrl?: string;
    disconnectThresholdMinutes: number;
    emailProvider?: EmailProvider;
  }

  interface NotificationSettingsRecord {
    agentAlert?: AgentAlertConfig;
    [key: string]: unknown;
  }

  function parseNotificationSettings(raw: unknown): NotificationSettingsRecord {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as NotificationSettingsRecord;
    }
    return {};
  }

  // ─── 에이전트 알림 설정 조회 ─────────────────────────────────────────
  app.get("/api/kiwoom-agent/alert-settings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) return res.status(401).json({ error: "로그인 필요" });
      const settings = await storage.getUserSettings(userId);
      const ns = parseNotificationSettings(settings?.notificationSettings);
      const agentAlert: AgentAlertConfig = ns.agentAlert ?? {
        enabled: false,
        email: "",
        webhookUrl: "",
        disconnectThresholdMinutes: 3,
      };
      const providerStatuses = getEmailProviderStatuses();
      res.json({ agentAlert, smtpConfigured: isSmtpConfigured(), emailProviders: providerStatuses });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // ─── 에이전트 알림 설정 수정 ─────────────────────────────────────────
  app.patch("/api/kiwoom-agent/alert-settings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) return res.status(401).json({ error: "로그인 필요" });

      const { enabled, email, webhookUrl, disconnectThresholdMinutes, emailProvider } = req.body as {
        enabled?: unknown;
        email?: unknown;
        webhookUrl?: unknown;
        disconnectThresholdMinutes?: unknown;
        emailProvider?: unknown;
      };

      const VALID_PROVIDERS: EmailProvider[] = ["smtp", "sendgrid", "resend", "auto"];
      if (emailProvider !== undefined && !VALID_PROVIDERS.includes(emailProvider as EmailProvider)) {
        return res.status(400).json({ error: "유효하지 않은 이메일 공급자입니다" });
      }

      // 웹훅 URL 저장 전 유효성 검증
      if (typeof webhookUrl === "string" && webhookUrl.trim() !== "") {
        const urlValidation = validateWebhookUrl(webhookUrl.trim());
        if (!urlValidation.valid) {
          return res.status(400).json({ error: `웹훅 URL 오류: ${urlValidation.error}` });
        }
      }

      const currentSettings = await storage.getUserSettings(userId);
      const currentNs = parseNotificationSettings(currentSettings?.notificationSettings);
      const currentAlert: AgentAlertConfig = currentNs.agentAlert ?? {
        enabled: false, email: "", webhookUrl: "", disconnectThresholdMinutes: 3,
      };

      const updatedAlert: AgentAlertConfig = {
        ...currentAlert,
        ...(typeof enabled === "boolean" ? { enabled } : {}),
        ...(typeof email === "string" ? { email: email.trim() } : {}),
        ...(typeof webhookUrl === "string" ? { webhookUrl: webhookUrl.trim() } : {}),
        ...(typeof disconnectThresholdMinutes === "number"
          ? { disconnectThresholdMinutes: Math.max(1, Math.min(60, disconnectThresholdMinutes)) }
          : {}),
        ...(VALID_PROVIDERS.includes(emailProvider as EmailProvider)
          ? { emailProvider: emailProvider as EmailProvider }
          : {}),
      };

      // enabled=true일 때 최소 1개 채널 필수
      if (updatedAlert.enabled && !updatedAlert.email && !updatedAlert.webhookUrl) {
        return res.status(400).json({ error: "알림 활성화 시 이메일 또는 웹훅 URL 중 하나를 설정해야 합니다" });
      }

      const updatedNs: NotificationSettingsRecord = { ...currentNs, agentAlert: updatedAlert };
      await storage.updateUserSettings(userId, { notificationSettings: updatedNs });

      // 설정 변경 시 알림 상태 초기화 (오래된 alertedAt 방지)
      resetUserAlertState(userId);

      const providerStatuses = getEmailProviderStatuses();
      res.json({ agentAlert: updatedAlert, smtpConfigured: isSmtpConfigured(), emailProviders: providerStatuses });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // ─── 에이전트 알림 테스트 발송 ────────────────────────────────────────
  app.post("/api/kiwoom-agent/alert-settings/test", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) return res.status(401).json({ error: "로그인 필요" });

      const settings = await storage.getUserSettings(userId);
      const ns = parseNotificationSettings(settings?.notificationSettings);
      const alertCfg = ns.agentAlert;

      if (!alertCfg?.email && !alertCfg?.webhookUrl) {
        return res.status(400).json({ error: "알림 채널(이메일 또는 웹훅)이 설정되어 있지 않습니다" });
      }

      const result = await sendTestAlert(
        alertCfg.email || undefined,
        alertCfg.webhookUrl || undefined,
        alertCfg.emailProvider,
      );
      const messages: string[] = [];
      if (result.email?.ok) messages.push(`이메일 → ${alertCfg.email}`);
      if (result.webhook?.ok) messages.push("웹훅 발송 완료");

      const succeeded = messages.length > 0;
      const errorMsg = [result.email?.error, result.webhook?.error].filter(Boolean).join(", ");

      // 이력 저장
      storage.createAgentAlertLog({
        userId,
        toEmail: alertCfg.email || null,
        alertType: "test",
        success: succeeded,
        errorMessage: succeeded ? null : (errorMsg || "발송 실패"),
      }).catch((e) => console.error("[kiwoom-agent] 알림 이력 저장 실패:", e));

      if (succeeded) {
        res.json({ ok: true, message: `테스트 알림 발송됨: ${messages.join(", ")}` });
      } else {
        res.status(500).json({ ok: false, error: errorMsg || "발송 실패" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // ─── 에이전트 알림 이력 조회 ──────────────────────────────────────────
  app.get("/api/kiwoom-agent/alert-logs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) return res.status(401).json({ error: "로그인 필요" });
      const limit = Math.min(parseInt(req.query.limit as string) || 5, 50);
      const logs = await storage.getAgentAlertLogs(userId, limit);
      res.json({ logs });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // 서버 시작 시 stuck(processing) 잡 리셋 — 배포 재시작/크래시 후 복구
  storage.resetStuckProcessingJobs().catch((err) =>
    console.error("[AgentQueue] stuck 잡 리셋 실패:", err)
  );

  // 만료 잡 정리 타이머 — 5분마다 실행
  const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
  setInterval(async () => {
    try {
      await storage.cleanupExpiredJobs();
    } catch (err) {
      console.error("[AgentQueue] 만료 잡 정리 실패:", err);
    }
  }, CLEANUP_INTERVAL_MS);
  console.log("[AgentQueue] 만료 잡 정리 타이머 시작 (5분 주기)");
}
