
import { TradeExecutorService } from "../server/services/trade-executor.service";
import { storage } from "../server/storage";
import { db } from "../server/db";
import * as schema from "../shared/schema";
import { eq } from "drizzle-orm";

async function run() {
  console.log("🚀 Starting Real DB Evaluation Test...");
  const svc = new TradeExecutorService();
  
  // Find an active model and a candidate stock
  const activeModels = await storage.getActiveAiModels();
  if (activeModels.length === 0) {
    console.error("❌ No active models found.");
    return;
  }
  const model = activeModels[0];
  const settings = await db.select().from(schema.autoTradingSettings).where(eq(schema.autoTradingSettings.modelId, model.id)).limit(1);
  
  if (settings.length === 0) {
    console.error("❌ No settings found for model", model.id);
    return;
  }

  const candidate = {
    id: 999999, // dummy
    userId: model.userId,
    modelId: model.id,
    stockCode: "005930",
    stockName: "삼성전자",
    source: "test",
    scannedLine: 50,
  };

  console.log(`Testing evaluation for ${candidate.stockName} with model ${model.modelName}...`);

  try {
    // We want to see if this method runs without throwing "column details does not exist"
    // We'll mock the AI call to avoid spending money/time, but keep the storage calls real.
    
    const originalAiAnalysis = (svc as any).comprehensiveAiAnalysis;
    (svc as any).comprehensiveAiAnalysis = async () => ({
      confidence: 50,
      hasGoodFinancials: true,
      hasHighLiquidity: true,
      dartDangerKeyword: null,
      themeScore: 50,
      newsScore: 50,
      financialsScore: 50,
      liquidityScore: 50,
      institutionalScore: 50,
    });

    // Mock executeBuy to avoid real orders
    (svc as any).executeBuy = async () => { console.log("      [MOCK] executeBuy called"); };
    (svc as any).executeAdditionalBuy = async () => { console.log("      [MOCK] executeAdditionalBuy called"); };

    // We also need to mock getStockPrice because we might not have a real agent connected/responding
    const originalGetPrice = (svc as any).evaluate10LineRainbow;
    (svc as any).evaluate10LineRainbow = async () => ({ currentLine: 50, action: "buy", weight: 100, confidence: 100 });

    const kiwoomService = {
      getStockPrice: async () => ({ output: { stck_prpr: "70000" } }),
    };
    const aiService = {};

    await svc.evaluateCandidateStock(model, settings[0] as any, candidate as any, kiwoomService as any, aiService as any, "gpt-5-mini");
    
    console.log("✅ Evaluation finished without database errors!");

  } catch (err: any) {
    console.error("❌ Evaluation failed with error:", err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    process.exit(0);
  }
}

run().catch(console.error);
