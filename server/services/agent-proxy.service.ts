// agent-proxy.service.ts — 서버 라우터가 집 PC 에이전트를 통해 키움 API를 호출하는 헬퍼
// 흐름: job 등록 → polling 대기(500ms 간격) → done/error/timeout 반환
import { storage } from "../storage";

const POLL_INTERVAL_MS = 600;
const DEFAULT_TIMEOUT_MS = 14000;

// 동시 중복 요청 방지: 같은 dedupeKey로 진행 중인 Promise를 공유
const _inflightJobs = new Map<string, Promise<any>>();

/**
 * 키움 에이전트 job을 등록하고 결과를 기다립니다.
 * @param userId    - 작업 소유자 (추적용)
 * @param jobType   - 에이전트 핸들러 이름 (예: "balance.get", "price.get")
 * @param payload   - 에이전트에 전달할 파라미터
 * @param timeoutMs - 최대 대기 시간 (기본 14초)
 * @param dedupeKey - 지정 시, 같은 키로 진행 중인 요청이 있으면 새 job 대신 기존 것을 공유
 * @returns 에이전트가 반환한 result 객체
 * @throws 에이전트 오류 메시지 또는 타임아웃 에러
 */
export async function callViaAgent(
  userId: string,
  jobType: string,
  payload: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  dedupeKey?: string,
): Promise<any> {
  if (dedupeKey) {
    const key = `${userId}:${dedupeKey}`;
    const inflight = _inflightJobs.get(key);
    if (inflight) {
      return inflight; // 이미 진행 중인 요청 재활용 — 새 job 미등록
    }
    const promise = _callViaAgentInternal(userId, jobType, payload, timeoutMs)
      .finally(() => _inflightJobs.delete(key));
    _inflightJobs.set(key, promise);
    return promise;
  }
  return _callViaAgentInternal(userId, jobType, payload, timeoutMs);
}

async function _callViaAgentInternal(
  userId: string,
  jobType: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<any> {
  const job = await storage.createKiwoomJob({
    userId,
    jobType,
    payload,
    status: "pending",
    result: null,
    errorMessage: null,
    agentId: null,
  });

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const updated = await storage.getKiwoomJobByIdInternal(job.id);
    if (!updated) throw new Error("job 소실: DB에서 찾을 수 없습니다");
    if (updated.status === "done") return updated.result;
    if (updated.status === "error") {
      const detail = updated.errorMessage || "에이전트 처리 중 오류 발생";
      throw new Error(
        `[AGENT_JOB_ERROR] jobId=${updated.id} jobType=${updated.jobType} agentId=${updated.agentId || "none"} status=${updated.status} detail=${detail}`,
      );
    }
  }

  const latest = await storage.getKiwoomJobByIdInternal(job.id);
  if (latest) {
    const ageSec = Math.max(0, Math.round((Date.now() - latest.createdAt.getTime()) / 1000));
    const phase =
      latest.status === "pending"
        ? "agent_not_polling_or_no_available_agent"
        : latest.status === "processing"
          ? "agent_got_job_but_no_result"
          : "unknown";
    throw new AgentTimeoutError(
      `[AGENT_TIMEOUT] jobId=${latest.id} jobType=${latest.jobType} status=${latest.status} phase=${phase} agentId=${latest.agentId || "none"} ageSec=${ageSec}`,
    );
  }

  throw new AgentTimeoutError(
    `에이전트 응답 없음 (${timeoutMs / 1000}초 초과). 집 PC 에이전트가 실행 중인지 확인하세요.`,
  );
}

export class AgentTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentTimeoutError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatAgentError(jobType: string, errorMessage?: string | null): string {
  const message = (errorMessage || "에이전트 처리 중 오류 발생").trim();

  if (message.includes("지원하지 않는 작업 타입")) {
    return [
      `${message}`,
      `집 PC 에이전트가 구버전일 수 있습니다.`,
      `에이전트를 최신으로 업데이트 후 재시작하세요 (run-agent.py 실행 권장).`,
      `요청 작업: ${jobType}`,
    ].join(" ");
  }

  return message;
}
