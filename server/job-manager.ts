// job-manager.ts — 백그라운드 잡 통합 관리. 중지/시작 상태를 DB에 영속화하여 서버 재시작 후에도 유지.
import { autoTradingWorker } from './auto-trading-worker';
import { storage } from './storage';
import { balanceRefreshService } from './services/balance-refresh.service';
import { startAgentDisconnectWatcher, stopAgentDisconnectWatcher } from './jobs/agent-disconnect-watcher';

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

const DB_KEY = (id: string) => `job_state_${id}`;

// 런타임 통계 (재시작 시 초기화 — 상태 저장은 DB로만)
interface JobStats {
  intervalMinutes: number;
  lastRun: Date | null;
  runCount: number;
  errorCount: number;
  lastError: string | null;
}

class JobManager {
  private stats: Map<string, JobStats> = new Map([
    ['scan',            { intervalMinutes: 30,   lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ['auto-trading',    { intervalMinutes: 1,    lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ['learning',        { intervalMinutes: 1440, lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ['balance-refresh', { intervalMinutes: 5,    lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ['agent-watcher',   { intervalMinutes: 1,    lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
  ]);

  // 에이전트 감시 실행 여부 추적 (setInterval 기반이라 별도 플래그 필요)
  private agentWatcherRunning = false;
  private balanceRefreshRunning = false;

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

  /** DB에서 모든 잡의 저장된 상태를 읽어 적절히 시작/건너뜀. 서버 시작 시 한 번 호출. */
  async initialize(): Promise<void> {
    console.log('[JobManager] 초기화 — DB에서 잡 상태 로드 중...');

    const ids = ['scan', 'auto-trading', 'learning', 'balance-refresh', 'agent-watcher'];
    for (const id of ids) {
      const saved = await storage.getSystemConfig(DB_KEY(id));
      // DB에 'stopped'로 저장된 경우만 건너뜀. 없거나 'running'이면 시작.
      const shouldRun = saved !== 'stopped';
      console.log(`[JobManager]  ${id}: ${shouldRun ? '시작' : '중지 상태 유지 (DB 저장값)'}`)
      if (shouldRun) {
        await this._startJob(id, false);
      }
    }

    console.log('[JobManager] 초기화 완료');
  }

  /** 내부 실제 시작 로직. persistState=true 이면 DB에 'running'으로 저장. */
  private async _startJob(id: string, persistState: boolean): Promise<void> {
    const state = this.stats.get(id);
    if (!state) return;
    const schedule = this.minutesToCron(state.intervalMinutes);

    if (id === 'scan') {
      autoTradingWorker.startScanJob(schedule);
    } else if (id === 'auto-trading') {
      const allModels = await storage.getAllAiModels();
      for (const model of allModels) {
        if (!model.isActive) await storage.updateAiModel(model.id, { isActive: true });
      }
      for (const model of allModels) {
        const settings = await storage.getAutoTradingSettings(model.id);
        if (!settings) await autoTradingWorker.createDefaultSettingsForModel(model.id);
        const userSettings = await storage.getUserSettings(model.userId);
        if (userSettings) await storage.updateUserSettings(model.userId, { autoTradingEnabled: true });
        else await storage.createUserSettings({ userId: model.userId, autoTradingEnabled: true });
      }
      const scanState = this.stats.get('scan')!;
      autoTradingWorker.startScanJob(this.minutesToCron(scanState.intervalMinutes));
      autoTradingWorker.startTradingJob(schedule);
    } else if (id === 'learning') {
      autoTradingWorker.startLearningJob(schedule);
    } else if (id === 'balance-refresh') {
      balanceRefreshService.start();
      this.balanceRefreshRunning = true;
    } else if (id === 'agent-watcher') {
      startAgentDisconnectWatcher();
      this.agentWatcherRunning = true;
    }

    if (persistState) {
      await storage.setSystemConfig(DB_KEY(id), 'running');
    }
  }

  /** 내부 실제 중지 로직. persistState=true 이면 DB에 'stopped'로 저장. */
  private async _stopJob(id: string, persistState: boolean): Promise<void> {
    if (id === 'scan') {
      autoTradingWorker.stopScanJob();
    } else if (id === 'auto-trading') {
      const allModels = await storage.getActiveAiModels();
      for (const model of allModels) {
        await storage.updateUserSettings(model.userId, { autoTradingEnabled: false });
      }
      autoTradingWorker.stopScanJob();
      autoTradingWorker.stopTradingJob();
    } else if (id === 'learning') {
      autoTradingWorker.stopLearningJob();
    } else if (id === 'balance-refresh') {
      balanceRefreshService.stop();
      this.balanceRefreshRunning = false;
    } else if (id === 'agent-watcher') {
      stopAgentDisconnectWatcher();
      this.agentWatcherRunning = false;
    }

    if (persistState) {
      await storage.setSystemConfig(DB_KEY(id), 'stopped');
    }
  }

  private isRunning(id: string): boolean {
    if (id === 'scan') return autoTradingWorker.isScanJobRunning();
    if (id === 'auto-trading') return autoTradingWorker.isTradingJobRunning();
    if (id === 'learning') return autoTradingWorker.isLearningJobRunning();
    if (id === 'balance-refresh') return this.balanceRefreshRunning;
    if (id === 'agent-watcher') return this.agentWatcherRunning;
    return false;
  }

  getJobs(): JobInfo[] {
    const defs = [
      { id: 'scan',            name: '스캔 잡',      description: '뒷차기2 조건검색으로 후보 종목 스캔 → candidate_stocks 갱신.' },
      { id: 'auto-trading',    name: '매매 잡',      description: '장중 AI 모델 기반 자동 주문 실행. 활성 모델 없으면 아무것도 안 함.' },
      { id: 'learning',        name: '학습 잡',      description: '거래 성과 분석으로 AI 파라미터 자동 최적화. 최소 50건 필요.' },
      { id: 'balance-refresh', name: '잔고 자동갱신', description: '장중(KST 08:30~18:00, 월~금) 5분마다 실계좌 잔고 갱신.' },
      { id: 'agent-watcher',   name: '에이전트 감시', description: '60초마다 집 PC 에이전트 연결 상태 감시. 끊기면 알림 발송.' },
    ];

    return defs.map(({ id, name, description }) => {
      const state = this.stats.get(id)!;
      const running = this.isRunning(id);
      return {
        id,
        name,
        description,
        status: running ? 'running' : 'stopped',
        scheduleLabel: this.minutesToLabel(state.intervalMinutes),
        intervalMinutes: state.intervalMinutes,
        lastRun: state.lastRun,
        nextRun: running && state.lastRun
          ? new Date(state.lastRun.getTime() + state.intervalMinutes * 60 * 1000)
          : null,
        runCount: state.runCount,
        errorCount: state.errorCount,
        lastError: state.lastError,
        isCurrentlyExecuting: false,
      };
    });
  }

  getJob(id: string): JobInfo | undefined {
    return this.getJobs().find(j => j.id === id);
  }

  async startJob(id: string): Promise<{ success: boolean; message: string }> {
    if (!this.stats.has(id)) return { success: false, message: '잡을 찾을 수 없습니다.' };
    await this._startJob(id, true);
    const state = this.stats.get(id)!;
    return { success: true, message: `[${id}] 시작 완료 (${this.minutesToLabel(state.intervalMinutes)})` };
  }

  async stopJob(id: string): Promise<{ success: boolean; message: string }> {
    if (!this.stats.has(id)) return { success: false, message: '잡을 찾을 수 없습니다.' };
    await this._stopJob(id, true);
    return { success: true, message: `[${id}] 중지 완료 — 서버 재시작 후에도 유지됩니다.` };
  }

  setInterval(id: string, intervalMinutes: number): { success: boolean; message: string } {
    const state = this.stats.get(id);
    if (!state) return { success: false, message: '잡을 찾을 수 없습니다.' };
    if (intervalMinutes < 1 || intervalMinutes > 10080) {
      return { success: false, message: '주기는 1분 ~ 7일(10080분) 사이여야 합니다.' };
    }
    state.intervalMinutes = intervalMinutes;
    const schedule = this.minutesToCron(intervalMinutes);
    if (id === 'scan' && autoTradingWorker.isScanJobRunning()) autoTradingWorker.startScanJob(schedule);
    else if (id === 'auto-trading' && autoTradingWorker.isTradingJobRunning()) autoTradingWorker.startTradingJob(schedule);
    else if (id === 'learning' && autoTradingWorker.isLearningJobRunning()) autoTradingWorker.startLearningJob(schedule);
    return { success: true, message: `주기를 ${this.minutesToLabel(intervalMinutes)}으로 변경했습니다.` };
  }

  async runNow(id: string): Promise<{ success: boolean; message: string }> {
    const state = this.stats.get(id);
    if (!state) return { success: false, message: '잡을 찾을 수 없습니다.' };
    try {
      state.runCount++;
      state.lastRun = new Date();
      if (id === 'scan') { await autoTradingWorker.runScanNow(); return { success: true, message: '스캔 사이클 즉시 실행.' }; }
      if (id === 'auto-trading') { await autoTradingWorker.runTradingNow(); return { success: true, message: '매매 사이클 즉시 실행.' }; }
      if (id === 'learning') { await autoTradingWorker.runLearningNow(); return { success: true, message: '학습 사이클 즉시 실행.' }; }
      if (id === 'balance-refresh') { await balanceRefreshService.refreshAllRealAccounts(); return { success: true, message: '잔고 갱신 즉시 실행.' }; }
      return { success: false, message: `[${id}]는 즉시 실행을 지원하지 않습니다.` };
    } catch (err: any) {
      state.errorCount++;
      state.lastError = err?.message || '알 수 없는 오류';
      return { success: false, message: err?.message || '실행 중 오류 발생' };
    }
  }

  recordRun(id: string) {
    const state = this.stats.get(id);
    if (state) { state.runCount++; state.lastRun = new Date(); }
  }

  recordError(id: string, message: string) {
    const state = this.stats.get(id);
    if (state) { state.errorCount++; state.lastError = message; }
  }
}

export const jobManager = new JobManager();

autoTradingWorker.setJobCallbacks(
  (jobId: string) => jobManager.recordRun(jobId),
  (jobId: string, message: string) => jobManager.recordError(jobId, message),
);
