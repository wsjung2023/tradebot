import type { Router } from "express";
import { getCurrentUser, isAuthenticated } from "../auth";
import { opsMonitorService } from "../services/ops-monitor.service";
import { storage } from "../storage";

const OPS_MONITOR_THRESHOLDS_KEY = "ops_monitor_thresholds_v1";
let thresholdsLoaded = false;
let thresholdsLoadPromise: Promise<void> | null = null;

function pickNumericThresholdFields(input: any) {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, number> = {};
  const keys = [
    "minRequestCountForRateAlert",
    "http5xxRateWarnPct",
    "engineStatus401WarnPerMin",
    "aiMinCallsForAlert",
    "aiErrorRateWarnPct",
    "aiAvgLatencyWarnMs",
    "anomalyCooldownMs",
  ];
  for (const key of keys) {
    const value = Number((input as any)[key]);
    if (Number.isFinite(value)) out[key] = value;
  }
  return out;
}

async function ensureThresholdsLoaded() {
  if (thresholdsLoaded) return;
  if (thresholdsLoadPromise) {
    await thresholdsLoadPromise;
    return;
  }

  thresholdsLoadPromise = (async () => {
    try {
      const raw = await storage.getSystemConfig(OPS_MONITOR_THRESHOLDS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      opsMonitorService.setThresholds(pickNumericThresholdFields(parsed));
    } catch (error) {
      console.warn("[monitoring] failed to load thresholds config", error);
    } finally {
      thresholdsLoaded = true;
      thresholdsLoadPromise = null;
    }
  })();

  await thresholdsLoadPromise;
}

export function registerMonitoringRoutes(app: Router) {
  app.get("/api/monitoring/situation-room", isAuthenticated, async (req, res) => {
    try {
      await ensureThresholdsLoaded();
      const user = getCurrentUser(req);
      const historyLimit = req.query.historyLimit ? Number(req.query.historyLimit) : undefined;
      const anomalyLimit = req.query.anomalyLimit ? Number(req.query.anomalyLimit) : undefined;
      const traceLimit = req.query.traceLimit ? Number(req.query.traceLimit) : undefined;
      const notificationLimit = req.query.notificationLimit ? Number(req.query.notificationLimit) : 60;

      const [summary, notifications] = await Promise.all([
        storage.getEngineNotificationSummary(user!.id),
        storage.getEngineNotifications(user!.id, Math.max(10, Math.min(200, notificationLimit))),
      ]);

      res.json({
        ...opsMonitorService.getSituationRoom(user!.id, { historyLimit, anomalyLimit, traceLimit }),
        notificationSummary: summary,
        recentEngineNotifications: notifications,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "failed_to_load_situation_room" });
    }
  });

  app.get("/api/monitoring/live", isAuthenticated, async (req, res) => {
    await ensureThresholdsLoaded();
    const user = getCurrentUser(req);
    opsMonitorService.openSse(user!.id, res);
  });

  app.get("/api/monitoring/config", isAuthenticated, async (_req, res) => {
    try {
      await ensureThresholdsLoaded();
      res.json({ thresholds: opsMonitorService.getThresholds() });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "failed_to_load_monitoring_config" });
    }
  });

  app.patch("/api/monitoring/config", isAuthenticated, async (req, res) => {
    try {
      await ensureThresholdsLoaded();
      const next = pickNumericThresholdFields(req.body ?? {});
      opsMonitorService.setThresholds(next);
      const thresholds = opsMonitorService.getThresholds();
      await storage.setSystemConfig(OPS_MONITOR_THRESHOLDS_KEY, JSON.stringify(thresholds));
      res.json({ success: true, thresholds });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "failed_to_save_monitoring_config" });
    }
  });
}
