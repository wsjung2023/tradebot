import type { Response } from "express";
import { pool } from "../db";

type Severity = "info" | "warn" | "crit";

interface HttpRecord {
  timestamp: number;
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

interface AiTraceRecord {
  id: number;
  timestamp: string;
  userId: string | null;
  source: string;
  model: string;
  success: boolean;
  durationMs: number;
  promptPreview: string;
  contextPreview: string;
  responsePreview: string | null;
  errorMessage: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface MonitorAnomaly {
  id: number;
  detectedAt: string;
  severity: Severity;
  kind: string;
  message: string;
  details?: Record<string, unknown>;
}

interface MonitorSnapshot {
  measuredAt: string;
  db: {
    ok: boolean;
    latencyMs: number | null;
    error: string | null;
  };
  runtime: {
    uptimeSec: number;
    memoryRssMb: number;
    memoryHeapUsedMb: number;
    memoryHeapTotalMb: number;
  };
  httpLast1m: {
    requestCount: number;
    status2xx: number;
    status3xx: number;
    status4xx: number;
    status5xx: number;
    error5xxRatePct: number;
    p95LatencyMs: number;
    engineStatus401Count: number;
  };
  aiLast5m: {
    callCount: number;
    successCount: number;
    errorCount: number;
    errorRatePct: number;
    avgLatencyMs: number;
  };
  jobs: Array<{
    id: string;
    name: string;
    status: "running" | "stopped";
    lastRun: string | null;
    nextRun: string | null;
    errorCount: number;
    lastError: string | null;
  }>;
}

interface JobsProviderJob {
  id: string;
  name: string;
  status: "running" | "stopped";
  lastRun: Date | null;
  nextRun: Date | null;
  errorCount: number;
  lastError: string | null;
}

export interface MonitorThresholds {
  minRequestCountForRateAlert: number;
  http5xxRateWarnPct: number;
  engineStatus401WarnPerMin: number;
  aiMinCallsForAlert: number;
  aiErrorRateWarnPct: number;
  aiAvgLatencyWarnMs: number;
  anomalyCooldownMs: number;
}

interface SituationRoomOptions {
  historyLimit?: number;
  anomalyLimit?: number;
  traceLimit?: number;
}

const MAX_HTTP_RECORDS = 4000;
const MAX_AI_TRACES_TOTAL = 1200;
const MAX_ANOMALIES = 500;
const MAX_HISTORY = 500;
const DEFAULT_INTERVAL_SEC = 15;

function clampText(value: string | null | undefined, max = 1200): string {
  if (!value) return "";
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

class OpsMonitorService {
  private running = false;
  private intervalSec = DEFAULT_INTERVAL_SEC;
  private timer: NodeJS.Timeout | null = null;
  private nextRunAt: Date | null = null;
  private lastRunAt: Date | null = null;

  private httpRecords: HttpRecord[] = [];
  private aiTraces: AiTraceRecord[] = [];
  private anomalies: MonitorAnomaly[] = [];
  private history: MonitorSnapshot[] = [];
  private latestSnapshot: MonitorSnapshot | null = null;

  private anomalySeq = 1;
  private traceSeq = 1;
  private anomalyCooldown: Map<string, number> = new Map();

  private jobsProvider: (() => JobsProviderJob[]) | null = null;
  private onRun: ((jobId: string) => void) | null = null;
  private onError: ((jobId: string, message: string) => void) | null = null;

  private sseClients: Map<number, { userId: string; res: Response }> = new Map();
  private sseClientSeq = 1;
  private sseHeartbeatTimer: NodeJS.Timeout;

  private thresholds: MonitorThresholds = {
    minRequestCountForRateAlert: 20,
    http5xxRateWarnPct: 8,
    engineStatus401WarnPerMin: 12,
    aiMinCallsForAlert: 3,
    aiErrorRateWarnPct: 30,
    aiAvgLatencyWarnMs: 9000,
    anomalyCooldownMs: 120000,
  };

  getThresholds(): MonitorThresholds {
    return { ...this.thresholds };
  }

  setThresholds(next: Partial<MonitorThresholds>) {
    const safeInt = (value: unknown, min: number, max: number, fallback: number) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, Math.round(n)));
    };
    const safeFloat = (value: unknown, min: number, max: number, fallback: number) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };

    this.thresholds = {
      minRequestCountForRateAlert: safeInt(
        next.minRequestCountForRateAlert,
        1,
        5000,
        this.thresholds.minRequestCountForRateAlert,
      ),
      http5xxRateWarnPct: safeFloat(next.http5xxRateWarnPct, 0.1, 100, this.thresholds.http5xxRateWarnPct),
      engineStatus401WarnPerMin: safeInt(
        next.engineStatus401WarnPerMin,
        1,
        5000,
        this.thresholds.engineStatus401WarnPerMin,
      ),
      aiMinCallsForAlert: safeInt(next.aiMinCallsForAlert, 1, 1000, this.thresholds.aiMinCallsForAlert),
      aiErrorRateWarnPct: safeFloat(next.aiErrorRateWarnPct, 0.1, 100, this.thresholds.aiErrorRateWarnPct),
      aiAvgLatencyWarnMs: safeInt(next.aiAvgLatencyWarnMs, 10, 120000, this.thresholds.aiAvgLatencyWarnMs),
      anomalyCooldownMs: safeInt(next.anomalyCooldownMs, 1000, 3600000, this.thresholds.anomalyCooldownMs),
    };
  }

  constructor() {
    this.sseHeartbeatTimer = setInterval(() => {
      this.sseClients.forEach(({ res }) => {
        try {
          res.write(": heartbeat\n\n");
        } catch {
          // connection cleanup handled by close event
        }
      });
    }, 20000);
    this.sseHeartbeatTimer.unref();
  }

  setJobsProvider(provider: () => JobsProviderJob[]) {
    this.jobsProvider = provider;
  }

  setJobCallbacks(onRun: (jobId: string) => void, onError: (jobId: string, message: string) => void) {
    this.onRun = onRun;
    this.onError = onError;
  }

  start(intervalSec = DEFAULT_INTERVAL_SEC) {
    const safe = Math.max(2, Math.min(3600, Math.floor(intervalSec)));
    this.intervalSec = safe;
    this.running = true;
    this.restartTimer();
    void this.runCycle();
  }

  stop() {
    this.running = false;
    this.nextRunAt = null;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getIntervalSec(): number {
    return this.intervalSec;
  }

  setIntervalSec(intervalSec: number) {
    const safe = Math.max(2, Math.min(3600, Math.floor(intervalSec)));
    this.intervalSec = safe;
    if (this.running) this.restartTimer();
  }

  async runNow(): Promise<void> {
    await this.runCycle();
  }

  recordHttpRequest(method: string, path: string, status: number, durationMs: number) {
    this.httpRecords.push({
      timestamp: Date.now(),
      method,
      path,
      status,
      durationMs,
    });
    if (this.httpRecords.length > MAX_HTTP_RECORDS) {
      this.httpRecords.splice(0, this.httpRecords.length - MAX_HTTP_RECORDS);
    }
  }

  recordAiTrace(input: {
    userId?: string | null;
    source?: string;
    model: string;
    success: boolean;
    durationMs: number;
    promptPreview?: string;
    contextPreview?: string;
    responsePreview?: string | null;
    errorMessage?: string | null;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  }) {
    this.aiTraces.push({
      id: this.traceSeq++,
      timestamp: new Date().toISOString(),
      userId: input.userId ?? null,
      source: clampText(input.source || "unknown", 120),
      model: clampText(input.model, 80),
      success: input.success,
      durationMs: Math.max(0, Math.round(input.durationMs || 0)),
      promptPreview: clampText(input.promptPreview, 2000),
      contextPreview: clampText(input.contextPreview, 1200),
      responsePreview: clampText(input.responsePreview, 1200) || null,
      errorMessage: clampText(input.errorMessage, 600) || null,
      promptTokens: Math.max(0, Number(input.promptTokens ?? 0)),
      completionTokens: Math.max(0, Number(input.completionTokens ?? 0)),
      totalTokens: Math.max(0, Number(input.totalTokens ?? 0)),
    });

    if (this.aiTraces.length > MAX_AI_TRACES_TOTAL) {
      this.aiTraces.splice(0, this.aiTraces.length - MAX_AI_TRACES_TOTAL);
    }
  }

  getSituationRoom(userId: string, options: SituationRoomOptions = {}) {
    const historyLimit = Math.min(240, Math.max(10, Number(options.historyLimit ?? 120)));
    const anomalyLimit = Math.min(300, Math.max(10, Number(options.anomalyLimit ?? 120)));
    const traceLimit = Math.min(200, Math.max(10, Number(options.traceLimit ?? 80)));

    const userTraces = this.aiTraces
      .filter((t) => t.userId === userId || t.userId === null)
      .slice(-traceLimit)
      .reverse();

    const userRecent5m = this.aiTraces.filter((t) => {
      if (t.userId !== userId && t.userId !== null) return false;
      return Date.now() - new Date(t.timestamp).getTime() <= 5 * 60 * 1000;
    });
    const userCallCount = userRecent5m.length;
    const userErrorCount = userRecent5m.filter((t) => !t.success).length;
    const userAvgLatencyMs =
      userCallCount > 0
        ? Math.round(userRecent5m.reduce((sum, t) => sum + t.durationMs, 0) / userCallCount)
        : 0;

    return {
      monitorJob: {
        running: this.running,
        intervalSec: this.intervalSec,
        lastRunAt: this.lastRunAt ? this.lastRunAt.toISOString() : null,
        nextRunAt: this.nextRunAt ? this.nextRunAt.toISOString() : null,
      },
      current: this.latestSnapshot,
      history: this.history.slice(-historyLimit),
      anomalies: this.anomalies.slice(-anomalyLimit).reverse(),
      ai: {
        recentCalls5m: userCallCount,
        recentErrors5m: userErrorCount,
        recentSuccessRatePct: userCallCount > 0 ? Math.round(((userCallCount - userErrorCount) / userCallCount) * 100) : 100,
        avgLatencyMs5m: userAvgLatencyMs,
        traces: userTraces,
      },
      thresholds: this.thresholds,
    };
  }

  openSse(userId: string, res: Response) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write("retry: 5000\n\n");

    const clientId = this.sseClientSeq++;
    this.sseClients.set(clientId, { userId, res });

    const initial = this.getSituationRoom(userId);
    this.writeSse(res, "snapshot", initial);

    res.on("close", () => {
      this.sseClients.delete(clientId);
    });
  }

  private restartTimer() {
    if (this.timer) clearInterval(this.timer);
    this.nextRunAt = new Date(Date.now() + this.intervalSec * 1000);
    this.timer = setInterval(() => {
      void this.runCycle();
    }, this.intervalSec * 1000);
    this.timer.unref();
  }

  private async runCycle() {
    try {
      const snapshot = await this.collectSnapshot();
      this.latestSnapshot = snapshot;
      this.history.push(snapshot);
      if (this.history.length > MAX_HISTORY) {
        this.history.splice(0, this.history.length - MAX_HISTORY);
      }
      this.lastRunAt = new Date();
      this.nextRunAt = this.running ? new Date(Date.now() + this.intervalSec * 1000) : null;
      this.detectAnomalies(snapshot);
      if (this.onRun) this.onRun("ops-monitor");
      this.broadcastSnapshot();
    } catch (error: any) {
      const message = error?.message || String(error);
      if (this.onError) this.onError("ops-monitor", message);
      this.pushAnomaly("crit", "MONITOR_CYCLE_ERROR", `모니터링 배치 실행 오류: ${message}`);
      this.broadcastSnapshot();
    }
  }

  private async collectSnapshot(): Promise<MonitorSnapshot> {
    const measuredAt = new Date().toISOString();

    const dbStarted = Date.now();
    let dbOk = true;
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;
    try {
      await pool.query("select 1");
      dbLatencyMs = Date.now() - dbStarted;
    } catch (error: any) {
      dbOk = false;
      dbLatencyMs = Date.now() - dbStarted;
      dbError = clampText(error?.message || String(error), 240);
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    const http1m = this.httpRecords.filter((r) => r.timestamp >= oneMinuteAgo);
    const status2xx = http1m.filter((r) => r.status >= 200 && r.status < 300).length;
    const status3xx = http1m.filter((r) => r.status >= 300 && r.status < 400).length;
    const status4xx = http1m.filter((r) => r.status >= 400 && r.status < 500).length;
    const status5xx = http1m.filter((r) => r.status >= 500).length;
    const requestCount = http1m.length;
    const error5xxRatePct = requestCount > 0 ? Number(((status5xx / requestCount) * 100).toFixed(1)) : 0;
    const p95LatencyMs = Math.round(percentile(http1m.map((r) => r.durationMs), 95));
    const engineStatus401Count = http1m.filter(
      (r) => r.path === "/api/auto-trading/engine-status" && r.status === 401,
    ).length;

    const ai5m = this.aiTraces.filter((t) => new Date(t.timestamp).getTime() >= fiveMinutesAgo);
    const aiCallCount = ai5m.length;
    const aiErrorCount = ai5m.filter((t) => !t.success).length;
    const aiSuccessCount = aiCallCount - aiErrorCount;
    const aiErrorRatePct = aiCallCount > 0 ? Number(((aiErrorCount / aiCallCount) * 100).toFixed(1)) : 0;
    const aiAvgLatencyMs = aiCallCount > 0 ? Math.round(ai5m.reduce((s, t) => s + t.durationMs, 0) / aiCallCount) : 0;

    const mem = process.memoryUsage();
    const jobs = (this.jobsProvider ? this.jobsProvider() : []).map((j) => ({
      id: j.id,
      name: j.name,
      status: j.status,
      lastRun: j.lastRun ? j.lastRun.toISOString() : null,
      nextRun: j.nextRun ? j.nextRun.toISOString() : null,
      errorCount: j.errorCount,
      lastError: j.lastError,
    }));

    return {
      measuredAt,
      db: {
        ok: dbOk,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
      runtime: {
        uptimeSec: Math.round(process.uptime()),
        memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
        memoryHeapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
        memoryHeapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
      },
      httpLast1m: {
        requestCount,
        status2xx,
        status3xx,
        status4xx,
        status5xx,
        error5xxRatePct,
        p95LatencyMs,
        engineStatus401Count,
      },
      aiLast5m: {
        callCount: aiCallCount,
        successCount: aiSuccessCount,
        errorCount: aiErrorCount,
        errorRatePct: aiErrorRatePct,
        avgLatencyMs: aiAvgLatencyMs,
      },
      jobs,
    };
  }

  private detectAnomalies(snapshot: MonitorSnapshot) {
    if (!snapshot.db.ok) {
      this.pushAnomaly("crit", "DB_DOWN", "DB 헬스체크 실패", {
        error: snapshot.db.error,
        latencyMs: snapshot.db.latencyMs,
      });
    }

    if (
      snapshot.httpLast1m.requestCount >= this.thresholds.minRequestCountForRateAlert &&
      snapshot.httpLast1m.error5xxRatePct >= this.thresholds.http5xxRateWarnPct
    ) {
      this.pushAnomaly("warn", "HTTP_5XX_SPIKE", "최근 1분 5xx 비율이 높습니다", {
        requestCount: snapshot.httpLast1m.requestCount,
        errorRatePct: snapshot.httpLast1m.error5xxRatePct,
      });
    }

    if (snapshot.httpLast1m.engineStatus401Count >= this.thresholds.engineStatus401WarnPerMin) {
      this.pushAnomaly("warn", "ENGINE_401_FLOOD", "engine-status 401 응답이 과도합니다", {
        count1m: snapshot.httpLast1m.engineStatus401Count,
      });
    }

    if (
      snapshot.aiLast5m.callCount >= this.thresholds.aiMinCallsForAlert &&
      snapshot.aiLast5m.errorRatePct >= this.thresholds.aiErrorRateWarnPct
    ) {
      this.pushAnomaly("warn", "AI_ERROR_SPIKE", "AI 호출 오류율이 높습니다", {
        callCount5m: snapshot.aiLast5m.callCount,
        errorRatePct5m: snapshot.aiLast5m.errorRatePct,
      });
    }

    if (
      snapshot.aiLast5m.callCount >= this.thresholds.aiMinCallsForAlert &&
      snapshot.aiLast5m.avgLatencyMs >= this.thresholds.aiAvgLatencyWarnMs
    ) {
      this.pushAnomaly("warn", "AI_LATENCY_HIGH", "AI 평균 지연시간이 높습니다", {
        callCount5m: snapshot.aiLast5m.callCount,
        avgLatencyMs5m: snapshot.aiLast5m.avgLatencyMs,
      });
    }
  }

  private pushAnomaly(
    severity: Severity,
    kind: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    const key = `${severity}:${kind}`;
    const now = Date.now();
    const lastAt = this.anomalyCooldown.get(key) || 0;
    if (now - lastAt < this.thresholds.anomalyCooldownMs) return;
    this.anomalyCooldown.set(key, now);

    const anomaly: MonitorAnomaly = {
      id: this.anomalySeq++,
      detectedAt: new Date().toISOString(),
      severity,
      kind,
      message,
      details,
    };
    this.anomalies.push(anomaly);
    if (this.anomalies.length > MAX_ANOMALIES) {
      this.anomalies.splice(0, this.anomalies.length - MAX_ANOMALIES);
    }
    console.warn(`[OpsMonitor][${severity.toUpperCase()}] ${kind}: ${message}`);
  }

  private broadcastSnapshot() {
    this.sseClients.forEach(({ userId, res }) => {
      const payload = this.getSituationRoom(userId);
      this.writeSse(res, "snapshot", payload);
    });
  }

  private writeSse(res: Response, event: string, data: unknown) {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      // closed connection
    }
  }
}

export const opsMonitorService = new OpsMonitorService();
