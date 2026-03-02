import { autoTradingWorker } from './auto-trading-worker';

export interface JobInfo {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'stopped';
  scheduleLabel: string;
  intervalMinutes: number;
  lastRun: Date | null;
  nextRun: Date | null;
  runCount: number;
  errorCount: number;
  lastError: string | null;
  isCurrentlyExecuting: boolean;
}

class JobManager {
  private jobStates: Map<string, {
    intervalMinutes: number;
    lastRun: Date | null;
    runCount: number;
    errorCount: number;
    lastError: string | null;
  }> = new Map([
    ['auto-trading', { intervalMinutes: 1, lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ['learning',     { intervalMinutes: 1440, lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
  ]);

  private minutesToCron(minutes: number): string {
    if (minutes < 60) return `*/${minutes} * * * *`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `0 */${hours} * * *`;
    return `0 16 * * *`;
  }

  private minutesToLabel(minutes: number): string {
    if (minutes < 60) return `${minutes}분마다`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}시간마다`;
    return `매일 16:00`;
  }

  getJobs(): JobInfo[] {
    const tradingState = this.jobStates.get('auto-trading')!;
    const learningState = this.jobStates.get('learning')!;

    const tradingRunning = autoTradingWorker.isTradingJobRunning();
    const learningRunning = autoTradingWorker.isLearningJobRunning();

    return [
      {
        id: 'auto-trading',
        name: '자동매매 워커',
        description: '장중(09:00~15:30 KST) AI 모델 기반 자동 주문 실행. 활성 AI 모델이 없으면 아무것도 하지 않음.',
        status: tradingRunning ? 'running' : 'stopped',
        scheduleLabel: this.minutesToLabel(tradingState.intervalMinutes),
        intervalMinutes: tradingState.intervalMinutes,
        lastRun: tradingState.lastRun,
        nextRun: tradingRunning && tradingState.lastRun
          ? new Date(tradingState.lastRun.getTime() + tradingState.intervalMinutes * 60 * 1000)
          : null,
        runCount: tradingState.runCount,
        errorCount: tradingState.errorCount,
        lastError: tradingState.lastError,
        isCurrentlyExecuting: false,
      },
      {
        id: 'learning',
        name: '학습 시스템',
        description: '거래 성과 데이터를 분석해 AI 모델 파라미터를 자동 최적화. 최소 50건 거래 데이터 필요.',
        status: learningRunning ? 'running' : 'stopped',
        scheduleLabel: this.minutesToLabel(learningState.intervalMinutes),
        intervalMinutes: learningState.intervalMinutes,
        lastRun: learningState.lastRun,
        nextRun: learningRunning && learningState.lastRun
          ? new Date(learningState.lastRun.getTime() + learningState.intervalMinutes * 60 * 1000)
          : null,
        runCount: learningState.runCount,
        errorCount: learningState.errorCount,
        lastError: learningState.lastError,
        isCurrentlyExecuting: false,
      },
    ];
  }

  getJob(id: string): JobInfo | undefined {
    return this.getJobs().find(j => j.id === id);
  }

  startJob(id: string): { success: boolean; message: string } {
    const state = this.jobStates.get(id);
    if (!state) return { success: false, message: '잡을 찾을 수 없습니다.' };

    const schedule = this.minutesToCron(state.intervalMinutes);

    if (id === 'auto-trading') {
      autoTradingWorker.startTradingJob(schedule);
      return { success: true, message: `자동매매 워커를 시작했습니다. (${this.minutesToLabel(state.intervalMinutes)})` };
    }
    if (id === 'learning') {
      autoTradingWorker.startLearningJob(schedule);
      return { success: true, message: `학습 시스템을 시작했습니다. (${this.minutesToLabel(state.intervalMinutes)})` };
    }

    return { success: false, message: '알 수 없는 잡 ID입니다.' };
  }

  stopJob(id: string): { success: boolean; message: string } {
    if (id === 'auto-trading') {
      autoTradingWorker.stopTradingJob();
      return { success: true, message: '자동매매 워커를 중지했습니다.' };
    }
    if (id === 'learning') {
      autoTradingWorker.stopLearningJob();
      return { success: true, message: '학습 시스템을 중지했습니다.' };
    }
    return { success: false, message: '알 수 없는 잡 ID입니다.' };
  }

  setInterval(id: string, intervalMinutes: number): { success: boolean; message: string } {
    const state = this.jobStates.get(id);
    if (!state) return { success: false, message: '잡을 찾을 수 없습니다.' };

    if (intervalMinutes < 1 || intervalMinutes > 10080) {
      return { success: false, message: '주기는 1분 ~ 7일(10080분) 사이여야 합니다.' };
    }

    state.intervalMinutes = intervalMinutes;
    const schedule = this.minutesToCron(intervalMinutes);

    const wasRunning = id === 'auto-trading'
      ? autoTradingWorker.isTradingJobRunning()
      : autoTradingWorker.isLearningJobRunning();

    if (wasRunning) {
      if (id === 'auto-trading') autoTradingWorker.startTradingJob(schedule);
      if (id === 'learning') autoTradingWorker.startLearningJob(schedule);
    }

    return { success: true, message: `주기를 ${this.minutesToLabel(intervalMinutes)}으로 변경했습니다.` };
  }

  async runNow(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const state = this.jobStates.get(id);
      if (!state) return { success: false, message: '잡을 찾을 수 없습니다.' };

      if (id === 'auto-trading') {
        state.runCount++;
        state.lastRun = new Date();
        await autoTradingWorker.runTradingNow();
        return { success: true, message: '자동매매 사이클을 즉시 실행했습니다.' };
      }
      if (id === 'learning') {
        state.runCount++;
        state.lastRun = new Date();
        await autoTradingWorker.runLearningNow();
        return { success: true, message: '학습 사이클을 즉시 실행했습니다.' };
      }

      return { success: false, message: '알 수 없는 잡 ID입니다.' };
    } catch (err: any) {
      const state = this.jobStates.get(id);
      if (state) {
        state.errorCount++;
        state.lastError = err?.message || '알 수 없는 오류';
      }
      return { success: false, message: err?.message || '실행 중 오류 발생' };
    }
  }

  recordRun(id: string) {
    const state = this.jobStates.get(id);
    if (state) {
      state.runCount++;
      state.lastRun = new Date();
    }
  }

  recordError(id: string, message: string) {
    const state = this.jobStates.get(id);
    if (state) {
      state.errorCount++;
      state.lastError = message;
    }
  }
}

export const jobManager = new JobManager();
