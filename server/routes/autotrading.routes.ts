// autotrading.routes.ts — 백어택2 자동 스캔 및 자동매매 관련 라우터 (레인보우 차트 + AI 분석 통합)
import type { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, getCurrentUser } from "../auth";
import { AgentTimeoutError, callViaAgent } from "../services/agent-proxy.service";
import { getUserKiwoomService } from "../services/user-kiwoom.service";
import { RainbowChartAnalyzer } from "../formula/rainbow-chart";

/**
 * 레인보우 차트 데이터 빌드
 * OHLCV 데이터 + 레인보우 라인 가격을 합쳐 차트 컴포넌트용 배열 생성
 * lines는 percentage 오름차순 정렬(0%=MIN → 100%=MAX)
 */
function buildRainbowChartData(ohlcvData: any[], rainbowResult: any, maxBars = 90) {
  const sortedLines = [...(rainbowResult.lines || [])].sort(
    (a: any, b: any) => a.percentage - b.percentage
  );
  return ohlcvData.slice(-maxBars).map((bar: any) => ({
    date: bar.date || bar.dt || bar.stck_bsop_date || "",
    close: Number(bar.close || bar.cls_prc || bar.stck_clpr || 0),
    line0:  sortedLines[0]?.price,   // MIN (0%)
    line1:  sortedLines[1]?.price,   // 10%
    line2:  sortedLines[2]?.price,   // 20%
    line3:  sortedLines[3]?.price,   // 30%
    line4:  sortedLines[4]?.price,   // 40%
    line5:  sortedLines[5]?.price,   // CL (50%)
    line6:  sortedLines[6]?.price,   // 60%
    line7:  sortedLines[7]?.price,   // 70%
    line8:  sortedLines[8]?.price,   // 80%
    line9:  sortedLines[9]?.price,   // 90%
    line10: sortedLines[10]?.price,  // MAX (100%)
  }));
}

export function registerAutoTradingRoutes(app: Router) {
  const userKiwoomService = getUserKiwoomService();

  /**
   * POST /api/auto-trading/backattack-scan
   * 뒷차기2 조건식으로 종목 조회 → 레인보우 차트 분석
   * - stockCodes 전달 시 해당 종목 분석
   * - 없으면 에이전트로 뒷차기2(seq=30) 조건검색 실행
   * - 2차 필터(CL 40-60% + CL폭 10%) 제거 → 전체 종목 반환 + isRecommended 플래그
   */
  app.post("/api/auto-trading/backattack-scan", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) return res.status(401).json({ error: "인증이 필요합니다" });

      let { stockCodes, conditionSeq } = req.body as { stockCodes?: string[]; conditionSeq?: string };
      const conditionName = "뒷차기2";

      // 조건검색 결과에서 가져온 원본 데이터 (종목명, 현재가 등 포함)
      let conditionResultFull: any[] = [];

      // stockCodes가 없으면 에이전트로 조건검색 실행 (기본: 뒷차기2 seq=30)
      if (!stockCodes || stockCodes.length === 0) {
        const seq = conditionSeq || "30";
        console.log(`[backattack-scan] stockCodes 없음 → 에이전트 condition.run(seq=${seq}) 실행`);
        try {
          const conditionResult = await callViaAgent(user.id, "condition.run", { seq }, 30000);
          if (Array.isArray(conditionResult) && conditionResult.length > 0) {
            conditionResultFull = conditionResult;
            stockCodes = conditionResult
              .map((item: any) => item.stock_code || item.stck_cd || item.code)
              .filter(Boolean);
            console.log(`[backattack-scan] 조건검색 결과: ${stockCodes.length}개 종목`);
          } else {
            return res.json({
              message: `${conditionName} 조건에 현재 매칭된 종목이 없습니다.`,
              conditionName, totalMatches: 0, processedCount: 0,
              recommendationCount: 0, stocks: [],
            });
          }
        } catch (agentErr: any) {
          if (agentErr instanceof AgentTimeoutError) {
            return res.status(503).json({ error: `에이전트 응답 없음: ${agentErr.message}` });
          }
          return res.status(500).json({ error: `조건검색 실패: ${agentErr.message}` });
        }
      }

      // 종목명·가격 맵 (조건검색 결과에서 추출)
      const nameByCode: Record<string, string> = {};
      const priceByCode: Record<string, number> = {};
      const changeRateByCode: Record<string, number> = {};
      for (const item of conditionResultFull) {
        const code = item.stock_code || item.stck_cd || item.code;
        const name = item.stock_name || item.stck_nm || item.name;
        const price = Number(item.current_price || item.stck_prpr || item.cur_prc || 0);
        const changeRate = Number(item.change_rate || item.prdy_ctrt || 0);
        if (code) {
          if (name) nameByCode[code] = name;
          if (price) priceByCode[code] = price;
          changeRateByCode[code] = changeRate;
        }
      }

      const stockList = stockCodes.map((code: string) => ({
        stock_code: code,
        stock_name: nameByCode[code] || code,
      }));

      const stocks: any[] = [];
      const errors: Array<{ stockCode: string; stockName: string; error: string }> = [];
      let processedCount = 0;
      let recommendationCount = 0;

      for (const stock of stockList) {
        const stockCode = stock.stock_code;
        const stockName = stock.stock_name || "Unknown";
        if (!stockCode) continue;

        try {
          const rawChartData = await userKiwoomService.getChart(user.id, stockCode, "D", 260);
          if (!rawChartData || rawChartData.length < 240) {
            throw new Error(`차트 데이터 부족: ${rawChartData?.length || 0}개 (240개 필요)`);
          }

          const rainbowResult = RainbowChartAnalyzer.analyze(stockCode, rawChartData, 240);
          const { currentPosition, signals, recommendation, clWidth, CL, lines } = rainbowResult;

          // 2차 필터 기준 (레이블용, 필터링은 하지 않음)
          const isInBuyZone = currentPosition >= 40 && currentPosition <= 60;
          const hasGoodCLWidth = clWidth >= 10;
          const isRecommended = isInBuyZone && hasGoodCLWidth;

          if (isRecommended) recommendationCount++;

          // 현재가: 조건검색 결과 → 차트 최신 종가 순으로 폴백
          const currentPrice = priceByCode[stockCode] || rainbowResult.current;
          const changeRate = changeRateByCode[stockCode] || 0;

          // 레인보우 차트 컴포넌트용 데이터 (OHLCV + 11개 라인 가격)
          const chartData = buildRainbowChartData(rawChartData, rainbowResult, 90);

          console.log(
            `[backattack-scan] ${stockName}(${stockCode}) ` +
            `CL위치=${currentPosition.toFixed(1)}% CL폭=${clWidth.toFixed(1)}% ` +
            `CL=₩${CL.toLocaleString('ko-KR')} → ${isRecommended ? '추천' : '참고'}`
          );

          stocks.push({
            stockCode,
            stockName,
            currentPrice,
            changeRate,
            isRecommended,
            currentPosition,
            clWidth,
            CL,
            recommendation,
            signals: {
              nearCL: signals.nearCL,
              clWidthGood: hasGoodCLWidth,
              inBuyZone: isInBuyZone,
              inSellZone: signals.aboveCL && !isInBuyZone,
            },
            rainbowAnalysis: {
              ...rainbowResult,
              chartData,
            },
          });
        } catch (error: any) {
          console.error(`[backattack-scan] ${stockName}(${stockCode}) 오류: ${error.message}`);
          errors.push({ stockCode, stockName, error: error.message });
        }

        processedCount++;
        if (processedCount < stockList.length) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      // 추천 종목 먼저, 그 안에서 CL 위치가 50%에 가까운 순
      stocks.sort((a, b) => {
        if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1;
        return Math.abs(a.currentPosition - 50) - Math.abs(b.currentPosition - 50);
      });

      res.json({
        message: "뒷차기2 스캔 완료",
        conditionName,
        totalMatches: stockList.length,
        processedCount,
        recommendationCount,
        errorCount: errors.length,
        stocks,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      if (error instanceof AgentTimeoutError) return res.status(503).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });
}
