// kiwoom-agent.routes.ts — 집 PC 키움 에이전트와의 작업 큐 API
// 구조: Replit(작업등록) ↔ 집PC에이전트(폴링) ↔ 키움REST
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { insertKiwoomJobSchema } from "@shared/schema";

const AGENT_KEY = process.env.AGENT_KEY || "";

function requireAgentKey(req: Request, res: Response): boolean {
  const key = req.query.agent_key as string || req.headers["x-agent-key"] as string;
  if (!AGENT_KEY || key !== AGENT_KEY) {
    res.status(401).json({ error: "유효하지 않은 에이전트 키" });
    return false;
  }
  return true;
}

export function registerKiwoomAgentRoutes(app: Express): void {

  // 작업 등록 (Replit 서버 내부 또는 인증된 사용자가 호출)
  app.post("/api/kiwoom-agent/jobs", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        res.status(401).json({ error: "로그인 필요" });
        return;
      }
      const parsed = insertKiwoomJobSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "잘못된 요청", details: parsed.error.errors });
        return;
      }
      const job = await storage.createKiwoomJob(parsed.data);
      res.json({ jobId: job.id, status: job.status });
    } catch (err) {
      console.error("[kiwoom-agent] 작업 등록 실패:", err);
      res.status(500).json({ error: "작업 등록 실패" });
    }
  });

  // 집 PC 에이전트가 다음 작업 가져가기
  app.get("/api/kiwoom-agent/jobs/next", async (req: Request, res: Response) => {
    try {
      if (!requireAgentKey(req, res)) return;
      const agentKey = req.query.agent_key as string;
      const job = await storage.getNextPendingJob(agentKey);
      if (!job) {
        res.json({ job: null });
        return;
      }
      res.json({ job });
    } catch (err) {
      console.error("[kiwoom-agent] 작업 조회 실패:", err);
      res.status(500).json({ error: "작업 조회 실패" });
    }
  });

  // 집 PC 에이전트가 결과 올리기
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
      res.json({ success: true, job: updated });
    } catch (err) {
      console.error("[kiwoom-agent] 결과 업로드 실패:", err);
      res.status(500).json({ error: "결과 업로드 실패" });
    }
  });

  // 작업 상태 조회 (Replit 프론트엔드가 폴링용으로 사용)
  app.get("/api/kiwoom-agent/jobs/:jobId/status", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        res.status(401).json({ error: "로그인 필요" });
        return;
      }
      const jobId = parseInt(req.params.jobId);
      if (isNaN(jobId)) {
        res.status(400).json({ error: "잘못된 jobId" });
        return;
      }
      const job = await storage.getKiwoomJobStatus(jobId);
      if (!job) {
        res.status(404).json({ error: "작업을 찾을 수 없습니다" });
        return;
      }
      res.json({ job });
    } catch (err) {
      console.error("[kiwoom-agent] 상태 조회 실패:", err);
      res.status(500).json({ error: "상태 조회 실패" });
    }
  });

  // 최근 작업 목록 (관리자/디버깅용)
  app.get("/api/kiwoom-agent/jobs", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        res.status(401).json({ error: "로그인 필요" });
        return;
      }
      const limit = parseInt(req.query.limit as string) || 20;
      const jobs = await storage.getRecentKiwoomJobs(Math.min(limit, 100));
      res.json({ jobs });
    } catch (err) {
      console.error("[kiwoom-agent] 목록 조회 실패:", err);
      res.status(500).json({ error: "목록 조회 실패" });
    }
  });
}
