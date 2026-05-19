// stub: AgentTimeoutError only — agent-proxy fully removed
export class AgentTimeoutError extends Error {
  constructor(message?: string) {
    super(message ?? 'Agent timeout');
    this.name = 'AgentTimeoutError';
  }
}
