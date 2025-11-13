import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { 
  isAuthenticated, 
  getCurrentUser, 
  hashPassword,
  localAuth,
  googleAuth,
  googleCallback,
  kakaoAuth,
  kakaoCallback,
  naverAuth,
  naverCallback
} from "./auth";
import { getKiwoomService } from "./services/kiwoom.service";
import { getAIService } from "./services/ai.service";
import { insertUserSchema, insertKiwoomAccountSchema, insertOrderSchema, insertAiModelSchema, insertWatchlistSchema, insertAlertSchema } from "@shared/schema";
import { MarketDataHub } from "./market-data-hub";

export async function registerRoutes(app: Express, sessionMiddleware: any): Promise<Server> {
  const kiwoomService = getKiwoomService();
  const aiService = getAIService();
  const marketHub = new MarketDataHub(kiwoomService);

  // ==================== Authentication Routes ====================

  // Register with email/password
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = insertUserSchema.parse(req.body);

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const hashedPassword = await hashPassword(password!);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        authProvider: 'local',
      });

      // Create default settings
      await storage.createUserSettings({
        userId: user.id,
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ error: "Login failed" });
        res.json({ user: { id: user.id, email: user.email, name: user.name } });
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Login with email/password
  app.post("/api/auth/login", localAuth);

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/me", isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    res.json({ user: { id: user!.id, email: user!.email, name: user!.name, profileImage: user!.profileImage } });
  });

  // Google OAuth
  app.get("/api/auth/google", googleAuth);
  app.get("/api/auth/google/callback", googleCallback, (req, res) => res.redirect("/"));

  // Kakao OAuth
  app.get("/api/auth/kakao", kakaoAuth);
  app.get("/api/auth/kakao/callback", kakaoCallback, (req, res) => res.redirect("/"));

  // Naver OAuth
  app.get("/api/auth/naver", naverAuth);
  app.get("/api/auth/naver/callback", naverCallback, (req, res) => res.redirect("/"));

  // ==================== Kiwoom Account Routes ====================

  app.get("/api/accounts", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accounts = await storage.getKiwoomAccounts(user!.id);
      res.json(accounts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/accounts", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accountData = insertKiwoomAccountSchema.parse({
        ...req.body,
        userId: user!.id,
      });
      const account = await storage.createKiwoomAccount(accountData);
      res.json(account);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteKiwoomAccount(parseInt(req.params.id));
      res.json({ message: "Account deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Portfolio/Holdings Routes ====================

  app.get("/api/accounts/:accountId/holdings", isAuthenticated, async (req, res) => {
    try {
      const holdings = await storage.getHoldings(parseInt(req.params.accountId));
      res.json(holdings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/accounts/:accountId/balance", isAuthenticated, async (req, res) => {
    try {
      const account = await storage.getKiwoomAccount(parseInt(req.params.accountId));
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const balance = await kiwoomService.getAccountBalance(account.accountNumber);
      
      // Generate 30-day asset history (mock data)
      const assetHistory = [];
      const totalAssets = parseFloat(balance.output1?.tot_evlu_amt || '100000000');
      let baseAsset = totalAssets;
      const today = new Date();
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dailyChange = (Math.random() - 0.5) * 0.02;
        baseAsset = baseAsset * (1 + dailyChange);
        const profit = baseAsset - (totalAssets * 0.95);
        
        assetHistory.push({
          date: date.toISOString().split('T')[0],
          totalAssets: Math.round(baseAsset),
          profit: Math.round(profit),
        });
      }
      
      res.json({
        ...balance,
        totalAssets,
        todayProfit: parseFloat(balance.output1?.evlu_pfls_smtl_amt || '0'),
        todayProfitRate: (parseFloat(balance.output1?.evlu_pfls_smtl_amt || '0') / totalAssets) * 100,
        totalReturn: Math.random() * 30 - 10,
        assetHistory,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Trading Routes ====================

  app.get("/api/stocks/:stockCode/price", isAuthenticated, async (req, res) => {
    try {
      const price = await kiwoomService.getStockPrice(req.params.stockCode);
      res.json(price);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stocks/:stockCode/orderbook", isAuthenticated, async (req, res) => {
    try {
      const orderbook = await kiwoomService.getStockOrderbook(req.params.stockCode);
      res.json(orderbook);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stocks/:stockCode/chart", isAuthenticated, async (req, res) => {
    try {
      const period = req.query.period as string || 'D';
      const chart = await kiwoomService.getStockChart(req.params.stockCode, period);
      res.json(chart);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stocks/search", isAuthenticated, async (req, res) => {
    try {
      const keyword = req.query.q as string;
      const results = await kiwoomService.searchStock(keyword);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Place order
  app.post("/api/orders", isAuthenticated, async (req, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      
      // Save order to database first
      const order = await storage.createOrder(orderData);

      // Get account info
      const account = await storage.getKiwoomAccount(orderData.accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      // Place order with Kiwoom
      const kiwoomOrder = await kiwoomService.placeOrder({
        accountNumber: account.accountNumber,
        stockCode: orderData.stockCode,
        orderType: orderData.orderType,
        orderQuantity: orderData.orderQuantity,
        orderPrice: orderData.orderPrice ? parseFloat(orderData.orderPrice) : undefined,
        orderMethod: orderData.orderMethod,
      });

      // Update order with Kiwoom order number
      const updatedOrder = await storage.updateOrder(order.id, {
        orderNumber: kiwoomOrder.output.ODNO,
      });

      // Log trading action
      await storage.createTradingLog({
        accountId: orderData.accountId,
        action: 'place_order',
        details: { order: updatedOrder, kiwoomResponse: kiwoomOrder },
        success: true,
      });

      res.json(updatedOrder);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/accounts/:accountId/orders", isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const orders = await storage.getOrders(parseInt(req.params.accountId), limit);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AI Analysis Routes ====================

  app.post("/api/ai/analyze-stock", isAuthenticated, async (req, res) => {
    try {
      const { stockCode, stockName, currentPrice } = req.body;
      const analysis = await aiService.analyzeStock({
        stockCode,
        stockName,
        currentPrice,
      });
      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/analyze-portfolio", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const { accountId } = req.body;
      
      const holdings = await storage.getHoldings(accountId);
      const settings = await storage.getUserSettings(user!.id);

      const analysis = await aiService.analyzePortfolio({
        holdings,
        riskLevel: settings?.riskLevel || 'medium',
        investmentGoal: 'growth',
      });
      
      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/models", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const models = await storage.getAiModels(user!.id);
      res.json(models);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/models", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const modelData = insertAiModelSchema.parse({
        ...req.body,
        userId: user!.id,
      });
      const model = await storage.createAiModel(modelData);
      res.json(model);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/ai/models/:modelId/recommendations", isAuthenticated, async (req, res) => {
    try {
      const recommendations = await storage.getAiRecommendations(parseInt(req.params.modelId));
      res.json(recommendations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Watchlist Routes ====================

  app.get("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const watchlist = await storage.getWatchlist(user!.id);
      res.json(watchlist);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const itemData = insertWatchlistSchema.parse({
        ...req.body,
        userId: user!.id,
      });
      const item = await storage.createWatchlistItem(itemData);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/watchlist/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteWatchlistItem(parseInt(req.params.id));
      res.json({ message: "Item removed from watchlist" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Alerts Routes ====================

  app.get("/api/alerts", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const alerts = await storage.getAlerts(user!.id);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/alerts", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const alertData = insertAlertSchema.parse({
        ...req.body,
        userId: user!.id,
      });
      const alert = await storage.createAlert(alertData);
      res.json(alert);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/alerts/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteAlert(parseInt(req.params.id));
      res.json({ message: "Alert deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== User Settings Routes ====================

  app.get("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const settings = await storage.getUserSettings(user!.id);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const settings = await storage.updateUserSettings(user!.id, req.body);
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time market data
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/market" });
  
  wss.on("connection", (ws) => {
    marketHub.addClient(ws);
  });

  httpServer.on("upgrade", (request, socket, head) => {
    if (!request.url?.startsWith("/ws/market")) return;
    
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
