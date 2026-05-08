import type { Express } from "express";
import { type Server } from "http";
import { WebSocketServer } from "ws";
import { MarketDataHub } from "../market-data-hub";
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
import { storage } from "../storage";
import { getOrderSyncService } from "../services/order-sync.service";

export async function registerRoutes(app: Express, httpServer: Server, sessionMiddleware: any): Promise<void> {
  const marketHub = new MarketDataHub();

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

  const orderSyncService = getOrderSyncService();
  const expireAllPendingOrders = async () => {
    try {
      const accounts = await storage.getAllActiveKiwoomAccounts();
      for (const account of accounts) {
        await orderSyncService.expireOldPendingOrders(account.id);
      }
    } catch (e) {
      console.error('[PendingExpiry] 만료 주문 처리 실패:', e);
    }
  };
  setTimeout(expireAllPendingOrders, 5000);
  setInterval(expireAllPendingOrders, 60 * 60 * 1000);

  app.use("/api/rainbow", rainbowRouter);

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    if (!request.url?.startsWith("/ws/market")) {
      // IMPORTANT:
      // Do not destroy non-market upgrades here.
      // In development, Vite HMR uses its own websocket upgrade path
      // (e.g. "/?token=..."), and force-destroying it causes blank/flaky UI.
      // Simply return so other upgrade handlers can process it.
      return;
    }

    sessionMiddleware(request as any, {} as any, () => {
      const sessionUserId = (request as any).session?.passport?.user;
      if (!sessionUserId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        marketHub.addClient(ws, String(sessionUserId));
      });
    });
  });
}
