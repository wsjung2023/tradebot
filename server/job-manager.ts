// job-manager.ts — 백그라운드 잡 통합 관리.
// 중지/시작 상태 + 인터벌 값 모두 DB에 영속화 → 서버 재시작 후에도 유지.
import { autoTradingWorker } from './auto-trading-worker';
import { storage } from './storage';
import { balanceRefreshService } from './services/balance-refresh.service';

export interface JobInfo {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'stopped';
  scheduleLabel: string;
  intervalType: 'minutes' | 'time-of-day';
  intervalMinutes: number;
  scheduleTime: string;         // learning 전용 "HH:MM"
  lastRun: Date | null;
  nextRun: Date | null;
  runCount: number;
  errorCount: number;
  lastError: string | null;
  isCurrentlyExecuting: boolean;
  learningRuntime?: {
    featureEnabled: boolean;
    lastTriggeredAt: Date | null;
    lastCompletedAt: Date | null;
    lastOutcome: 'executed' | 'skipped' | 'error' | null;
    lastReason: string | null;
    lastError: string | null;
    lastActiveModelCount: number | null;
    lastOptimizedModelCount: number | null;
  };
}

const DB_STATE_KEY = (id: string) => `job_state_${id}`;
const DB_INTERVAL_KEY = (id: string) => `job_interval_${id}`;

// 런타임 통계 (재시작 시 초기화 — 상태/인터벌 저장은 DB로만)
interface JobStats {
  intervalMinutes: number;
  scheduleTime: string;     // learning "HH:MM"
  lastRun: Date | null;
  runCount: number;
  errorCount: number;
  lastError: string | null;
}

/** "HH:MM" → cron 표현식 */
function timeToCron(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${m ?? 0} ${h ?? 0} * * *`;
}

/** "HH:MM" 형식 유효성 검사 */
function isValidTime(time: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return false;
  const h = parseInt(m[1]), min = parseInt(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

class JobManager {
  private stats: Map<string, JobStats> = new Map([
    ['scan',            { intervalMinutes: 30,   scheduleTime: '', lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ['auto-trading',    { intervalMinutes: 1,    scheduleTime: '', lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ['learning',        { intervalMinutes: 1440, scheduleTime: '16:00', lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ['balance-refresh', { intervalMinutes: 5,    scheduleTime: '', lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ['exit-plan',       { intervalMinutes: 1440, scheduleTime: '08:50', lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
  ]);

  private balanceRefreshRunning = false;

  private minutesToCron(minutes: number): string {
    if (minutes < 60) return `*/${minutes} * * * *`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `0 */${hours} * * *`;
    return `0 0 * * *`;
  }

  private intervalLabel(id: string, state: JobStats): string {
    if (id === 'learning') return `매일 ${state.scheduleTime || '16:00'}`;
    if (id === 'exit-plan') return `매일 ${state.scheduleTime || '08:50'}`;
    const m = state.intervalMinutes;
    if (m < 60) return `${m}분마다`;
    if (m < 1440) return `${Math.floor(m / 60)}시간마다`;
    return `매일`;
  }

  /** DB에서 모든 잡의 저장된 상태/인터벌을 읽어 적절히 시작/건너뜀. 서버 시작 시 한 번 호출. */
  async initialize(): Promise<void> {
    console.log('[JobManager] 초기화 — DB에서 잡 상태/인터벌 로드 중...');

    const ids = ['scan', 'auto-trading', 'learning', 'balance-refresh', 'exit-plan'];
    for (const id of ids) {
      const state = this.stats.get(id)!;

      // 인터벌 로드
      const savedInterval = await storage.getSystemConfig(DB_INTERVAL_KEY(id));
      if (savedInterval) {
        if (id === 'learning') {
          state.scheduleTime = savedInterval || '16:00';
        } else if (id === 'exit-plan') {
          state.scheduleTime = savedInterval || '08:50';
        } else {
          state.intervalMinutes = parseInt(savedInterval) || state.intervalMinutes;
        }
      }

      // 상태 로드
      const saved = await storage.getSystemConfig(DB_STATE_KEY(id));
      const shouldRun = saved !== 'stopped';
      console.log(`[JobManager]  ${id}: ${shouldRun ? '시작' : '중지 상태 유지 (DB 저장값)'}`);
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

    if (id === 'scan') {
      const schedule = this.minutesToCron(state.intervalMinutes);
      autoTradingWorker.startScanJob(schedule);

    } else if (id === 'auto-trading') {
      // 스캔잡은 건드리지 않음 — 독립적으로 제어
      const allModels = await storage.getAllAiModels();
      for (const model of allModels) {
        const settings = await storage.getAutoTradingSettings(model.id);
        if (!settings) await autoTradingWorker.createDefaultSettingsForModel(model.id);
        const userSettings = await storage.getUserSettings(model.userId);
        if (userSettings) await storage.updateUserSettings(model.userId, { autoTradingEnabled: true });
        else {
          try {
            await storage.createUserSettings({
              userId: model.userId,
              tradingMode: 'mock',
              riskLevel: 'medium',
              aiModel: 'gpt-5-mini',
              autoTradingEnabled: true,
            });
          } catch (e: any) {
            console.warn(`[JobManager] user_settings 생성 스킵 (${model.userId}):`, e.message?.slice(0, 60));
          }
        }
      }
      const schedule = this.minutesToCron(state.intervalMinutes);
      autoTradingWorker.startTradingJob(schedule);

    } else if (id === 'learning') {
      const schedule = timeToCron(state.scheduleTime || '16:00');
      autoTradingWorker.startLearningJob(schedule);

    } else if (id === 'exit-plan') {
      const schedule = timeToCron(state.scheduleTime || '08:50');
      autoTradingWorker.startExitPlanBatchJob(schedule);

    } else if (id === 'balance-refresh') {
      balanceRefreshService.onRun = () => this.recordRun('balance-refresh');
      balanceRefreshService.start(state.intervalMinutes);
      this.balanceRefreshRunning = true;
      // 시작 시 즉시 한 번 실행 (비동기)
      balanceRefreshService.refreshAllRealAccounts().catch(e => console.error('[JobManager] Initial balance refresh failed:', e));
    }

    if (persistState) {
      await storage.setSystemConfig(DB_STATE_KEY(id), 'running');
    }
  }

  /** 내부 실제 중지 로직. persistState=true 이면 DB에 'stopped'로 저장. */
  private async _stopJob(id: string, persistState: boolean): Promise<void> {
    if (id === 'scan') {
      autoTradingWorker.stopScanJob();

    } else if (id === 'auto-trading') {
      // 스캔잡은 건드리지 않음 — 독립적으로 제어
      const allModels = await storage.getActiveAiModels();
      for (const model of allModels) {
        await storage.updateUserSettings(model.userId, { autoTradingEnabled: false });
      }
      autoTradingWorker.stopTradingJob();

    } else if (id === 'learning') {
      autoTradingWorker.stopLearningJob();

    } else if (id === 'exit-plan') {
      autoTradingWorker.stopExitPlanBatchJob();

    } else if (id === 'balance-refresh') {
      balanceRefreshService.stop();
      this.balanceRefreshRunning = false;
    }

    if (persistState) {
      await storage.setSystemConfig(DB_STATE_KEY(id), 'stopped');
    }
  }

  private isRunning(id: string): boolean {
    if (id === 'scan') return autoTradingWorker.isScanJobRunning();
    if (id === 'auto-trading') return autoTradingWorker.isTradingJobRunning();
    if (id === 'learning') return autoTradingWorker.isLearningJobRunning();
    if (id === 'exit-plan') return autoTradingWorker.isExitPlanJobRunning();
    if (id === 'balance-refresh') return this.balanceRefreshRunning;
    return false;
  }

  private intervalTypeOf(id: string): 'minutes' | 'time-of-day' {
    if (id === 'learning') return 'time-of-day';
    if (id === 'exit-plan') return 'time-of-day';
    return 'minutes';
  }

  getJobs(): JobInfo[] {
    const defs = [
      { id: 'scan',           name: '스캔 잡',    description: '뒷차기2 조건검색으로 후보 종목 스캔 → candidate_stocks 갱신. 장중에만 실행.' },
      { id: 'auto-trading',   name: '매매 잡',    description: '장중 AI 모델 기반 자동 주문 실행. 활성 모델 없으면 아무것도 안 함.' },
      { id: 'learning',       name: '학습 잡',    description: '거래 성과 분석으로 AI 파라미터 자동 최적화 (자동 적용은 50건 이상 필요).' },
      { id: 'balance-refresh', name: '잔고 자동갱신', description: '장중(KST 08:30~18:00, 월~금) 실계좌 잔고 갱신.' },
      { id: 'exit-plan',      name: '매도계획 잡', description: '매일 08:50 KST 보유 종목별 AI 분할매도 계획 자동 생성. 꺼도 기존 저장된 계획은 계속 실행됨.' },
    ];

    return defs.map(({ id, name, description }) => {
      const state = this.stats.get(id)!;
      const running = this.isRunning(id);
      const baseInfo: JobInfo = {
        id,
        name,
        description,
        status: running ? 'running' : 'stopped',
        scheduleLabel: this.intervalLabel(id, state),
        intervalType: this.intervalTypeOf(id),
        intervalMinutes: state.intervalMinutes,
        scheduleTime: state.scheduleTime || '16:00',
        lastRun: state.lastRun,
        nextRun: running && state.lastRun
          ? new Date(state.lastRun.getTime() + state.intervalMinutes * 60 * 1000)
          : null,
        runCount: state.runCount,
        errorCount: state.errorCount,
        lastError: state.lastError,
        isCurrentlyExecuting: false,
      };

      if (id === 'learning') {
        const runtime = autoTradingWorker.getLearningRuntimeStatus();
        baseInfo.learningRuntime = {
          featureEnabled: runtime.featureEnabled,
          lastTriggeredAt: runtime.lastTriggeredAt,
          lastCompletedAt: runtime.lastCompletedAt,
          lastOutcome: runtime.lastOutcome,
          lastReason: runtime.lastReason,
          lastError: runtime.lastError,
          lastActiveModelCount: runtime.lastActiveModelCount,
          lastOptimizedModelCount: runtime.lastOptimizedModelCount,
        };
      }

      return baseInfo;
    });
  }

  getJob(id: string): JobInfo | undefined {
    return this.getJobs().find(j => j.id === id);
  }

  async startJob(id: string): Promise<{ success: boolean; message: string }> {
    if (!this.stats.has(id)) return { success: false, message: '잡을 찾을 수 없습니다.' };
    await this._startJob(id, true);
    const state = this.stats.get(id)!;
    return { success: true, message: `[${id}] 시작 완료 (${this.intervalLabel(id, state)})` };
  }

  async stopJob(id: string): Promise<{ success: boolean; message: string }> {
    if (!this.stats.has(id)) return { success: false, message: '잡을 찾을 수 없습니다.' };
    await this._stopJob(id, true);
    return { success: true, message: `[${id}] 중지 완료 — 서버 재시작 후에도 유지됩니다.` };
  }

  /** 인터벌 변경. DB에 영속화, 실행 중이면 즉시 재적용. */
  async updateInterval(id: string, opts: {
    intervalMinutes?: number;
    scheduleTime?: string;
  }): Promise<{ success: boolean; message: string }> {
    const state = this.stats.get(id);
    if (!state) return { success: false, message: '잡을 찾을 수 없습니다.' };

    if (id === 'learning') {
      const t = opts.scheduleTime;
      if (!t || !isValidTime(t)) return { success: false, message: '시간 형식이 올바르지 않습니다 (HH:MM).' };
      state.scheduleTime = t;
      await storage.setSystemConfig(DB_INTERVAL_KEY(id), t);
      if (autoTradingWorker.isLearningJobRunning()) {
        autoTradingWorker.startLearningJob(timeToCron(t));
      }
      return { success: true, message: `학습 잡 실행 시각 → 매일 ${t}` };
    }

    if (id === 'exit-plan') {
      const t = opts.scheduleTime;
      if (!t || !isValidTime(t)) return { success: false, message: '시간 형식이 올바르지 않습니다 (HH:MM).' };
      state.scheduleTime = t;
      await storage.setSystemConfig(DB_INTERVAL_KEY(id), t);
      if (autoTradingWorker.isExitPlanJobRunning()) {
        autoTradingWorker.startExitPlanBatchJob(timeToCron(t));
      }
      return { success: true, message: `매도계획 잡 실행 시각 → 매일 ${t}` };
    }

    // 분 단위 잡
    const m = opts.intervalMinutes;
    if (!m || m < 1 || m > 10080) return { success: false, message: '주기는 1분 ~ 7일(10080분) 사이여야 합니다.' };
    state.intervalMinutes = m;
    await storage.setSystemConfig(DB_INTERVAL_KEY(id), String(m));

    const schedule = this.minutesToCron(m);
    if (id === 'scan' && autoTradingWorker.isScanJobRunning()) autoTradingWorker.startScanJob(schedule);
    else if (id === 'auto-trading' && autoTradingWorker.isTradingJobRunning()) autoTradingWorker.startTradingJob(schedule);
    else if (id === 'balance-refresh' && this.balanceRefreshRunning) balanceRefreshService.setIntervalMinutes(m);

    return { success: true, message: `[${id}] 주기 → ${this.intervalLabel(id, state)}` };
  }

  // 하위 호환 (기존 PATCH API에서 intervalMinutes만 받던 경우)
  setInterval(id: string, intervalMinutes: number): { success: boolean; message: string } {
    const state = this.stats.get(id);
    if (!state) return { success: false, message: '잡을 찾을 수 없습니다.' };
    if (intervalMinutes < 1 || intervalMinutes > 10080) return { success: false, message: '주기는 1분 ~ 7일 사이여야 합니다.' };
    state.intervalMinutes = intervalMinutes;
    const schedule = this.minutesToCron(intervalMinutes);
    if (id === 'scan' && autoTradingWorker.isScanJobRunning()) autoTradingWorker.startScanJob(schedule);
    else if (id === 'auto-trading' && autoTradingWorker.isTradingJobRunning()) autoTradingWorker.startTradingJob(schedule);
    else if (id === 'learning' && autoTradingWorker.isLearningJobRunning()) autoTradingWorker.startLearningJob(schedule);
    return { success: true, message: `주기를 ${this.intervalLabel(id, state)}으로 변경했습니다.` };
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
      if (id === 'exit-plan') { await autoTradingWorker.runExitPlanBatchNow(); return { success: true, message: '매도계획 배치 즉시 실행.' }; }
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
