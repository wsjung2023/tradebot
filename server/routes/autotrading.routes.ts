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
   * 백어택2 조건 자동 실행 + 레인보우 차트 분석
   * Flow: HTS 조건 목록 → 조건 실행 → 레인보우 분석 → CL 40~60% 필터 → AI 분석 → 추천
   */
  app.post("/api/auto-trading/backattack-scan", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) return res.status(401).json({ error: "인증이 필요합니다" });

      const userSettings = await storage.getUserSettings(user.id);
      const aiModel = userSettings?.aiModel || "gpt-5.1";

      // Step 1: HTS 조건식 목록
      let conditionListResponse;
      try {
        conditionListResponse = await kiwoomService.getConditionList();
      } catch (error: any) {
        return res.status(500).json({ error: "조건식 목록 조회 실패", details: error.message });
      }

      const listAny = conditionListResponse as any;
      const listRtCd = listAny?.rt_cd || listAny?.msg_cd;
      if (listRtCd && listRtCd !== "0") {
        return res.status(502).json({ error: "HTS 조건식 목록 조회 실패", errorCode: listRtCd, message: listAny?.msg1 || listAny?.msg });
      }

      const conditionList = (conditionListResponse?.output as any) || [];

      // Step 2: 백어택2 조건식 찾기
      const backattack2 = conditionList.find((c: any) =>
        (c.condition_name || c.cond_nm || "").includes("백어택2") ||
        (c.condition_name || c.cond_nm || "").includes("BackAttack2")
      );

      if (!backattack2) {
        return res.status(404).json({
          error: "백어택2 조건식을 찾을 수 없습니다. HTS에서 조건식을 확인해주세요.",
          availableConditions: conditionList.map((c: any) => c.condition_name || c.cond_nm),
        });
      }

      const conditionName = backattack2.condition_name || backattack2.cond_nm;
      const conditionIndex = backattack2.condition_index || backattack2.cond_idx || 0;

      // Step 3: 조건식 실행
      let searchResponse;
      try {
        searchResponse = await kiwoomService.getConditionSearchResults(conditionName, conditionIndex);
      } catch (error: any) {
        return res.status(500).json({ error: "조건검색 실행 실패", details: error.message });
      }

      const respAny = searchResponse as any;
      const rtCd = respAny?.rt_cd || respAny?.msg_cd;
      if (rtCd && rtCd !== "0") {
        return res.status(502).json({ error: "HTS 조건검색 실행 실패", errorCode: rtCd, message: respAny?.msg1 || respAny?.msg });
      }

      const stockList = (searchResponse?.output1 || searchResponse?.output || []) as any[];
      if (stockList.length === 0) {
        return res.json({ message: "조건에 맞는 종목이 없습니다.", matchCount: 0, recommendations: [], errors: [] });
      }

      // Step 4~5: 레인보우 분석 + AI 분석 + 필터링
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

