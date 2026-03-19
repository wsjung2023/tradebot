// use-agent-job.ts — 클라이언트 측 에이전트 job 등록 + polling
// 구조: POST /api/kiwoom-agent/jobs → jobId 즉시 반환 → 1초마다 GET /status
import { useState, useCallback } from "react";

export interface AgentJobResult {
  id: number;
  jobType: string;
  status: "pending" | "processing" | "done" | "error";
  result: any;
  errorMessage?: string;
  createdAt?: string;
  processedAt?: string;
}

export function useAgentJob() {
  const [job, setJob] = useState<AgentJobResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitJob = useCallback(
    (jobType: string, payload: Record<string, unknown>, timeoutMs = 30000): Promise<AgentJobResult> => {
      return new Promise(async (resolve, reject) => {
        setIsLoading(true);
        setError(null);
        setJob(null);

        try {
          // 1. Job 등록
          const registerRes = await fetch("/api/kiwoom-agent/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobType, payload }),
          });

          if (!registerRes.ok) {
            const errBody = await registerRes.json();
            const errMsg = errBody.error || "Job 등록 실패";
            setError(errMsg);
            setIsLoading(false);
            reject(new Error(errMsg));
            return;
          }

          const { jobId, status } = await registerRes.json();
          setJob({ id: jobId, jobType, status, result: null });

          // 2. Polling 시작 (1초 간격)
          const pollStart = Date.now();
          const pollInterval = setInterval(async () => {
            if (Date.now() - pollStart > timeoutMs) {
              clearInterval(pollInterval);
              const timeoutErr = `에이전트 응답 없음 (${timeoutMs / 1000}초 초과). 집 PC 에이전트가 실행 중인지 확인하세요.`;
              setError(timeoutErr);
              setIsLoading(false);
              reject(new Error(timeoutErr));
              return;
            }

            try {
              const statusRes = await fetch(`/api/kiwoom-agent/jobs/${jobId}/status`);
              if (!statusRes.ok) return; // 아직 준비 안 됨

              const { job: statusJob } = await statusRes.json();
              if (!statusJob) return;

              setJob(statusJob);

              if (statusJob.status === "done") {
                clearInterval(pollInterval);
                setIsLoading(false);
                resolve(statusJob);
                return;
              } else if (statusJob.status === "error") {
                clearInterval(pollInterval);
                const errMsg = statusJob.errorMessage || "에이전트 처리 중 오류 발생";
                setError(errMsg);
                setIsLoading(false);
                reject(new Error(errMsg));
                return;
              }
            } catch (pollErr) {
              // polling 오류는 무시하고 계속 시도
              console.error("[polling] 오류:", pollErr);
            }
          }, 1000);
        } catch (err: any) {
          setIsLoading(false);
          const errMsg = err.message || "Job 등록 중 오류 발생";
          setError(errMsg);
          reject(err);
        }
      });
    },
    []
  );

  return { job, isLoading, error, submitJob };
}
