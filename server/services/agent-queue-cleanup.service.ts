// agent-queue-cleanup.service.ts — kiwoom_agent_jobs 만료 잡 정리 (5분 주기)
import { storage } from '../storage';

export class AgentQueueCleanupService {
  private timer: NodeJS.Timeout | null = null;
  private readonly INTERVAL_MS = 5 * 60 * 1000;

  start() {
    if (this.timer) {
      console.log('[AgentQueue] 만료 잡 정리 타이머 이미 실행 중 — 중복 등록 방지');
      return;
    }
    this.timer = setInterval(async () => {
      try {
        await storage.cleanupExpiredJobs();
      } catch (err: any) {
        console.error('[AgentQueue] 만료 잡 정리 실패:', err.message);
      }
    }, this.INTERVAL_MS);
    console.log('[AgentQueue] 만료 잡 정리 타이머 시작 (5분 주기)');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[AgentQueue] 만료 잡 정리 타이머 중지');
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  async runNow(): Promise<void> {
    await storage.cleanupExpiredJobs();
  }
}

export const agentQueueCleanupService = new AgentQueueCleanupService();
