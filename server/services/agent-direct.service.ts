const DIRECT_AGENT_URL = process.env.DIRECT_AGENT_URL || "http://127.0.0.1:5001";
const AGENT_KEY = process.env.AGENT_KEY || "";

export class AgentDirectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentDirectError";
  }
}

export async function callAgentDirect(
  jobType: string,
  payload: Record<string, unknown>,
  timeoutMs = 10000,
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${DIRECT_AGENT_URL}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Key": AGENT_KEY,
      },
      body: JSON.stringify({ jobType, payload }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AgentDirectError(`에이전트 HTTP ${res.status}: ${text}`);
    }

    const json: any = await res.json();
    if (json.error) throw new AgentDirectError(json.error);
    return json.result;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new AgentDirectError(`에이전트 직접 호출 타임아웃 (${timeoutMs}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
