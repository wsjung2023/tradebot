// settings.routes.ts — 설정 및 시스템 정보 조회
import type { Express } from "express";
import axios from "axios";

export function registerSettingsRoutes(app: Express): void {
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
      return cachedServerIP || "0.0.0.0";
    }
  };

  app.get("/api/server-info", async (req, res) => {
    try {
      const serverIP = await getServerIP();
      res.json({
        serverIP,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
