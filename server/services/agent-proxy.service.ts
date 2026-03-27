// agent-proxy.service.ts — 서버 라우터가 집 PC 에이전트를 통해 키움 API를 호출하는 헬퍼
// 흐름: job 등록 → polling 대기(500ms 간격) → done/error/timeout 반환
import { storage } from "../storage";

const POLL_INTERVAL_MS = 600;
const DEFAULT_TIMEOUT_MS = 14000;

/**
 * 키움 에이전트 job을 등록하고 결과를 기다립니다.
 * @param userId  - 작업 소유자 (추적용)
 * @param jobType - 에이전트 핸들러 이름 (예: "balance.get", "price.get")
 * @param payload - 에이전트에 전달할 파라미터
 * @param timeoutMs - 최대 대기 시간 (기본 14초)
 * @returns 에이전트가 반환한 result 객체
 * @throws 에이전트 오류 메시지 또는 타임아웃 에러
 */
export async function callViaAgent(
  userId: string,
  jobType: string,
  payload: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
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
      throw new Error(formatAgentError(jobType, updated.errorMessage));
    }
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
