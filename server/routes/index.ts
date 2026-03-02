// index.ts — 모든 도메인 라우터를 Express 앱에 등록하는 진입점
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { MarketDataHub } from "../market-data-hub";
import { getKiwoomService } from "../services/kiwoom";
import { rainbowRouter } from "./rainbow";
import { registerAuthRoutes } from "./auth.routes";
import { registerAccountRoutes } from "./account.routes";
import { registerTradingRoutes } from "./trading.routes";
import { registerAiRoutes } from "./ai.routes";
import { registerWatchlistRoutes } from "./watchlist.routes";
import { registerFormulaRoutes } from "./formula.routes";
import { registerAutoTradingRoutes } from "./autotrading.routes";
import { registerAdminRoutes } from "./admin.routes";

export async function registerRoutes(app: Express, sessionMiddleware: any): Promise<Server> {
  const kiwoomService = getKiwoomService();
  const marketHub = new MarketDataHub(kiwoomService);

  // 도메인별 라우터 등록
  registerAuthRoutes(app as any);
  registerAccountRoutes(app as any);
  registerTradingRoutes(app as any);
  registerAiRoutes(app as any);
  registerWatchlistRoutes(app as any);
  registerFormulaRoutes(app as any);
  registerAutoTradingRoutes(app as any);
  registerAdminRoutes(app as any);

  // 레인보우 차트 라우터
  app.use("/api/rainbow", rainbowRouter);

  // HTTP 서버 + WebSocket
  // noServer: true 로 수동 업그레이드 처리 (세션 인증 포함)
  // server+path 자동 처리와 동시 사용하면 업그레이드가 중복 처리됨
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws) => {
    marketHub.addClient(ws);
  });

  httpServer.on("upgrade", (request, socket, head) => {
    if (!request.url?.startsWith("/ws/market")) {
      socket.destroy();
      return;
    }
    sessionMiddleware(request as any, {} as any, () => {
      const user = (request as any).session?.passport?.user;
      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });
  });

  return httpServer;
}

