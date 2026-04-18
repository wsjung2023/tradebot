// settings.routes.ts — 설정 및 시스템 정보 조회
import type { Express } from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { createHash } from "crypto";
import { isAuthenticated, getCurrentUser } from "../auth";
import { storage } from "../storage";

const SERVER_START_TIME = new Date().toISOString();

// 빌드 타임: 환경 변수 > 서버 번들 파일 수정시각 > null 순으로 폴백
function detectBuildTime(): string | null {
  if (process.env.BUILD_TIME) return process.env.BUILD_TIME;
  try {
    const bundlePath = path.resolve(process.cwd(), "dist/index.js");
    const stat = fs.statSync(bundlePath);
    return stat.mtime.toISOString();
  } catch {
    return null;
  }
}

// 커밋 해시: 환경 변수 > git rev-parse > null 순으로 폴백
function detectBuildCommit(): string | null {
  if (process.env.BUILD_COMMIT) return process.env.BUILD_COMMIT;
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8", timeout: 3000 }).trim();
  } catch {
    return null;
  }
}

const BUILD_TIME = detectBuildTime();
const BUILD_COMMIT = detectBuildCommit();

export function registerSettingsRoutes(app: Express): void {
  // 헬스체크 및 배포 버전 정보
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      buildTime: BUILD_TIME,
      buildCommit: BUILD_COMMIT,
      serverStartTime: SERVER_START_TIME,
      nodeEnv: process.env.NODE_ENV || "development",
    });
  });

  // 서버 공인 IP 및 시스템 정보
  let cachedServerIP: string | null = null;
  let lastIPCheckTime = 0;

  const getServerIP = async () => {
    const now = Date.now();
    // 5분마다 재조회 (캐시)
    if (cachedServerIP && now - lastIPCheckTime < 5 * 60 * 1000) {
      return cachedServerIP;
    }

    try {
      const response = await axios.get("https://api.ipify.org?format=json", { timeout: 5000 });
      cachedServerIP = response.data.ip;
      lastIPCheckTime = now;
      return cachedServerIP;
    } catch {
      console.warn("[settings] IP 조회 실패, 마지막 캐시값 반환");
      return cachedServerIP;
    }
  };

  app.get("/api/server-info", async (req, res) => {
    try {
      const serverIP = await getServerIP();
      res.json({
        serverIP: serverIP ?? null,
        serverIPAvailable: !!serverIP,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Replit/운영 점검용 런타임 인트로스펙션 (실측 데이터만 반환)
  app.get("/api/runtime-introspection", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);

      let runState: any = null;
      let latestNotifications: any[] = [];
      let unreadNotificationCount = 0;
      let notificationSummary = { total: 0, unreadTotal: 0, unreadCrit: 0, unreadWarn: 0 };
      let persistenceAvailable = true;
      let persistenceError: string | null = null;

      try {
        runState = await storage.getAutoTradingRun(user!.id);
        latestNotifications = await storage.getEngineNotifications(user!.id, 5);
        unreadNotificationCount = await storage.getUnreadEngineNotificationCount(user!.id);
        notificationSummary = await storage.getEngineNotificationSummary(user!.id);
      } catch (dbErr: any) {
        persistenceAvailable = false;
        persistenceError = dbErr?.message || String(dbErr);
      }

      res.json({
        measuredAt: new Date().toISOString(),
        environment: {
          nodeEnv: process.env.NODE_ENV || "development",
          isReplit: !!process.env.REPL_ID || !!process.env.REPLIT_DOMAINS,
          replitDomainsConfigured: !!process.env.REPLIT_DOMAINS,
        },
        security: {
          sessionSecretConfigured: !!process.env.SESSION_SECRET,
          sessionSecretLength: (process.env.SESSION_SECRET || "").length,
          agentKeyConfigured: !!process.env.AGENT_KEY,
          browserCredentialsEndpointDisabled: true,
        },
        autoTrading: {
          persistenceAvailable,
          persistenceError,
          runState,
          unreadNotificationCount,
          notificationSummary,
          latestNotifications,
          derived: runState ? {
            heartbeatAgeSec: runState.lastHeartbeatAt
              ? Math.max(0, Math.round((Date.now() - new Date(runState.lastHeartbeatAt).getTime()) / 1000))
              : null,
            lastCycleLagSec: runState.lastCycleAt
              ? Math.max(0, Math.round((Date.now() - new Date(runState.lastCycleAt).getTime()) / 1000))
              : null,
            agentCooldownRemainingSec: (() => {
              const cooldownRaw = (runState.metadata as any)?.agentCooldownUntil;
              if (!cooldownRaw) return 0;
              const cooldownAt = new Date(cooldownRaw).getTime();
              if (!Number.isFinite(cooldownAt)) return 0;
              return Math.max(0, Math.round((cooldownAt - Date.now()) / 1000));
            })(),
            lastErrorHash: runState.lastError
              ? createHash("sha1").update(String(runState.lastError)).digest("hex").slice(0, 12)
              : null,
            lastDurationMs: Number((runState.metadata as any)?.durationMs ?? 0) || null,
            lastCycleId: (runState.metadata as any)?.cycleId ?? null,
          } : null,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
