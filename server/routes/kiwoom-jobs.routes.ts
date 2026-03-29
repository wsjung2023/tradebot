// kiwoom-jobs.routes.ts - 집 PC 에이전트용 작업 큐 API
import { Router } from "express";
import { timingSafeEqual } from "crypto";

const router = Router();
const AGENT_KEY = process.env.AGENT_KEY || "";

if (!AGENT_KEY) {
  console.warn("[kiwoom-jobs] AGENT_KEY is not configured. Agent endpoints will reject all requests.");
}

// 메모리 작업 큐
const jobs: any[] = [];
let nextId = 1;

// 인증 미들웨어
function checkAgent(req: any, res: any, next: any) {
  const queryKey = String(req.query.agent_key || "");
  const headerKey = String(req.headers["x-agent-key"] || "");
  const key = headerKey || queryKey;
  if (!AGENT_KEY) return res.status(503).json({ error: "agent_key_not_configured" });
  const expected = Buffer.from(AGENT_KEY);
  const provided = Buffer.from(key);
  const isValid = expected.length === provided.length && timingSafeEqual(expected, provided);
  if (!isValid) return res.status(401).json({ error: "unauthorized" });
  if (process.env.NODE_ENV === "production" && queryKey && !headerKey) {
    console.warn("[kiwoom-jobs] agent_key query 파라미터 사용 감지 (권장: x-agent-key 헤더)");
  }
  next();
}

// A. 작업 등록 (Replit 앱에서 호출)
router.post("/jobs", (req, res) => {
  const { type, payload } = req.body;
  const job = { id: nextId++, type, payload, status: "pending", result: null, createdAt: new Date() };
  jobs.push(job);
  console.log(`[kiwoom-jobs] 작업 등록: ${type} (id=${job.id})`);
  res.json(job);
});

// B. 집 PC 에이전트가 다음 작업 가져가기
router.get("/jobs/next", checkAgent, (req, res) => {
  const job = jobs.find(j => j.status === "pending");
  if (job) {
    job.status = "processing";
    console.log(`[kiwoom-jobs] 작업 발송: ${job.type} (id=${job.id})`);
    res.json(job);
  } else {
    res.json(null);
  }
});

// C. 집 PC 에이전트가 결과 올리기
router.post("/jobs/:id/result", checkAgent, (req, res) => {
  const jobId = parseInt(req.params.id, 10);
  if (Number.isNaN(jobId)) return res.status(400).json({ error: "invalid_job_id" });
  const job = jobs.find(j => j.id === jobId);
  if (!job) return res.status(404).json({ error: "not found" });
  job.status = req.body.status;
  job.result = req.body.result;
  console.log(`[kiwoom-jobs] 결과 수신: id=${job.id} status=${job.status}`);
  res.json(job);
});

// 작업 목록 조회 (디버깅용)
router.get("/jobs", checkAgent, (_req, res) => res.json(jobs));

export default router;
