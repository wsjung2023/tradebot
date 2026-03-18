// kiwoom-jobs.routes.ts - 집 PC 에이전트용 작업 큐 API
import { Router } from "express";

const router = Router();
const AGENT_KEY = process.env.AGENT_KEY || "my-secret-agent-key-2024";

// 메모리 작업 큐
const jobs: any[] = [];
let nextId = 1;

// 인증 미들웨어
function checkAgent(req: any, res: any, next: any) {
  if (req.query.agent_key !== AGENT_KEY) return res.status(401).json({ error: "unauthorized" });
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
  const job = jobs.find(j => j.id === parseInt(req.params.id));
  if (!job) return res.status(404).json({ error: "not found" });
  job.status = req.body.status;
  job.result = req.body.result;
  console.log(`[kiwoom-jobs] 결과 수신: id=${job.id} status=${job.status}`);
  res.json(job);
});

// 작업 목록 조회 (디버깅용)
router.get("/jobs", (req, res) => res.json(jobs));

export default router;
