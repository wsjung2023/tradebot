// autotrading.routes.ts — 백어택2 자동 스캔 및 자동매매 관련 라우터 (레인보우 차트 + AI 분석 통합)
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { getKiwoomService } from "../services/kiwoom";
import { getAIService } from "../services/ai.service";
import { RainbowChartAnalyzer } from "../formula/rainbow-chart";

export function registerAutoTradingRoutes(app: Router) {
  const kiwoomService = getKiwoomService();
  const aiService = getAIService();

  /**
   * POST /api/auto-trading/backattack-scan
   * 백어택2 레인보우 차트 스캔
   * 참고: 키움 REST API는 HTS 조건검색을 지원하지 않습니다.
   * 종목 목록을 요청 본문(stockCodes)으로 직접 전달하거나,
   * 커스텀 조건식 메뉴를 통해 종목을 선택하세요.
   */
  app.post("/api/auto-trading/backattack-scan", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) return res.status(401).json({ error: "인증이 필요합니다" });

      // 키움 REST API는 HTS 조건검색 미지원 — 종목 목록을 body로 직접 받음
      const { stockCodes } = req.body as { stockCodes?: string[] };
      if (!stockCodes || stockCodes.length === 0) {
        return res.status(400).json({
          error: "키움 REST API는 HTS 조건검색을 지원하지 않습니다.",
          guide: "요청 본문에 { stockCodes: ['005930', '000660', ...] } 형태로 종목 코드를 전달하세요.",
          alternative: "커스텀 조건식 메뉴(조건검색)에서 직접 종목을 추가한 뒤 스캔할 수 있습니다.",
        });
      }

      const userSettings = await storage.getUserSettings(user.id);
      const aiModel = userSettings?.aiModel || "gpt-5.1";

      // stockCodes 배열을 stock 목록으로 변환
      const stockList = stockCodes.map((code: string) => ({ stock_code: code, stock_name: code }));

      // 레인보우 분석 + AI 분석 + 필터링
      const recommendations: any[] = [];
      const errors: Array<{ stockCode: string; stockName: string; error: string }> = [];
      let processedCount = 0;

      for (const stock of stockList) {
        const stockCode = (stock as any).stock_code || (stock as any).stck_cd;
        const stockName = (stock as any).stock_name || (stock as any).stck_nm || "Unknown";
        if (!stockCode) continue;

        try {
          const chartData = await kiwoomService.getStockChart(stockCode, "D", 250);
          if (!chartData || chartData.length < 240) {
            throw new Error(`Insufficient chart data: ${chartData?.length || 0} bars (need 240+)`);
          }

          const rainbowResult = RainbowChartAnalyzer.analyze(stockCode, chartData, 240);
          const { currentPosition, signals, recommendation, clWidth } = rainbowResult;
          const isInBuyZone = currentPosition >= 40 && currentPosition <= 60;
          const hasGoodCLWidth = clWidth >= 10;
          const isBuyRecommendation = ["strong-buy", "buy"].includes(recommendation);

          if (isInBuyZone && hasGoodCLWidth) {
            let aiAnalysis = null;
            try {
              const priceHistory = chartData.slice(0, 30).map((bar: any) => ({
                date: bar.stck_bsop_date || bar.date,
                price: parseFloat(bar.stck_clpr || bar.close),
                volume: parseFloat(bar.acml_vol || bar.volume),
              }));
              aiAnalysis = await aiService.analyzeStock(
                { stockCode, stockName, currentPrice: rainbowResult.current, priceHistory, rainbowChart: rainbowResult },
                aiModel
              );
            } catch (aiError: any) {
              console.error(`[BackAttack2] AI analysis failed for ${stockCode}: ${aiError.message}`);
            }

            recommendations.push({
              stockCode, stockName,
              currentPrice: rainbowResult.current,
              currentPosition, clWidth, recommendation, signals,
              rainbowAnalysis: rainbowResult, aiAnalysis,
              priority: isBuyRecommendation ? "high" : "medium",
            });
          }
        } catch (error: any) {
          errors.push({ stockCode, stockName, error: error.message });
        }

        processedCount++;
        if (processedCount < stockList.length) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      recommendations.sort((a, b) => {
        if (a.priority === "high" && b.priority !== "high") return -1;
        if (a.priority !== "high" && b.priority === "high") return 1;
        return Math.abs(a.currentPosition - 50) - Math.abs(b.currentPosition - 50);
      });

      res.json({
        message: "백어택2 스캔 완료",
        conditionName, totalMatches: stockList.length, processedCount,
        recommendationCount: recommendations.length, errorCount: errors.length,
        recommendations, errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

