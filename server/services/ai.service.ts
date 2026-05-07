// ai.service.ts — OpenAI GPT-4 기반 주식 분석, 포트폴리오 최적화, AI 모델 추천 생성 서비스
import OpenAI from 'openai';
import type { AiModel, Holding, Order } from '@shared/schema';
import type { NewsResult } from './news.service';
import { RainbowChartAnalyzer, type OHLCVData, type RainbowChartResult } from '../formula/rainbow-chart';

interface StockAnalysisRequest {
  stockCode: string;
  stockName: string;
  currentPrice: number;
  priceHistory?: Array<{ date: string; price: number; volume: number }>;
  technicalIndicators?: any;
  rainbowChart?: RainbowChartResult;
}

interface StockAnalysisResponse {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  themeScore: number;
  newsScore: number;
  targetPrice: number | null;
  reasoning: string;
  indicators: any;
}

interface PortfolioAnalysisRequest {
  holdings: Holding[];
  riskLevel: 'low' | 'medium' | 'high';
  investmentGoal: string;
}

interface PortfolioAnalysisResponse {
  recommendations: Array<{
    stockCode: string;
    stockName: string;
    action: 'buy' | 'sell' | 'hold';
    reason: string;
  }>;
  overallStrategy: string;
  riskAssessment: string;
}

interface TradingStrategyRequest {
  modelType: 'momentum' | 'value' | 'technical' | 'custom';
  parameters: any;
  backtestData?: any;
}

interface TradingStrategyResponse {
  strategy: string;
  entryConditions: string[];
  exitConditions: string[];
  riskManagement: string;
  expectedPerformance: any;
}

export class AIService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  // ==================== Helper Methods ====================

  private async createJsonCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: {
      model?: string;
      temperature?: number;
    } = {}
  ): Promise<any> {
    const { model = 'gpt-5.1', temperature = 0.3 } = options;

    try {
      const completion = await this.openai.chat.completions.create({
        model,
        messages,
        temperature,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch (error) {
      console.error(`AI completion failed (model: ${model}):`, error);
      throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== Stock Analysis ====================

  async analyzeStock(request: StockAnalysisRequest, model: string = 'gpt-5.1'): Promise<StockAnalysisResponse> {
    const prompt = `You are a professional stock trading analyst. Analyze the following stock and provide actionable trading recommendations.

Stock Information:
- Code: ${request.stockCode}
- Name: ${request.stockName}
- Current Price: ₩${request.currentPrice.toLocaleString()}
${request.priceHistory ? `- Recent Price Data: ${JSON.stringify(request.priceHistory.slice(0, 30))}` : ''}
${request.technicalIndicators ? `- Technical Indicators: ${JSON.stringify(request.technicalIndicators)}` : ''}
${request.rainbowChart ? `
Rainbow Chart Analysis (240-Day Range):
- 240-Day High: ₩${request.rainbowChart.highest.toLocaleString()}
- 240-Day Low: ₩${request.rainbowChart.lowest.toLocaleString()}
- Current Position: ${request.rainbowChart.currentPosition.toFixed(1)}%
- Current Zone: ${request.rainbowChart.currentZone}
- Chart Recommendation: ${request.rainbowChart.recommendation.toUpperCase()}
- CL (50% Green Line): ₩${request.rainbowChart.CL.toLocaleString()}
- CL Width: ${request.rainbowChart.clWidth.toFixed(1)}%
- Current vs CL: ${((request.currentPrice / request.rainbowChart.CL - 1) * 100).toFixed(2)}%
` : ''}

Based on technical analysis, market trends, and trading patterns, provide:
1. Recommended action: BUY, SELL, or HOLD
2. Confidence level: 0-100%
3. Theme score: sector/theme momentum strength (0-100, independent of news)
4. News score: implied news sentiment from price action and volume patterns (0-100)
5. Target price (if applicable)
6. Clear reasoning for your recommendation
7. Key indicators that support your decision

Format your response as JSON:
{
  "action": "buy|sell|hold",
  "confidence": 75,
  "themeScore": 60,
  "newsScore": 55,
  "targetPrice": 50000,
  "reasoning": "detailed explanation",
  "indicators": {
    "trend": "bullish|bearish|neutral",
    "momentum": "strong|weak|neutral",
    "support": 45000,
    "resistance": 55000
  }
}`;

    const response = await this.createJsonCompletion(
      [
        {
          role: 'system',
          content: 'You are an expert stock trading analyst with deep knowledge of Korean stock market (KOSPI/KOSDAQ). Provide precise, actionable trading advice based on technical analysis.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      { model, temperature: 0.3 }
    );
    
    const clamp = (v: unknown) => Math.min(100, Math.max(0, Number(v) || 50));
    return {
      action: (['buy', 'sell', 'hold'].includes(response.action) ? response.action : 'hold') as 'buy' | 'sell' | 'hold',
      confidence: clamp(response.confidence),
      themeScore: clamp(response.themeScore),
      newsScore: clamp(response.newsScore),
      targetPrice: typeof response.targetPrice === 'number' ? response.targetPrice : null,
      reasoning: response.reasoning || 'Analysis pending',
      indicators: response.indicators || {},
    };
  }

  // ==================== Portfolio Analysis ====================

  async analyzePortfolio(request: PortfolioAnalysisRequest, model: string = 'gpt-5.1'): Promise<PortfolioAnalysisResponse> {
    const portfolioSummary = request.holdings.map(h => ({
      code: h.stockCode,
      name: h.stockName,
      quantity: h.quantity,
      avgPrice: h.averagePrice,
      currentPrice: h.currentPrice,
      profitLoss: h.profitLoss,
      profitLossRate: h.profitLossRate,
    }));

    const prompt = `You are a professional portfolio manager. Analyze this investment portfolio and provide optimization recommendations.

Portfolio Holdings:
${JSON.stringify(portfolioSummary, null, 2)}

Investment Profile:
- Risk Level: ${request.riskLevel}
- Investment Goal: ${request.investmentGoal}

Provide:
1. Individual stock recommendations (buy more, sell, hold)
2. Overall portfolio strategy
3. Risk assessment
4. Diversification suggestions

Format as JSON:
{
  "recommendations": [
    {
      "stockCode": "005930",
      "stockName": "삼성전자",
      "action": "hold",
      "reason": "strong fundamentals"
    }
  ],
  "overallStrategy": "strategy description",
  "riskAssessment": "risk analysis"
}`;

    const response = await this.createJsonCompletion(
      [
        {
          role: 'system',
          content: 'You are an expert portfolio manager specializing in Korean stock market investments. Provide comprehensive portfolio analysis and optimization strategies.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      { model, temperature: 0.4 }
    );
    
    return {
      recommendations: response.recommendations || [],
      overallStrategy: response.overallStrategy || '',
      riskAssessment: response.riskAssessment || '',
    };
  }

  // ==================== Trading Strategy Generation ====================

  async generateTradingStrategy(request: TradingStrategyRequest, model: string = 'gpt-5.1'): Promise<TradingStrategyResponse> {
    const prompt = `You are an algorithmic trading expert. Create a detailed trading strategy.

Strategy Type: ${request.modelType}
Parameters: ${JSON.stringify(request.parameters)}
${request.backtestData ? `Historical Performance: ${JSON.stringify(request.backtestData)}` : ''}

Generate a comprehensive trading strategy including:
1. Overall strategy description
2. Entry conditions (when to buy)
3. Exit conditions (when to sell)
4. Risk management rules
5. Expected performance metrics

Format as JSON:
{
  "strategy": "detailed strategy description",
  "entryConditions": ["condition 1", "condition 2"],
  "exitConditions": ["condition 1", "condition 2"],
  "riskManagement": "risk management approach",
  "expectedPerformance": {
    "winRate": 60,
    "profitFactor": 1.8,
    "maxDrawdown": 15
  }
}`;

    const response = await this.createJsonCompletion(
      [
        {
          role: 'system',
          content: 'You are an expert in algorithmic trading and quantitative strategies. Create robust, profitable trading systems.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      { model, temperature: 0.5 }
    );
    
    return {
      strategy: response.strategy || '',
      entryConditions: response.entryConditions || [],
      exitConditions: response.exitConditions || [],
      riskManagement: response.riskManagement || '',
      expectedPerformance: response.expectedPerformance || {},
    };
  }

  // ==================== Market Sentiment Analysis ====================

  async analyzeMarketSentiment(marketData: any, model: string = 'gpt-5.1'): Promise<any> {
    const prompt = `Analyze the current market sentiment based on the following data:

${JSON.stringify(marketData, null, 2)}

Provide:
1. Overall market sentiment (bullish/bearish/neutral)
2. Key factors influencing the market
3. Short-term outlook (1-2 weeks)
4. Recommended sectors to watch

Format as JSON.`;

    return await this.createJsonCompletion(
      [
        {
          role: 'system',
          content: 'You are a market sentiment analyst with expertise in Korean stock markets.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      { model, temperature: 0.4 }
    );
  }

  // ==================== Trading Signal Generation ====================

  async generateTradingSignals(
    aiModel: AiModel,
    marketData: any[],
    model: string = 'gpt-5.1'
  ): Promise<Array<{ stockCode: string; stockName: string; action: string; confidence: number; reasoning: string }>> {
    const prompt = `You are an AI trading model: ${aiModel.modelName}
Model Type: ${aiModel.modelType}
Configuration: ${JSON.stringify(aiModel.config)}

Current Market Data:
${JSON.stringify(marketData.slice(0, 20), null, 2)}

Generate trading signals for stocks that meet your criteria. For each signal, provide:
- Stock code
- Stock name
- Action (buy/sell)
- Confidence (0-100)
- Reasoning

Return as JSON array of signals.`;

    const response = await this.createJsonCompletion(
      [
        {
          role: 'system',
          content: 'You are an automated trading signal generator. Identify high-probability trading opportunities.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      { model, temperature: 0.3 }
    );
    
    return response.signals || [];
  }

  // ==================== Backtesting Analysis ====================

  async analyzeBacktest(backtestResults: any, model: string = 'gpt-5.1'): Promise<any> {
    const prompt = `Analyze these backtesting results and provide insights:

${JSON.stringify(backtestResults, null, 2)}

Provide:
1. Performance summary
2. Strengths of the strategy
3. Weaknesses and risks
4. Optimization suggestions

Format as JSON.`;

    return await this.createJsonCompletion(
      [
        {
          role: 'system',
          content: 'You are a quantitative analyst expert in strategy backtesting and optimization.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      { model, temperature: 0.4 }
    );
  }

  // ==================== 통합 분석 (뉴스 + 재무제표 + 기술적 분석) ====================

  async integratedAnalysis(params: {
    stockCode: string;
    stockName: string;
    currentPrice: number;
    financialRatios?: { per: string; pbr: string; eps: string; bps: string; roe: string };
    priceHistory?: Array<{ date: string; price: number; volume: number }>;
    news?: NewsResult;
    dartFilings?: Array<{ reportNm: string; rceptDt: string }>;
    model?: string;
  }): Promise<{
    newsScore: number;
    financialScore: number;
    technicalScore: number;
    totalScore: number;
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    targetPrice: number | null;
    newsSentiment: 'positive' | 'negative' | 'neutral';
    newsAnalysis: string;
    financialAnalysis: string;
    technicalAnalysis: string;
    summary: string;
    risks: string[];
    catalysts: string[];
  }> {
    const { stockCode, stockName, currentPrice, financialRatios, priceHistory, news, dartFilings, model = 'gpt-5.1' } = params;

    const newsSummary = news?.articles?.length
      ? buildNewsSummary(news)
      : '관련 뉴스 없음';

    const financialSummary = financialRatios
      ? `PER: ${financialRatios.per}, PBR: ${financialRatios.pbr}, EPS: ${financialRatios.eps}원, BPS: ${financialRatios.bps}원, ROE: ${financialRatios.roe}%`
      : '재무 데이터 없음';

    const priceSummary = priceHistory?.length
      ? `최근 ${priceHistory.length}일 가격 데이터 (최신순): ${priceHistory.slice(0, 10).map(p => `${p.date}: ₩${p.price.toLocaleString()} (거래량 ${p.volume.toLocaleString()})`).join(', ')}`
      : '가격 이력 없음';

    const dartSummary = dartFilings?.length
      ? `최근 공시 ${dartFilings.length}건:\n${dartFilings.slice(0, 10).map((f, i) => `${i + 1}. [${f.rceptDt}] ${f.reportNm}`).join('\n')}`
      : '최근 공시 없음';

    const prompt = `당신은 한국 주식시장 전문 애널리스트입니다. 아래 데이터를 종합 분석하여 투자 의견을 제시하세요.

종목 정보:
- 종목코드: ${stockCode}
- 종목명: ${stockName}
- 현재가: ₩${currentPrice.toLocaleString()}

재무지표:
${financialSummary}

최근 뉴스 (감성분석 포함):
${newsSummary}

DART 전자공시 (금감원 공시시스템):
${dartSummary}

가격 흐름:
${priceSummary}

다음 항목을 포함한 JSON을 반환하세요:
{
  "newsScore": 0-100 (뉴스 감성 점수: 긍정일수록 높음),
  "financialScore": 0-100 (재무건전성 점수),
  "technicalScore": 0-100 (기술적 흐름 점수),
  "totalScore": 0-100 (가중 평균 종합 점수),
  "action": "buy|sell|hold",
  "confidence": 0-100,
  "targetPrice": 목표주가(숫자) 또는 null,
  "newsSentiment": "positive|negative|neutral",
  "newsAnalysis": "뉴스 분석 요약 (2-3문장, 한국어)",
  "financialAnalysis": "재무 분석 요약 (2-3문장, 한국어)",
  "technicalAnalysis": "기술적 분석 요약 (2-3문장, 한국어)",
  "summary": "종합 투자 의견 (3-4문장, 한국어)",
  "risks": ["리스크1", "리스크2", "리스크3"],
  "catalysts": ["촉매1", "촉매2", "촉매3"]
}`;

    const result = await this.createJsonCompletion(
      [
        { role: 'system', content: '당신은 한국 주식 전문 애널리스트로, 뉴스·재무·기술적 분석을 통합하여 정확한 투자 판단을 내립니다.' },
        { role: 'user', content: prompt },
      ],
      { model, temperature: 0.3 }
    );

    return {
      newsScore:       clamp(result.newsScore ?? 50),
      financialScore:  clamp(result.financialScore ?? 50),
      technicalScore:  clamp(result.technicalScore ?? 50),
      totalScore:      clamp(result.totalScore ?? 50),
      action:          ['buy', 'sell', 'hold'].includes(result.action) ? result.action : 'hold',
      confidence:      clamp(result.confidence ?? 50),
      targetPrice:     typeof result.targetPrice === 'number' ? result.targetPrice : null,
      newsSentiment:   ['positive', 'negative', 'neutral'].includes(result.newsSentiment) ? result.newsSentiment : 'neutral',
      newsAnalysis:    result.newsAnalysis || '',
      financialAnalysis: result.financialAnalysis || '',
      technicalAnalysis: result.technicalAnalysis || '',
      summary:         result.summary || '',
      risks:           Array.isArray(result.risks) ? result.risks : [],
      catalysts:       Array.isArray(result.catalysts) ? result.catalysts : [],
    };
  }

  // ==================== Auto-Trading Entry/Position Decisions ====================

  async decideEntryPolicy(params: {
    stock: { code: string; name: string; price: number };
    scorecard: Record<string, number>;
    currentLine: number;
    modelType: string;
    settings: {
      baseUnitSize?: number | null;
      maxUnitsPerStock?: number | null;
      aiEntryPolicy?: any;
      entryLadderSettings?: any;
      allowAiDoubleDown?: boolean | null;
    };
    recentNews?: string;
  }, aiModel: string = 'gpt-5.1'): Promise<{
    accepted: boolean;
    rejectReason?: string;
    candidateClass?: string;
    initialLine: number;
    ladderPlan: { line: number; units: number }[];
    maxUnits: number;
    holdStrategy: string;
    reasoning: string;
  }> {
    const { stock, scorecard, currentLine, modelType, settings } = params;
    const maxUnitsPerStock = settings.maxUnitsPerStock ?? 5;
    // 라더: 50%(초록 CL 첫 진입) → 더 하락 시 추가매수 (60, 70, 80%)
    const ladderLines = [50, 60, 70, 80];

    const prompt = `당신은 한국 주식 자동매매 시스템의 진입 결정 AI입니다.

【레인보우 CL 시스템 — 반드시 숙지】
숫자는 240일 고점 대비 하락률. 숫자가 클수록 더 많이 하락(더 저렴).
- 10~30%: 🔴 고점 근처(빨강/주황) = 비쌈 → 매수 절대 금지
- 40~49%: 🟡 주의구간 → 진입 불가
- 50%: 🟢 초록 CL = 첫 매수 타점 (조건검색으로 걸러진 종목은 이 구간)
- 60~80%: 🔵 파랑/남색 = 추가 매수 구간 (더 하락할수록 추가매수)
- 90%+: ⚫ 극단 하락 → 관망

종목 정보:
- 코드: ${stock.code}, 이름: ${stock.name}, 현재가: ${stock.price.toLocaleString()}원
- 현재 CL 위치: ${currentLine}% → ${currentLine <= 30 ? '🔴 매수금지(고점)' : currentLine <= 49 ? '🟡 진입불가' : currentLine <= 55 ? '🟢 초록CL(첫매수)' : currentLine <= 80 ? '🔵 파랑(추가매수)' : '⚫ 극단(관망)'}
- 모델 유형: ${modelType}

후보 점수카드:
${JSON.stringify(scorecard, null, 2)}

${params.recentNews ? `최근 뉴스 요약:\n${params.recentNews}\n` : ''}
설정:
- 최대 보유 유닛: ${maxUnitsPerStock}
- 라더 진입 가능 라인: ${ladderLines.join(', ')}% (50%서 첫 진입, 더 하락 시 추가매수)
- AI 추가매수 허용: ${settings.allowAiDoubleDown ?? false}
- 커스텀 진입 설정: ${JSON.stringify(settings.aiEntryPolicy ?? {})}

판단 기준:
- currentLine >= 50(초록 CL 이상 하락)이고 totalScore >= 60일 때만 accepted=true
- currentLine < 50(고점 근처)이면 반드시 accepted=false
- 라더 계획은 현재선(${currentLine})에서 시작, 더 높은 % 라인(더 하락 시)에 추가 배정
- 기본 라인당 1유닛, allowAiDoubleDown=true이면 특정 라인에 2유닛 가능
- 총 유닛 합계 <= maxUnitsPerStock 강제

아래 JSON 형식으로만 응답하세요:
{
  "accepted": true/false,
  "rejectReason": "거부 이유 (accepted=false일 때만)",
  "candidateClass": "momentum_leader / quality_growth / speculative / avoid",
  "initialLine": 현재 진입할 라인 번호 (50/60/70/80 중 하나),
  "ladderPlan": [{"line": 50, "units": 1}, {"line": 60, "units": 1}, ...],
  "maxUnits": 총 계획 유닛,
  "holdStrategy": "target_exit / trend_hold / partial_exit / aggressive_cut",
  "reasoning": "한 줄 판단 근거"
}`;

    const result = await this.createJsonCompletion([
      { role: 'system', content: '당신은 한국 주식 자동매매 AI입니다. 반드시 JSON만 응답합니다.' },
      { role: 'user', content: prompt },
    ], { model: aiModel, temperature: 0.2 });

    return {
      accepted: result.accepted ?? false,
      rejectReason: result.rejectReason,
      candidateClass: result.candidateClass,
      initialLine: result.initialLine ?? currentLine,
      ladderPlan: Array.isArray(result.ladderPlan) ? result.ladderPlan : [],
      maxUnits: result.maxUnits ?? 1,
      holdStrategy: result.holdStrategy ?? 'target_exit',
      reasoning: result.reasoning ?? '',
    };
  }

  async decidePositionManagement(params: {
    stock: { code: string; name: string; price: number };
    currentLine: number;
    performance: {
      entryPrice: number;
      quantity: number;
      filledUnits?: number | null;
      maxUnitsReached?: number | null;
      entryLadderPlan?: any;
      filledEntrySteps?: any;
      holdDecisionSnapshots?: any;
      plannedExitPolicy?: any;
    };
    holdingDays: number;
    modelType: string;
    settings: {
      maxUnitsPerStock?: number | null;
      stopLossPolicy?: any;
      aiExitPolicy?: any;
      allowAiPartialTakeProfit?: boolean | null;
      allowAiHoldBeyondTarget?: boolean | null;
    };
  }, aiModel: string = 'gpt-5.1'): Promise<{
    action: 'hold' | 'scale_in' | 'partial_exit' | 'full_exit' | 'stop_loss';
    unitsToAdd?: number;
    unitsToSell?: number;
    reasoning: string;
  }> {
    const { stock, currentLine, performance, holdingDays, modelType, settings } = params;
    const pnlPct = ((stock.price - performance.entryPrice) / performance.entryPrice * 100).toFixed(1);
    const stopLossMode = settings.stopLossPolicy?.mode ?? 'soft_ai_first';

    const prompt = `당신은 보유 포지션을 관리하는 한국 주식 자동매매 AI입니다.

【레인보우 CL 시스템 — 반드시 숙지】
숫자는 240일 고점 대비 하락률. 숫자가 클수록 더 많이 하락(더 저렴).
- 50%: 🟢 초록 CL = 최초 진입 타점
- 60~80%: 🔵 파랑/남색 = 추가 매수(scale_in) 구간, 더 떨어질수록 평단 낮춤
- 40% 이하: 🟡🔴 주가가 회복된 상태 = 익절(partial/full_exit) 고려 구간
- 90%+: ⚫ 극단 하락 = 손절(stop_loss) 고려

보유 종목:
- 코드: ${stock.code}, 이름: ${stock.name}
- 현재가: ${stock.price.toLocaleString()}원, 진입가: ${performance.entryPrice.toLocaleString()}원
- 현재 수익률: ${pnlPct}%
- 현재 CL 위치: ${currentLine}% → ${currentLine <= 40 ? '🟡 회복구간(익절 고려)' : currentLine <= 55 ? '🟢 초록CL' : currentLine <= 80 ? '🔵 파랑(추가매수 구간)' : '⚫ 극단(손절 고려)'}
- 보유 기간: ${holdingDays}일
- 현재 보유 유닛: ${performance.filledUnits ?? 1} / 최대 ${settings.maxUnitsPerStock ?? 5}
- 라더 계획: ${JSON.stringify(performance.entryLadderPlan ?? [])}
- 체결된 스텝: ${JSON.stringify(performance.filledEntrySteps ?? [])}
- 이전 보유판단 이력: ${JSON.stringify(performance.holdDecisionSnapshots ?? [])}
- 계획된 청산 정책: ${JSON.stringify(performance.plannedExitPolicy ?? {})}
- 손절 모드: ${stopLossMode} (disabled=손절없음, soft_ai_first=AI우선, conditional=조건부, hard=강제)
- 모델 유형: ${modelType}
- AI 부분익절 허용: ${settings.allowAiPartialTakeProfit ?? false}
- AI 목표초과 보유 허용: ${settings.allowAiHoldBeyondTarget ?? false}

판단 원칙:
- scale_in: CL이 60~80%(파랑 구간) 도달 + 라더 미체결 스텝 존재 + 총유닛 < maxUnits일 때만 가능
- partial_exit: CL이 40% 이하(회복)이고 allowAiPartialTakeProfit=true일 때 가능
- full_exit: CL이 30% 이하(충분히 회복)이거나 모멘텀 소진 판단 시
- stop_loss: stopLossMode=disabled이면 절대 불가, hard이면 손실 >= 7% 시 강제
- CL이 50~55%(초록 부근)이면 기본적으로 hold

아래 JSON 형식으로만 응답하세요:
{
  "action": "hold/scale_in/partial_exit/full_exit/stop_loss",
  "unitsToAdd": 추가할 유닛 수 (scale_in일 때),
  "unitsToSell": 매도할 유닛 수 (partial_exit일 때),
  "reasoning": "한 줄 판단 근거"
}`;

    const result = await this.createJsonCompletion([
      { role: 'system', content: '당신은 한국 주식 자동매매 AI입니다. 반드시 JSON만 응답합니다.' },
      { role: 'user', content: prompt },
    ], { model: aiModel, temperature: 0.2 });

    return {
      action: result.action ?? 'hold',
      unitsToAdd: result.unitsToAdd,
      unitsToSell: result.unitsToSell,
      reasoning: result.reasoning ?? '',
    };
  }

  async suggestStrategyEvolution(params: {
    modelType: string;
    stats: {
      totalTrades: number;
      winRate: number;
      avgReturn: number;
      maxDrawdown: number;
    };
    linePerformance: { line: number; total: number; winRate: number; avgReturn: number; expectancy: number }[];
    unitPerformance: { units: number; total: number; winRate: number; avgReturn: number }[];
    currentLadder: { line: number; units: number }[];
    currentStopLossMode: string;
  }, aiModel: string = 'gpt-5.1'): Promise<{
    suggestedLadder: { line: number; units: number }[];
    suggestedStopLossMode: string;
    suggestedMaxUnits: number;
    candidateThresholdAdjust: { minTotalScore?: number; minVolumeScore?: number };
    reasoning: string;
  }> {
    const { stats, linePerformance, unitPerformance, currentLadder, currentStopLossMode, modelType } = params;

    const prompt = `당신은 한국 주식 자동매매 전략 개선 AI입니다.

모델 유형: ${modelType}
성과 통계:
- 총 거래: ${stats.totalTrades}건
- 승률: ${stats.winRate.toFixed(1)}%
- 평균 수익률: ${stats.avgReturn.toFixed(2)}%
- 최대 낙폭: ${stats.maxDrawdown.toFixed(1)}%

라인별 성과:
${linePerformance.map(p => `  ${p.line}%라인: ${p.total}건, 승률${p.winRate.toFixed(0)}%, 기대값${p.expectancy.toFixed(2)}%`).join('\n')}

유닛별 성과:
${unitPerformance.map(p => `  ${p.units}유닛: ${p.total}건, 승률${p.winRate.toFixed(0)}%, 평균수익${p.avgReturn.toFixed(2)}%`).join('\n')}

현재 라더 계획: ${JSON.stringify(currentLadder)}
현재 손절 모드: ${currentStopLossMode}

위 데이터를 분석해서 전략을 개선하세요.
- 기대값(expectancy)이 마이너스인 라인은 units=0으로
- 2유닛 성과가 1유닛보다 확실히 좋으면 해당 라인 units=2 제안
- 승률과 낙폭을 고려해 손절 모드 추천
- candidateThresholdAdjust는 minTotalScore 조정 (±5~10 수준)

JSON으로만 응답:
{
  "suggestedLadder": [{"line": 50, "units": 1}, ...],
  "suggestedStopLossMode": "disabled/soft_ai_first/conditional/hard",
  "suggestedMaxUnits": 숫자,
  "candidateThresholdAdjust": {"minTotalScore": 숫자},
  "reasoning": "한 줄 개선 근거"
}`;

    const result = await this.createJsonCompletion([
      { role: 'system', content: '당신은 한국 주식 자동매매 전략 개선 AI입니다. 반드시 JSON만 응답합니다.' },
      { role: 'user', content: prompt },
    ], { model: aiModel, temperature: 0.3 });

    return {
      suggestedLadder: Array.isArray(result.suggestedLadder) ? result.suggestedLadder : currentLadder,
      suggestedStopLossMode: result.suggestedStopLossMode ?? currentStopLossMode,
      suggestedMaxUnits: result.suggestedMaxUnits ?? 5,
      candidateThresholdAdjust: result.candidateThresholdAdjust ?? {},
      reasoning: result.reasoning ?? '',
    };
  }
}

// ─── 내부 헬퍼 ─────────────────────────────────────────────────────────────
function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function buildNewsSummary(news: NewsResult): string {
  const positive = news.articles.filter(a => a.sentiment === 'positive').length;
  const negative = news.articles.filter(a => a.sentiment === 'negative').length;
  const lines = news.articles.slice(0, 8).map((a, i) =>
    `${i + 1}. [${a.sentiment.toUpperCase()}] ${a.title} — ${a.description?.slice(0, 100) || ''}`
  );
  return `긍정 ${positive}건 / 부정 ${negative}건 / 중립 ${news.articles.length - positive - negative}건\n${lines.join('\n')}`;
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    aiServiceInstance = new AIService(apiKey);
  }

  return aiServiceInstance;
}
