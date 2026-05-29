import { autoTradingWorker } from "./auto-trading-worker";
import { storage } from "./storage";
import { balanceRefreshService } from "./services/balance-refresh.service";
import { opsMonitorService } from "./services/ops-monitor.service";

export interface JobInfo {
  id: string;
  name: string;
  description: string;
  status: "running" | "stopped";
  scheduleLabel: string;
  intervalType: "minutes" | "time-of-day" | "seconds";
  intervalMinutes: number;
  intervalSeconds: number;
  scheduleTime: string;
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
    lastOutcome: "executed" | "skipped" | "error" | null;
    lastReason: string | null;
    lastError: string | null;
    lastActiveModelCount: number | null;
    lastOptimizedModelCount: number | null;
  };
}

interface JobStats {
  intervalMinutes: number;
  intervalSeconds: number;
  scheduleTime: string;
  lastRun: Date | null;
  runCount: number;
  errorCount: number;
  lastError: string | null;
}

const DB_STATE_KEY = (id: string) => `job_state_${id}`;
const DB_INTERVAL_KEY = (id: string) => `job_interval_${id}`;

function timeToCron(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${m ?? 0} ${h ?? 0} * * *`;
}

function isValidTime(time: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return false;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

function nextTimeOfDay(scheduleTime: string): Date | null {
  if (!isValidTime(scheduleTime)) return null;
  const [h, m] = scheduleTime.split(":").map((v) => parseInt(v, 10));
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

class JobManager {
  private stats: Map<string, JobStats> = new Map([
    ["scan", { intervalMinutes: 30, intervalSeconds: 0, scheduleTime: "", lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ["auto-trading", { intervalMinutes: 1, intervalSeconds: 0, scheduleTime: "", lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ["learning", { intervalMinutes: 1440, intervalSeconds: 0, scheduleTime: "16:00", lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ["balance-refresh", { intervalMinutes: 5, intervalSeconds: 0, scheduleTime: "", lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ["exit-plan", { intervalMinutes: 1440, intervalSeconds: 0, scheduleTime: "08:50", lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
    ["ops-monitor", { intervalMinutes: 0, intervalSeconds: 15, scheduleTime: "", lastRun: null, runCount: 0, errorCount: 0, lastError: null }],
  ]);

  private balanceRefreshRunning = false;

  private minutesToCron(minutes: number): string {
    if (minutes < 60) return `*/${minutes} * * * *`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `0 */${hours} * * *`;
    return `0 0 * * *`;
  }

  private intervalLabel(id: string, state: JobStats): string {
    if (id === "learning") return `매일 ${state.scheduleTime || "16:00"}`;
    if (id === "exit-plan") return `매일 ${state.scheduleTime || "08:50"}`;
    if (id === "ops-monitor") return `${state.intervalSeconds || 15}초마다`;
    const m = state.intervalMinutes;
    if (m < 60) return `${m}분마다`;
    if (m < 1440) return `${Math.floor(m / 60)}시간마다`;
    return "매일";
  }

  async initialize(): Promise<void> {
    console.log("[JobManager] 초기화: DB 설정 로드 시작");

    const ids = ["scan", "auto-trading", "learning", "balance-refresh", "exit-plan", "ops-monitor"];
    for (const id of ids) {
      const state = this.stats.get(id)!;
      const savedInterval = await storage.getSystemConfig(DB_INTERVAL_KEY(id));
      if (savedInterval) {
        if (id === "learning" || id === "exit-plan") {
          state.scheduleTime = savedInterval;
        } else if (id === "ops-monitor") {
          state.intervalSeconds = parseInt(savedInterval, 10) || state.intervalSeconds;
        } else {
          state.intervalMinutes = parseInt(savedInterval, 10) || state.intervalMinutes;
        }
      }

      const savedState = await storage.getSystemConfig(DB_STATE_KEY(id));
      const shouldRun = id === "ops-monitor" ? savedState === "running" : savedState !== "stopped";
      if (shouldRun) await this._startJob(id, false);
      console.log(`[JobManager] ${id}: ${shouldRun ? "running" : "stopped"}`);
    }

    console.log("[JobManager] 초기화 완료");
  }

  private async _startJob(id: string, persistState: boolean): Promise<void> {
    const state = this.stats.get(id);
    if (!state) return;

    if (id === "scan") {
      autoTradingWorker.startScanJob(this.minutesToCron(state.intervalMinutes));
    } else if (id === "auto-trading") {
      const allModels = await storage.getAllAiModels();
      for (const model of allModels) {
        const settings = await storage.getAutoTradingSettings(model.id);
        if (!settings) await autoTradingWorker.createDefaultSettingsForModel(model.id);
        const userSettings = await storage.getUserSettings(model.userId);
        if (userSettings) {
          await storage.updateUserSettings(model.userId, { autoTradingEnabled: true });
        } else {
          try {
            await storage.createUserSettings({
              userId: model.userId,
              tradingMode: "mock",
              riskLevel: "medium",
              aiModel: "gpt-5-mini",
              autoTradingEnabled: true,
            });
          } catch (e: any) {
            console.warn(`[JobManager] user_settings 생성 스킵 (${model.userId}):`, e?.message?.slice(0, 80));
          }
        }
      }
      autoTradingWorker.startTradingJob(this.minutesToCron(state.intervalMinutes));
    } else if (id === "learning") {
      autoTradingWorker.startLearningJob(timeToCron(state.scheduleTime || "16:00"));
    } else if (id === "exit-plan") {
      autoTradingWorker.startExitPlanBatchJob(timeToCron(state.scheduleTime || "08:50"));
    } else if (id === "balance-refresh") {
      balanceRefreshService.onRun = () => this.recordRun("balance-refresh");
      balanceRefreshService.start(state.intervalMinutes);
      this.balanceRefreshRunning = true;
      balanceRefreshService.refreshAllRealAccounts().catch((e) => {
        console.error("[JobManager] Initial balance refresh failed:", e);
      });
    } else if (id === "ops-monitor") {
      opsMonitorService.start(state.intervalSeconds || 15);
    }

    if (persistState) await storage.setSystemConfig(DB_STATE_KEY(id), "running");
  }

  private async _stopJob(id: string, persistState: boolean): Promise<void> {
    if (id === "scan") {
      autoTradingWorker.stopScanJob();
    } else if (id === "auto-trading") {
      const allModels = await storage.getActiveAiModels();
      for (const model of allModels) {
        await storage.updateUserSettings(model.userId, { autoTradingEnabled: false });
      }
      autoTradingWorker.stopTradingJob();
    } else if (id === "learning") {
      autoTradingWorker.stopLearningJob();
    } else if (id === "exit-plan") {
      autoTradingWorker.stopExitPlanBatchJob();
    } else if (id === "balance-refresh") {
      balanceRefreshService.stop();
      this.balanceRefreshRunning = false;
    } else if (id === "ops-monitor") {
      opsMonitorService.stop();
    }

    if (persistState) await storage.setSystemConfig(DB_STATE_KEY(id), "stopped");
  }

  private isRunning(id: string): boolean {
    if (id === "scan") return autoTradingWorker.isScanJobRunning();
    if (id === "auto-trading") return autoTradingWorker.isTradingJobRunning();
    if (id === "learning") return autoTradingWorker.isLearningJobRunning();
    if (id === "exit-plan") return autoTradingWorker.isExitPlanJobRunning();
    if (id === "balance-refresh") return this.balanceRefreshRunning;
    if (id === "ops-monitor") return opsMonitorService.isRunning();
    return false;
  }

  private intervalTypeOf(id: string): "minutes" | "time-of-day" | "seconds" {
    if (id === "learning" || id === "exit-plan") return "time-of-day";
    if (id === "ops-monitor") return "seconds";
    return "minutes";
  }

  private nextRunOf(id: string, state: JobStats, running: boolean): Date | null {
    if (!running) return null;
    if (id === "learning" || id === "exit-plan") return nextTimeOfDay(state.scheduleTime);
    if (id === "ops-monitor") return state.lastRun ? new Date(state.lastRun.getTime() + state.intervalSeconds * 1000) : null;
    return state.lastRun ? new Date(state.lastRun.getTime() + state.intervalMinutes * 60 * 1000) : null;
  }

  getJobs(): JobInfo[] {
    const defs = [
      { id: "scan", name: "스캔 잡", description: "조건검색 기반 후보종목을 스캔합니다." },
      { id: "auto-trading", name: "자동매매 잡", description: "활성 모델 기반 자동매매 사이클을 수행합니다." },
      { id: "learning", name: "학습 잡", description: "거래 성과 기반 모델 파라미터 최적화를 수행합니다." },
      { id: "balance-refresh", name: "잔고 갱신 잡", description: "실계좌 잔고를 주기적으로 갱신합니다." },
      { id: "exit-plan", name: "매도계획 잡", description: "보유종목별 AI 분할매도 계획을 생성합니다." },
      { id: "ops-monitor", name: "운영 모니터 잡", description: "실시간 운영 이상징후를 탐지해 상황실 데이터를 생성합니다." },
    ];

    return defs.map(({ id, name, description }) => {
      const state = this.stats.get(id)!;
      const running = this.isRunning(id);

      const baseInfo: JobInfo = {
        id,
        name,
        description,
        status: running ? "running" : "stopped",
        scheduleLabel: this.intervalLabel(id, state),
        intervalType: this.intervalTypeOf(id),
        intervalMinutes: state.intervalMinutes,
        intervalSeconds: state.intervalSeconds,
        scheduleTime: state.scheduleTime || "16:00",
        lastRun: state.lastRun,
        nextRun: this.nextRunOf(id, state, running),
        runCount: state.runCount,
        errorCount: state.errorCount,
        lastError: state.lastError,
        isCurrentlyExecuting: false,
      };

      if (id === "learning") {
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
    return this.getJobs().find((j) => j.id === id);
  }

  async startJob(id: string): Promise<{ success: boolean; message: string }> {
    if (!this.stats.has(id)) return { success: false, message: "존재하지 않는 잡입니다." };
    await this._startJob(id, true);
    const state = this.stats.get(id)!;
    return { success: true, message: `[${id}] 시작 완료 (${this.intervalLabel(id, state)})` };
  }

  async stopJob(id: string): Promise<{ success: boolean; message: string }> {
    if (!this.stats.has(id)) return { success: false, message: "존재하지 않는 잡입니다." };
    await this._stopJob(id, true);
    return { success: true, message: `[${id}] 중지 완료` };
  }

  async updateInterval(
    id: string,
    opts: { intervalMinutes?: number; intervalSeconds?: number; scheduleTime?: string },
  ): Promise<{ success: boolean; message: string }> {
    const state = this.stats.get(id);
    if (!state) return { success: false, message: "존재하지 않는 잡입니다." };

    if (id === "learning" || id === "exit-plan") {
      const t = opts.scheduleTime;
      if (!t || !isValidTime(t)) return { success: false, message: "시간 형식이 올바르지 않습니다. (HH:MM)" };
      state.scheduleTime = t;
      await storage.setSystemConfig(DB_INTERVAL_KEY(id), t);
      if (id === "learning" && autoTradingWorker.isLearningJobRunning()) autoTradingWorker.startLearningJob(timeToCron(t));
      if (id === "exit-plan" && autoTradingWorker.isExitPlanJobRunning()) autoTradingWorker.startExitPlanBatchJob(timeToCron(t));
      return { success: true, message: `[${id}] 실행 시간 변경: 매일 ${t}` };
    }

    if (id === "ops-monitor") {
      const sec = opts.intervalSeconds;
      if (!sec || sec < 2 || sec > 3600) return { success: false, message: "모니터 주기는 2~3600초 범위여야 합니다." };
      state.intervalSeconds = sec;
      await storage.setSystemConfig(DB_INTERVAL_KEY(id), String(sec));
      if (opsMonitorService.isRunning()) opsMonitorService.setIntervalSec(sec);
      return { success: true, message: `[${id}] 주기 변경: ${sec}초` };
    }

    const m = opts.intervalMinutes;
    if (!m || m < 1 || m > 10080) return { success: false, message: "주기는 1~10080분 범위여야 합니다." };
    state.intervalMinutes = m;
    await storage.setSystemConfig(DB_INTERVAL_KEY(id), String(m));

    const schedule = this.minutesToCron(m);
    if (id === "scan" && autoTradingWorker.isScanJobRunning()) autoTradingWorker.startScanJob(schedule);
    if (id === "auto-trading" && autoTradingWorker.isTradingJobRunning()) autoTradingWorker.startTradingJob(schedule);
    if (id === "balance-refresh" && this.balanceRefreshRunning) balanceRefreshService.setIntervalMinutes(m);

    return { success: true, message: `[${id}] 주기 변경: ${this.intervalLabel(id, state)}` };
  }

  setInterval(id: string, intervalMinutes: number): { success: boolean; message: string } {
    const state = this.stats.get(id);
    if (!state) return { success: false, message: "존재하지 않는 잡입니다." };
    if (intervalMinutes < 1 || intervalMinutes > 10080) {
      return { success: false, message: "주기는 1~10080분 범위여야 합니다." };
    }
    state.intervalMinutes = intervalMinutes;
    const schedule = this.minutesToCron(intervalMinutes);
    if (id === "scan" && autoTradingWorker.isScanJobRunning()) autoTradingWorker.startScanJob(schedule);
    if (id === "auto-trading" && autoTradingWorker.isTradingJobRunning()) autoTradingWorker.startTradingJob(schedule);
    if (id === "learning" && autoTradingWorker.isLearningJobRunning()) autoTradingWorker.startLearningJob(schedule);
    return { success: true, message: `주기를 ${this.intervalLabel(id, state)}로 변경했습니다.` };
  }

  async runNow(id: string): Promise<{ success: boolean; message: string }> {
    const state = this.stats.get(id);
    if (!state) return { success: false, message: "존재하지 않는 잡입니다." };
    try {
      state.runCount += 1;
      state.lastRun = new Date();
      if (id === "scan") {
        await autoTradingWorker.runScanNow();
        return { success: true, message: "스캔 사이클 즉시 실행" };
      }
      if (id === "auto-trading") {
        await autoTradingWorker.runTradingNow();
        return { success: true, message: "자동매매 사이클 즉시 실행" };
      }
      if (id === "learning") {
        await autoTradingWorker.runLearningNow();
        return { success: true, message: "학습 사이클 즉시 실행" };
      }
      if (id === "exit-plan") {
        await autoTradingWorker.runExitPlanBatchNow();
        return { success: true, message: "매도계획 배치 즉시 실행" };
      }
      if (id === "balance-refresh") {
        await balanceRefreshService.refreshAllRealAccounts();
        return { success: true, message: "잔고 갱신 즉시 실행" };
      }
      if (id === "ops-monitor") {
        await opsMonitorService.runNow();
        return { success: true, message: "운영 모니터 즉시 실행" };
      }
      return { success: false, message: "지원하지 않는 잡입니다." };
    } catch (err: any) {
      state.errorCount += 1;
      state.lastError = err?.message || "unknown_error";
      return { success: false, message: state.lastError ?? "unknown_error" };
    }
  }

  recordRun(id: string) {
    const state = this.stats.get(id);
    if (!state) return;
    state.runCount += 1;
    state.lastRun = new Date();
  }

  recordError(id: string, message: string) {
    const state = this.stats.get(id);
    if (!state) return;
    state.errorCount += 1;
    state.lastError = message;
  }
}

export const jobManager = new JobManager();

autoTradingWorker.setJobCallbacks(
  (jobId: string) => jobManager.recordRun(jobId),
  (jobId: string, message: string) => jobManager.recordError(jobId, message),
);

opsMonitorService.setJobCallbacks(
  (jobId: string) => jobManager.recordRun(jobId),
  (jobId: string, message: string) => jobManager.recordError(jobId, message),
);

opsMonitorService.setJobsProvider(() =>
  jobManager.getJobs().map((job) => ({
    id: job.id,
    name: job.name,
    status: job.status,
    lastRun: job.lastRun,
    nextRun: job.nextRun,
    errorCount: job.errorCount,
    lastError: job.lastError,
  })),
);
