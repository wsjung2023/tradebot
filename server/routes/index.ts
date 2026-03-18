// index.ts ??紐⑤뱺 ?꾨찓???쇱슦?곕? Express ?깆뿉 ?깅줉?섎뒗 吏꾩엯??
import type { Express } from "express";
import { type Server } from "http";
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
import { registerSettingsRoutes } from "./settings.routes";
import { registerKiwoomAgentRoutes } from "./kiwoom-agent.routes";

export async function registerRoutes(app: Express, httpServer: Server, sessionMiddleware: any): Promise<void> {
  const kiwoomService = getKiwoomService();
  const marketHub = new MarketDataHub(kiwoomService);

  // ?꾨찓?몃퀎 ?쇱슦???깅줉
  registerAuthRoutes(app as any);
  registerAccountRoutes(app as any);
  registerTradingRoutes(app as any);
  registerAiRoutes(app as any);
  registerWatchlistRoutes(app as any);
  registerFormulaRoutes(app as any);
  registerAutoTradingRoutes(app as any);
  registerAdminRoutes(app as any);
  registerSettingsRoutes(app as any);
  registerKiwoomAgentRoutes(app as any);

  // ?덉씤蹂댁슦 李⑦듃 ?쇱슦??
  app.use("/api/rainbow", rainbowRouter);

  // WebSocket ???대? ?앹꽦??httpServer???곌껐
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
}

