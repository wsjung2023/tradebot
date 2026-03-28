// autotrading.routes.ts — 백어택2 자동 스캔 및 자동매매 관련 라우터 (레인보우 차트 + AI 분석 통합)
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { AgentTimeoutError, callViaAgent } from "../services/agent-proxy.service";
import { getUserKiwoomService } from "../services/user-kiwoom.service";
import { getAIService } from "../services/ai.service";
import { RainbowChartAnalyzer } from "../formula/rainbow-chart";

export function registerAutoTradingRoutes(app: Router) {
  const aiService = getAIService();
  const userKiwoomService = getUserKiwoomService();

  /**
   * POST /api/auto-trading/backattack-scan
   * 백어택2 레인보우 차트 스캔
   * stockCodes를 전달하면 그 종목을 분석하고,
   * 없으면 에이전트로 뒷차기2(seq=30) 조건검색을 실행해 종목을 자동으로 가져옵니다.
   */
  app.post("/api/auto-trading/backattack-scan", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) return res.status(401).json({ error: "인증이 필요합니다" });

      let { stockCodes, conditionSeq } = req.body as { stockCodes?: string[]; conditionSeq?: string };
      let conditionName = "뒷차기2";

      // stockCodes가 없으면 에이전트로 조건검색 실행 (기본: 뒷차기2 seq=30)
      if (!stockCodes || stockCodes.length === 0) {
        const seq = conditionSeq || "30";
        console.log(`[backattack-scan] stockCodes 없음 → 에이전트 condition.run(seq=${seq}) 실행`);
        try {
          const conditionResult = await callViaAgent(user.id, "condition.run", { seq }, 30000);
          if (Array.isArray(conditionResult) && conditionResult.length > 0) {
            stockCodes = conditionResult
              .map((item: any) => item.stock_code || item.stck_cd || item.code)
              .filter(Boolean);
            // 종목명도 conditionResult에서 추출해 stockList에 직접 사용
            (req as any)._conditionResultFull = conditionResult;
            console.log(`[backattack-scan] 조건검색 결과: ${stockCodes.length}개 종목`);
          } else {
            return res.json({
              message: `${conditionName} 조건에 현재 매칭된 종목이 없습니다.`,
              conditionName, totalMatches: 0, processedCount: 0,
              recommendationCount: 0, recommendations: [],
            });
          }
        } catch (agentErr: any) {
          if (agentErr instanceof AgentTimeoutError) {
            return res.status(503).json({ error: `에이전트 응답 없음: ${agentErr.message}` });
          }
          return res.status(500).json({ error: `조건검색 실패: ${agentErr.message}` });
        }
      }

      const userSettings = await storage.getUserSettings(user.id);
      const aiModel = userSettings?.aiModel || "gpt-5.1";

      // stockCodes 배열을 stock 목록으로 변환 (종목명 포함)
      const conditionResultFull: any[] = (req as any)._conditionResultFull || [];
      const nameByCode: Record<string, string> = {};
      for (const item of conditionResultFull) {
        const code = item.stock_code || item.stck_cd || item.code;
        const name = item.stock_name || item.stck_nm || item.name;
        if (code && name) nameByCode[code] = name;
      }
      const stockList = stockCodes.map((code: string) => ({
        stock_code: code,
        stock_name: nameByCode[code] || code,
      }));

      // 레인보우 분석 + AI 분석 + 필터링
      const recommendations: any[] = [];
      const filtered: Array<{ stockCode: string; stockName: string; currentPosition: number; clWidth: number; filterReason: string }> = [];
      const errors: Array<{ stockCode: string; stockName: string; error: string }> = [];
      let processedCount = 0;

      for (const stock of stockList) {
        const stockCode = (stock as any).stock_code || (stock as any).stck_cd;
        const stockName = (stock as any).stock_name || (stock as any).stck_nm || "Unknown";
        if (!stockCode) continue;

        try {
          const chartData = await userKiwoomService.getChart(user.id, stockCode, "D", 250);
          if (!chartData || chartData.length < 240) {
            throw new Error(`Insufficient chart data: ${chartData?.length || 0} bars (need 240+)`);
          }

          const rainbowResult = RainbowChartAnalyzer.analyze(stockCode, chartData, 240);
          const { currentPosition, signals, recommendation, clWidth } = rainbowResult;
          const isInBuyZone = currentPosition >= 40 && currentPosition <= 60;
          const hasGoodCLWidth = clWidth >= 10;
          const isBuyRecommendation = ["strong-buy", "buy"].includes(recommendation);

          console.log(`[backattack-scan] ${stockName}(${stockCode}) CL위치=${currentPosition.toFixed(1)}% CL폭=${clWidth.toFixed(1)}% → ${isInBuyZone && hasGoodCLWidth ? '추천' : '필터제외'}`);

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
          } else {
            const reasons: string[] = [];
            if (!isInBuyZone) reasons.push(`CL위치 ${currentPosition.toFixed(1)}% (40~60% 구간 이탈)`);
            if (!hasGoodCLWidth) reasons.push(`CL폭 ${clWidth.toFixed(1)}% (10% 미만)`);
            filtered.push({ stockCode, stockName, currentPosition, clWidth, filterReason: reasons.join(", ") });
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
        totalMatches: stockList.length, processedCount,
        recommendationCount: recommendations.length, errorCount: errors.length,
        recommendations,
        filtered: filtered.length > 0 ? filtered : undefined,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      if (error instanceof AgentTimeoutError) return res.status(503).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });
}

