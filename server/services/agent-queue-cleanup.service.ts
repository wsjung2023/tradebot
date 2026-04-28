// agent-queue-cleanup.service.ts — kiwoom_agent_jobs 만료 잡 정리 (기본 5분 주기, 조정 가능)
import { storage } from '../storage';

export class AgentQueueCleanupService {
  private timer: NodeJS.Timeout | null = null;
  private intervalMinutes = 5;

  start(intervalMinutes?: number) {
    if (intervalMinutes !== undefined) this.intervalMinutes = intervalMinutes;
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
    }, this.intervalMinutes * 60 * 1000);
    console.log(`[AgentQueue] 만료 잡 정리 타이머 시작 (${this.intervalMinutes}분 주기)`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[AgentQueue] 만료 잡 정리 타이머 중지');
    }
  }

  /** 실행 중이면 즉시 새 주기로 재시작. 중지 중이면 값만 저장. */
  setIntervalMinutes(minutes: number) {
    this.intervalMinutes = minutes;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.start();
    }
  }

  getIntervalMinutes(): number {
    return this.intervalMinutes;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  async runNow(): Promise<void> {
    await storage.cleanupExpiredJobs();
  }
}

export const agentQueueCleanupService = new AgentQueueCleanupService();
