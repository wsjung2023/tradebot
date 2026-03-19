// kiwoom-agent.routes.ts — 집 PC 키움 에이전트와의 작업 큐 API
// 구조: Replit(작업등록) ↔ 집PC에이전트(폴링) ↔ 키움REST
// 보안: 작업은 소유자(userId) 본인만 조회 가능. AGENT_KEY는 저장/응답하지 않음.
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { insertKiwoomJobSchema } from "@shared/schema";
import type { KiwoomJob } from "@shared/schema";

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

export function registerKiwoomAgentRoutes(app: Express): void {

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
      const job = await storage.getNextPendingJob(AGENT_ID);
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
