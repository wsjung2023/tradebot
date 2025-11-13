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
import { parseFormula } from "./services/formula/parser";
import { FormulaEvaluator } from "./services/formula/evaluator";
import { 
  insertUserSchema, 
  insertKiwoomAccountSchema, 
  insertOrderSchema, 
  insertAiModelSchema, 
  updateAiModelSchema, 
  insertWatchlistSchema, 
  insertAlertSchema,
  insertConditionFormulaSchema,
  insertChartFormulaSchema,
  insertWatchlistSignalSchema,
  insertFinancialSnapshotSchema,
  insertMarketIssueSchema,
  type InsertConditionFormula
} from "@shared/schema";
import { MarketDataHub } from "./market-data-hub";
import { z } from "zod";

export async function registerRoutes(app: Express, sessionMiddleware: any): Promise<Server> {
  const kiwoomService = getKiwoomService();
  const aiService = getAIService();
  const marketHub = new MarketDataHub(kiwoomService);

  // ==================== Authentication Routes ====================

  // Register with email/password
  app.post("/api/auth/register", async (req, res) => {
    try {
      console.log('[REGISTER] Starting registration for:', req.body.email);
      const { email, password, name } = insertUserSchema.parse(req.body);

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        console.log('[REGISTER] ❌ Email already registered:', email);
        return res.status(400).json({ error: "Email already registered" });
      }

      const hashedPassword = await hashPassword(password!);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        authProvider: 'local',
      });
      console.log('[REGISTER] ✅ User created:', user.id, user.email);

      // Create default settings
      await storage.createUserSettings({
        userId: user.id,
        tradingMode: 'mock',
        riskLevel: 'medium',
      });

      req.login(user, (err) => {
        if (err) {
          console.log('[REGISTER] ❌ req.login() failed:', err);
          return res.status(500).json({ error: "Login failed" });
        }
        console.log('[REGISTER] ✅ req.login() succeeded, sessionID:', req.sessionID, 'user.id:', user.id);
        req.session.save((saveErr) => {
          if (saveErr) {
            console.log('[REGISTER] ❌ session.save() failed:', saveErr);
            return res.status(500).json({ error: "Session save failed" });
          }
          console.log('[REGISTER] ✅ Session saved successfully');
          res.json({ user: { id: user.id, email: user.email, name: user.name } });
        });
      });
    } catch (error: any) {
      console.log('[REGISTER] ❌ Error:', error.message);
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
        orderMethod: orderData.orderMethod as 'market' | 'limit',
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
        riskLevel: (settings?.riskLevel || 'medium') as 'low' | 'medium' | 'high',
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

  app.patch("/api/ai/models/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const modelId = parseInt(req.params.id);
      
      // Check ownership
      const existingModel = await storage.getAiModel(modelId);
      if (!existingModel) {
        return res.status(404).json({ error: "Model not found" });
      }
      if (existingModel.userId !== user!.id) {
        return res.status(403).json({ error: "Not authorized to update this model" });
      }
      
      // Validate update payload with Zod
      const validatedUpdates = updateAiModelSchema.parse(req.body);
      
      const model = await storage.updateAiModel(modelId, validatedUpdates);
      res.json(model);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/ai/models/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const modelId = parseInt(req.params.id);
      
      // Check ownership
      const existingModel = await storage.getAiModel(modelId);
      if (!existingModel) {
        return res.status(404).json({ error: "Model not found" });
      }
      if (existingModel.userId !== user!.id) {
        return res.status(403).json({ error: "Not authorized to delete this model" });
      }
      
      await storage.deleteAiModel(modelId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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

  // ==================== Trading History Routes ====================

  app.get("/api/trading-logs", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accounts = await storage.getKiwoomAccounts(user!.id);
      
      if (accounts.length === 0) {
        return res.json([]);
      }
      
      // Get logs from all user accounts
      const allLogs = await Promise.all(
        accounts.map(account => storage.getTradingLogs(account.id))
      );
      const logs = allLogs.flat().sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/all-orders", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const accounts = await storage.getKiwoomAccounts(user!.id);
      
      if (accounts.length === 0) {
        return res.json([]);
      }
      
      // Get orders from all user accounts
      const allOrders = await Promise.all(
        accounts.map(account => storage.getOrders(account.id))
      );
      const orders = allOrders.flat().sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Condition Formula Routes (화면 0105) ====================

  app.get("/api/conditions", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const conditions = await storage.getConditionFormulas(user!.id);
      res.json(conditions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/conditions", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      
      // Parse rawFormula to generate formulaAst (required)
      let formulaAst;
      try {
        formulaAst = req.body.rawFormula 
          ? parseFormula(req.body.rawFormula)
          : { type: 'empty', body: [] }; // Empty AST for conditions without formula
      } catch (parseError: any) {
        return res.status(400).json({ 
          error: 'Invalid formula syntax', 
          details: parseError.message 
        });
      }
      
      // Validate against schema
      const data = insertConditionFormulaSchema.parse({
        conditionName: req.body.conditionName,
        description: req.body.description,
        marketType: req.body.marketType || 'ALL',
        rawFormula: req.body.rawFormula,
        isActive: req.body.isActive !== undefined ? req.body.isActive : false,
        isRealTimeMonitoring: req.body.isRealTimeMonitoring !== undefined ? req.body.isRealTimeMonitoring : false,
        userId: user!.id,
        formulaAst,
      });
      
      const condition = await storage.createConditionFormula(data);
      res.status(201).json(condition);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Failed to create condition formula:', error);
      res.status(500).json({ error: 'Failed to create condition formula' });
    }
  });

  app.get("/api/conditions/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const conditionId = parseInt(req.params.id);
      const condition = await storage.getConditionFormula(conditionId);
      
      if (!condition) {
        return res.status(404).json({ error: "Condition formula not found" });
      }
      
      if (condition.userId !== user!.id) {
        return res.status(403).json({ error: "Not authorized to view this condition formula" });
      }
      
      res.json(condition);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/conditions/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const conditionId = parseInt(req.params.id);
      
      const existingCondition = await storage.getConditionFormula(conditionId);
      if (!existingCondition) {
        return res.status(404).json({ error: "Condition formula not found" });
      }
      
      if (existingCondition.userId !== user!.id) {
        return res.status(403).json({ error: "Not authorized to update this condition formula" });
      }
      
      // Build validated update payload
      const updatePayload: Partial<InsertConditionFormula> = {};
      
      if (req.body.conditionName !== undefined) updatePayload.conditionName = req.body.conditionName;
      if (req.body.description !== undefined) updatePayload.description = req.body.description;
      if (req.body.marketType !== undefined) updatePayload.marketType = req.body.marketType;
      if (req.body.isActive !== undefined) updatePayload.isActive = req.body.isActive;
      if (req.body.isRealTimeMonitoring !== undefined) updatePayload.isRealTimeMonitoring = req.body.isRealTimeMonitoring;
      
      // Re-parse rawFormula if it's being updated
      if (req.body.rawFormula !== undefined) {
        updatePayload.rawFormula = req.body.rawFormula;
        try {
          updatePayload.formulaAst = req.body.rawFormula 
            ? parseFormula(req.body.rawFormula)
            : { type: 'empty', body: [] };
        } catch (parseError: any) {
          return res.status(400).json({ 
            error: 'Invalid formula syntax', 
            details: parseError.message 
          });
        }
      }
      
      // Validate partial update with Zod
      const partialSchema = insertConditionFormulaSchema.partial();
      const validatedUpdate = partialSchema.parse(updatePayload);
      
      const condition = await storage.updateConditionFormula(conditionId, validatedUpdate);
      res.json(condition);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Failed to update condition formula:', error);
      res.status(500).json({ error: 'Failed to update condition formula' });
    }
  });

  app.delete("/api/conditions/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const conditionId = parseInt(req.params.id);
      
      const existingCondition = await storage.getConditionFormula(conditionId);
      if (!existingCondition) {
        return res.status(404).json({ error: "Condition formula not found" });
      }
      
      if (existingCondition.userId !== user!.id) {
        return res.status(403).json({ error: "Not authorized to delete this condition formula" });
      }
      
      await storage.deleteConditionFormula(conditionId);
      res.json({ message: "Condition formula deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Run condition search (execute screening)
  app.post("/api/conditions/:id/run", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const conditionId = parseInt(req.params.id);
      
      const condition = await storage.getConditionFormula(conditionId);
      if (!condition) {
        return res.status(404).json({ error: "Condition formula not found" });
      }
      
      if (condition.userId !== user!.id) {
        return res.status(403).json({ error: "Not authorized to run this condition formula" });
      }
      
      // Execute condition search via Kiwoom service
      const searchResponse = await kiwoomService.getConditionSearchResults(
        condition.conditionName,
        0 // conditionIndex - using 0 as default, should be stored with formula
      );
      
      // Extract results from response (output1 contains the stock list)
      const results = searchResponse?.output1 || [];
      
      // Store results in database (skip entries without valid stock code)
      for (const result of results) {
        if (!result.stck_cd || !result.stck_nm) {
          continue; // Skip invalid entries
        }
        
        await storage.createConditionResult({
          conditionId,
          stockCode: result.stck_cd,
          stockName: result.stck_nm,
          matchScore: null,
          currentPrice: result.stck_prpr || null,
          changeRate: result.prdy_ctrt || null,
          volume: result.vol ? Number(result.vol) : null,
          marketCap: null,
          per: null,
          pbr: null,
          passedFilters: true,
          metadata: result as any,
        });
      }
      
      // Update match count and last matched time
      await storage.updateConditionFormula(conditionId, {
        matchCount: results.length,
        lastMatchedAt: new Date(),
      });
      
      res.json({ 
        message: "Condition search executed successfully",
        matchCount: results.length 
      });
    } catch (error: any) {
      console.error('Failed to run condition search:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/conditions/:id/results", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const conditionId = parseInt(req.params.id);
      
      const condition = await storage.getConditionFormula(conditionId);
      if (!condition) {
        return res.status(404).json({ error: "Condition formula not found" });
      }
      
      if (condition.userId !== user!.id) {
        return res.status(403).json({ error: "Not authorized to view results for this condition formula" });
      }
      
      const results = await storage.getConditionResults(conditionId);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Chart Formula Routes (차트 수식) ====================

  app.get("/api/chart-formulas", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const formulas = await storage.getChartFormulas(user!.id);
      res.json(formulas);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chart-formulas", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      
      // Parse and validate the formula
      const { rawFormula, ...restData } = req.body;
      
      if (!rawFormula) {
        return res.status(400).json({ error: 'Formula text is required' });
      }
      
      let formulaAst;
      try {
        formulaAst = parseFormula(rawFormula);
      } catch (parseError: any) {
        return res.status(400).json({ 
          error: 'Invalid formula syntax', 
          details: parseError.message 
        });
      }
      
      const data = insertChartFormulaSchema.parse({
        ...restData,
        userId: user!.id,
        rawFormula,
        formulaAst,
      });
      
      const formula = await storage.createChartFormula(data);
      res.status(201).json(formula);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Failed to create chart formula:', error);
      res.status(500).json({ error: 'Failed to create chart formula' });
    }
  });

  app.get("/api/chart-formulas/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const formulaId = parseInt(req.params.id);
      const formula = await storage.getChartFormula(formulaId);
      
      if (!formula) {
        return res.status(404).json({ error: "Chart formula not found" });
      }
      
      if (formula.userId !== user!.id) {
        return res.status(403).json({ error: "Not authorized to view this chart formula" });
      }
      
      res.json(formula);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/chart-formulas/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const formulaId = parseInt(req.params.id);
      
      const existingFormula = await storage.getChartFormula(formulaId);
      if (!existingFormula) {
        return res.status(404).json({ error: "Chart formula not found" });
      }
      
      if (existingFormula.userId !== user!.id) {
        return res.status(403).json({ error: "Not authorized to update this chart formula" });
      }
      
      // If rawFormula is being updated, re-parse it
      let updates = { ...req.body };
      if (req.body.rawFormula) {
        try {
          updates.formulaAst = parseFormula(req.body.rawFormula);
        } catch (parseError: any) {
          return res.status(400).json({ 
            error: 'Invalid formula syntax', 
            details: parseError.message 
          });
        }
      }
      
      const formula = await storage.updateChartFormula(formulaId, updates);
      res.json(formula);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Failed to update chart formula:', error);
      res.status(500).json({ error: 'Failed to update chart formula' });
    }
  });

  app.delete("/api/chart-formulas/:id", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const formulaId = parseInt(req.params.id);
      
      const existingFormula = await storage.getChartFormula(formulaId);
      if (!existingFormula) {
        return res.status(404).json({ error: "Chart formula not found" });
      }
      
      if (existingFormula.userId !== user!.id) {
        return res.status(403).json({ error: "Not authorized to delete this chart formula" });
      }
      
      await storage.deleteChartFormula(formulaId);
      res.json({ message: "Chart formula deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chart-formulas/:id/evaluate", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const formulaId = parseInt(req.params.id);
      
      const formula = await storage.getChartFormula(formulaId);
      if (!formula) {
        return res.status(404).json({ error: "Chart formula not found" });
      }
      
      if (formula.userId !== user!.id) {
        return res.status(403).json({ error: "Not authorized to evaluate this chart formula" });
      }
      
      const { stockCode, period = 'D' } = req.body;
      
      if (!stockCode) {
        return res.status(400).json({ error: 'Stock code is required' });
      }
      
      // Fetch chart data from Kiwoom
      const chartData = await kiwoomService.getStockChart(stockCode, period);
      
      // Normalize Kiwoom chart data to OHLCV format
      const ohlcvData = (chartData.output2 || []).map((candle: any) => ({
        date: candle.stck_bsop_date || '',
        open: parseFloat(candle.stck_oprc) || 0,
        high: parseFloat(candle.stck_hgpr) || 0,
        low: parseFloat(candle.stck_lwpr) || 0,
        close: parseFloat(candle.stck_clpr) || 0,
        volume: parseInt(candle.acml_vol) || 0,
      }));
      
      // Evaluate formula
      const evaluator = new FormulaEvaluator();
      const results = evaluator.evaluate(formula.formulaAst as any, ohlcvData);
      
      // Generate signal line with color
      const signalLine = {
        color: formula.color || 'green',
        name: formula.formulaName,
        values: ohlcvData.map((d, i) => ({
          date: d.date,
          value: results[i],
        })),
      };
      
      res.json({
        stockCode,
        period,
        formulaName: formula.formulaName,
        signalLine,
      });
    } catch (error: any) {
      console.error('Failed to evaluate chart formula:', error);
      res.status(500).json({ error: 'Failed to evaluate chart formula' });
    }
  });

  // ==================== Stock Fundamentals Routes (재무 데이터) ====================

  app.get("/api/stocks/:code/fundamentals", isAuthenticated, async (req, res) => {
    try {
      const stockCode = req.params.code;
      const snapshots = await storage.getFinancialSnapshots(stockCode);
      
      res.json(snapshots);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stocks/sync-financials", isAuthenticated, async (req, res) => {
    try {
      const { stockCodes } = req.body;
      
      if (!Array.isArray(stockCodes) || stockCodes.length === 0) {
        return res.status(400).json({ error: 'Stock codes array is required' });
      }
      
      const results = [];
      
      for (const stockCode of stockCodes) {
        try {
          // Fetch financial statements from Kiwoom
          const financialData = await kiwoomService.getFinancialStatements(stockCode);
          
          // Store each year's data
          if (financialData.output && Array.isArray(financialData.output)) {
            for (const yearData of financialData.output) {
              const fiscalYear = parseInt(yearData.stac_yymm?.substring(0, 4) || '0');
              
              if (fiscalYear > 0) {
                const snapshotData = insertFinancialSnapshotSchema.parse({
                  stockCode,
                  fiscalYear,
                  revenue: yearData.sale_account || null,
                  operatingProfit: yearData.bsop_prti || null,
                  netIncome: yearData.ntin || null,
                  totalAssets: yearData.total_aset || null,
                  totalLiabilities: yearData.total_lblt || null,
                  totalEquity: yearData.cpfn || null,
                  debtRatio: null,
                  roe: null,
                  roa: null,
                  isHealthy: true,
                });
                
                // Check if snapshot exists
                const existing = await storage.getFinancialSnapshot(stockCode, fiscalYear);
                
                if (existing) {
                  await storage.updateFinancialSnapshot(existing.id, snapshotData);
                } else {
                  await storage.createFinancialSnapshot(snapshotData);
                }
              }
            }
          }
          
          results.push({ stockCode, success: true });
        } catch (stockError: any) {
          console.error(`Failed to sync financials for ${stockCode}:`, stockError);
          results.push({ stockCode, success: false, error: stockError.message });
        }
      }
      
      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Watchlist Signals Routes (화면 0130) ====================

  app.get("/api/watchlist/:id/signals", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const watchlistId = parseInt(req.params.id);
      
      // Verify watchlist item ownership
      const watchlistItem = await storage.getWatchlist(user!.id);
      const item = watchlistItem.find(w => w.id === watchlistId);
      
      if (!item) {
        return res.status(404).json({ error: "Watchlist item not found" });
      }
      
      const signals = await storage.getWatchlistSignals(watchlistId);
      res.json(signals);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/watchlist/:id/signals", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const watchlistId = parseInt(req.params.id);
      
      // Verify watchlist item ownership
      const watchlistItems = await storage.getWatchlist(user!.id);
      const item = watchlistItems.find(w => w.id === watchlistId);
      
      if (!item) {
        return res.status(404).json({ error: "Watchlist item not found" });
      }
      
      const data = insertWatchlistSignalSchema.parse({
        ...req.body,
        watchlistId,
      });
      
      const signal = await storage.createWatchlistSignal(data);
      res.status(201).json(signal);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Failed to create watchlist signal:', error);
      res.status(500).json({ error: 'Failed to create watchlist signal' });
    }
  });

  app.delete("/api/watchlist/:id/signals/:signalId", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const watchlistId = parseInt(req.params.id);
      const signalId = parseInt(req.params.signalId);
      
      // Verify watchlist item ownership
      const watchlistItems = await storage.getWatchlist(user!.id);
      const item = watchlistItems.find(w => w.id === watchlistId);
      
      if (!item) {
        return res.status(404).json({ error: "Watchlist item not found" });
      }
      
      await storage.deleteWatchlistSignal(signalId);
      res.json({ message: "Watchlist signal deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Market Issues Routes (시장이슈종목) ====================

  app.get("/api/market-issues", isAuthenticated, async (req, res) => {
    try {
      const dateParam = req.query.date as string;
      const issueDate = dateParam || new Date().toISOString().split('T')[0].replace(/-/g, '');
      
      const issues = await storage.getMarketIssues(issueDate);
      res.json(issues);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/market-issues/stock/:code", isAuthenticated, async (req, res) => {
    try {
      const stockCode = req.params.code;
      const issues = await storage.getMarketIssuesByStock(stockCode);
      res.json(issues);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
