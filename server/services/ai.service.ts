// ai.service.ts — OpenAI GPT-4 기반 주식 분석, 포트폴리오 최적화, AI 모델 추천 생성 서비스
import OpenAI from 'openai';
import type { AiModel, Holding, Order } from '@shared/schema';
import type { NewsResult } from './news.service';
import { RainbowChartAnalyzer, type OHLCVData, type RainbowChartResult } from '../formula/rainbow-chart';
import { storage } from '../storage';

export class AiBudgetExceededError extends Error {
  constructor(monthlyTotal: number, budget: number) {
    super(`AI 예산 초과: 이번 달 $${monthlyTotal.toFixed(2)} / 한도 $${budget.toFixed(2)}`);
    this.name = 'AiBudgetExceededError';
  }
}

type AiUsageContext = {
  userId: string;
  accountId?: number | null;
  source?: string;
};

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
  private readonly defaultPricingPer1m: Record<string, { input: number; output: number }> = {
    'gpt-5.5': { input: 5.0, output: 30.0 },
    'gpt-5.4': { input: 2.5, output: 15.0 },
    'gpt-5.4-mini': { input: 0.75, output: 4.5 },
    'gpt-5.1': { input: 1.25, output: 10.0 },
    'gpt-5.1-chat-latest': { input: 1.25, output: 10.0 },
    'gpt-5-mini': { input: 0.25, output: 2.0 },
    'gpt-4.1': { input: 2.0, output: 8.0 },
    'gpt-4o': { input: 2.5, output: 10.0 },
  };
  private pricingCache = new Map<string, { input: number; output: number }>();
  private pricingCacheLoadedAt = 0;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  // ==================== Helper Methods ====================

  private getUsageDateKst(): string {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private async loadPricingCacheIfNeeded(): Promise<void> {
    const now = Date.now();
    if (this.pricingCacheLoadedAt > 0 && now - this.pricingCacheLoadedAt < 10 * 60 * 1000) {
      return;
    }

    this.pricingCache = new Map(Object.entries(this.defaultPricingPer1m));
    try {
      const specs = await storage.getAiModelSpecs(false);
      for (const spec of specs) {
        const input = Number(spec.inputCostPer1m ?? 0);
        const output = Number(spec.outputCostPer1m ?? 0);
        if (!spec.modelId || (!Number.isFinite(input) && !Number.isFinite(output))) continue;
        this.pricingCache.set(spec.modelId, {
          input: Number.isFinite(input) ? input : 0,
          output: Number.isFinite(output) ? output : 0,
        });
      }
    } catch (error: any) {
      console.warn('[AIService] model pricing cache load failed:', error?.message || error);
    } finally {
      this.pricingCacheLoadedAt = now;
    }
  }

  private async estimateUsageCostUsd(model: string, promptTokens: number, completionTokens: number): Promise<number> {
    await this.loadPricingCacheIfNeeded();
    const pricing = this.pricingCache.get(model) ?? this.defaultPricingPer1m[model];
    if (!pricing) return 0;
    const inputCost = (promptTokens / 1_000_000) * pricing.input;
    const outputCost = (completionTokens / 1_000_000) * pricing.output;
    return Number((inputCost + outputCost).toFixed(8));
  }

  private async recordUsageFromCompletion(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    model: string,
    usageContext?: AiUsageContext,
  ): Promise<void> {
    if (!usageContext?.userId) return;
    const promptTokens = Number(completion.usage?.prompt_tokens ?? 0);
    const completionTokens = Number(completion.usage?.completion_tokens ?? 0);
    const totalTokens = Number(completion.usage?.total_tokens ?? (promptTokens + completionTokens));
    const costUsd = await this.estimateUsageCostUsd(model, promptTokens, completionTokens);

    await storage.recordAiUsageDaily({
      userId: usageContext.userId,
      accountId: usageContext.accountId ?? null,
      usageDate: this.getUsageDateKst(),
      requestCount: 1,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
    });

    // 예산 체크 및 알림 로직 추가
    try {
      const budgetStr = await storage.getSystemConfig("ai_budget_usd");
      const budget = budgetStr ? parseFloat(budgetStr) : 0;
      
      if (budget > 0) {
        // 이번 달 총 비용 계산 (서버 부하 방지를 위해 매번 계산하는 대신 storage 메소드 활용 가능성 확인)
        const now = new Date();
        const fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const toDate = this.getUsageDateKst();
        
        const usageRows = await storage.getAiUsageDaily(usageContext.userId, { fromDate, toDate, scopeType: 'login' });
        const monthlyTotal = usageRows.reduce((sum, r) => sum + parseFloat(r.costUsd || "0"), 0);

        if (monthlyTotal >= budget) {
          // 예산 초과 알림 (중복 방지: 마지막 알림 시간 체크 등은 storage가 담당하거나 여기서 간단히 처리)
          await storage.createEngineNotification({
            userId: usageContext.userId,
            severity: 'warn',
            type: 'AI_BUDGET_EXCEEDED',
            message: `이번 달 AI 사용 비용($${monthlyTotal.toFixed(2)})이 설정된 예산($${budget.toFixed(2)})을 초과했습니다.`,
            payload: { monthlyTotal, budget },
          });
        }
      }
    } catch (budgetErr: any) {
      console.warn('[AIService] Budget check failed:', budgetErr?.message);
    }
  }

  private async checkBudgetBeforeCall(usageContext?: AiUsageContext): Promise<void> {
    if (!usageContext?.userId) return;
    try {
      const [budgetStr, blockStr] = await Promise.all([
        storage.getSystemConfig('ai_budget_usd'),
        storage.getSystemConfig('ai_budget_block'),
      ]);
      const budget = budgetStr ? parseFloat(budgetStr) : 0;
      const blockOnExceed = blockStr === 'true';
      if (budget <= 0 || !blockOnExceed) return;

      const now = new Date();
      const fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const usageRows = await storage.getAiUsageDaily(usageContext.userId, { fromDate, toDate: this.getUsageDateKst(), scopeType: 'login' });
      const monthlyTotal = usageRows.reduce((s, r) => s + parseFloat(r.costUsd || '0'), 0);
      if (monthlyTotal >= budget) {
        throw new AiBudgetExceededError(monthlyTotal, budget);
      }
    } catch (err) {
      if (err instanceof AiBudgetExceededError) throw err;
      console.warn('[AIService] Budget pre-check failed:', (err as any)?.message);
    }
  }

  private async createJsonCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: {
      model?: string;
      temperature?: number;
      usageContext?: AiUsageContext;
    } = {}
  ): Promise<any> {
    const { model = 'gpt-5-mini', temperature = 0.3, usageContext } = options;
    await this.checkBudgetBeforeCall(usageContext);

    // Reasoning models (o1, o3, o4-*, gpt-5-*) only support default temperature (1)
    const isReasoningModel = /^(o\d|gpt-5)/.test(model);
    const effectiveTemperature = isReasoningModel ? undefined : temperature;

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const completion = await this.openai.chat.completions.create({
          model,
          messages,
          ...(effectiveTemperature !== undefined && { temperature: effectiveTemperature }),
          response_format: { type: 'json_object' },
        });

        try {
          await this.recordUsageFromCompletion(completion, model, usageContext);
        } catch (recordError: any) {
          console.warn('[AIService] usage record failed:', recordError?.message || recordError);
        }

        return JSON.parse(completion.choices[0].message.content || '{}');
      } catch (error: any) {
        const status = error?.status ?? error?.response?.status;
        if (status === 429 && attempt < maxRetries - 1) {
          const waitMs = (attempt + 1) * 10000; // 10s, 20s
          console.warn(`[AIService] 429 rate limit — ${waitMs / 1000}초 후 재시도 (${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        console.error(`AI completion failed (model: ${model}):`, error);
        throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  // ==================== Stock Analysis ====================

  async analyzeStock(
    request: StockAnalysisRequest,
    model: string = 'gpt-5-mini',
    usageContext?: AiUsageContext,
    systemMessage?: string,
  ): Promise<StockAnalysisResponse> {
    const prompt = `당신은 한국 주식시장 전문 트레이딩 애널리스트입니다. 아래 종목을 분석해 실행 가능한 매매 의견을 제시하세요.

종목 정보:
- 코드: ${request.stockCode}
- 종목명: ${request.stockName}
- 현재가: ₩${request.currentPrice.toLocaleString()}
${request.priceHistory ? `- 최근 가격 데이터: ${JSON.stringify(request.priceHistory.slice(0, 30))}` : ''}
${request.technicalIndicators ? `- 기술 지표: ${JSON.stringify(request.technicalIndicators)}` : ''}
${request.rainbowChart ? `
레인보우 차트 분석 (240일 범위):
- 240일 고점: ₩${request.rainbowChart.highest.toLocaleString()}
- 240일 저점: ₩${request.rainbowChart.lowest.toLocaleString()}
- 현재 위치: ${request.rainbowChart.currentPosition.toFixed(1)}%
- 현재 구간: ${request.rainbowChart.currentZone}
- 차트 추천: ${request.rainbowChart.recommendation.toUpperCase()}
- CL (50% 기준선): ₩${request.rainbowChart.CL.toLocaleString()}
- CL 폭: ${request.rainbowChart.clWidth.toFixed(1)}%
- 현재가 vs CL: ${((request.currentPrice / request.rainbowChart.CL - 1) * 100).toFixed(2)}%
` : ''}

아래 항목을 기반으로 판단하세요:
1. 권장 액션: BUY / SELL / HOLD
2. 신뢰도: 0~100
3. 테마 점수(themeScore): 섹터/테마 모멘텀 강도 0~100 (뉴스와 독립)
4. 뉴스 점수(newsScore): 가격/거래량 흐름에서 추정한 뉴스 심리 0~100
5. 목표가(가능한 경우)
6. 추천 근거
7. 핵심 지표

반드시 아래 JSON 형식으로만 응답하세요:
{
  "action": "buy|sell|hold",
  "confidence": 75,
  "themeScore": 60,
  "newsScore": 55,
  "targetPrice": 50000,
  "reasoning": "반드시 한국어 설명",
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
          content: systemMessage ?? '당신은 KOSPI/KOSDAQ에 정통한 한국 주식 트레이딩 전문가입니다. 반드시 한국어로, 구체적이고 실행 가능한 매매 조언을 JSON 형식으로만 제공합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      { model, temperature: 0.3, usageContext }
    );
    
    const clamp = (v: unknown) => Math.min(100, Math.max(0, Number(v) || 50));
    return {
      action: (['buy', 'sell', 'hold'].includes(response.action) ? response.action : 'hold') as 'buy' | 'sell' | 'hold',
      confidence: clamp(response.confidence),
      themeScore: clamp(response.themeScore),
      newsScore: clamp(response.newsScore),
      targetPrice: typeof response.targetPrice === 'number' ? response.targetPrice : null,
      reasoning: response.reasoning || '분석 결과가 충분하지 않습니다.',
      indicators: response.indicators || {},
    };
  }

  // ==================== Portfolio Analysis ====================

  async analyzePortfolio(
    request: PortfolioAnalysisRequest,
    model: string = 'gpt-5-mini',
    usageContext?: AiUsageContext,
  ): Promise<PortfolioAnalysisResponse> {
    const portfolioSummary = request.holdings.map(h => ({
      code: h.stockCode,
      name: h.stockName,
      quantity: h.quantity,
      avgPrice: h.averagePrice,
      currentPrice: h.currentPrice,
      profitLoss: h.profitLoss,
      profitLossRate: h.profitLossRate,
    }));

    const prompt = `당신은 한국 주식 포트폴리오 전문 운용역입니다. 아래 포트폴리오를 분석해 최적화 전략을 제시하세요.

포트폴리오 보유 현황:
${JSON.stringify(portfolioSummary, null, 2)}

투자자 프로필:
- 위험 성향: ${request.riskLevel}
- 투자 목표: ${request.investmentGoal}

아래를 반드시 포함하세요:
1. 종목별 액션 제안(추가매수/매도/보유)
2. 전체 포트폴리오 전략
3. 리스크 평가
4. 분산/리밸런싱 제안

반드시 아래 JSON 형식으로만 응답하세요:
{
  "recommendations": [
    {
      "stockCode": "005930",
      "stockName": "삼성전자",
      "action": "hold",
      "reason": "반드시 한국어 근거"
    }
  ],
  "overallStrategy": "반드시 한국어",
  "riskAssessment": "반드시 한국어"
}`;

    const response = await this.createJsonCompletion(
      [
        {
          role: 'system',
          content: '당신은 한국 주식시장 전문 포트폴리오 매니저입니다. 결과는 반드시 한국어로 작성하고, JSON 스키마를 엄격히 지킵니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      { model, temperature: 0.4, usageContext }
    );
    
    return {
      recommendations: response.recommendations || [],
      overallStrategy: response.overallStrategy || '',
      riskAssessment: response.riskAssessment || '',
    };
  }

  // ==================== Trading Strategy Generation ====================

  async generateTradingStrategy(
    request: TradingStrategyRequest,
    model: string = 'gpt-5-mini',
    usageContext?: AiUsageContext,
  ): Promise<TradingStrategyResponse> {
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
      { model, temperature: 0.5, usageContext }
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

  async analyzeMarketSentiment(
    marketData: any,
    model: string = 'gpt-5-mini',
    usageContext?: AiUsageContext,
  ): Promise<any> {
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
      { model, temperature: 0.4, usageContext }
    );
  }

  // ==================== Trading Signal Generation ====================

  async generateTradingSignals(
    aiModel: AiModel,
    marketData: any[],
    model: string = 'gpt-5-mini',
    usageContext?: AiUsageContext,
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
      { model, temperature: 0.3, usageContext }
    );
    
    return response.signals || [];
  }

  // ==================== Backtesting Analysis ====================

  async analyzeBacktest(
    backtestResults: any,
    model: string = 'gpt-5-mini',
    usageContext?: AiUsageContext,
  ): Promise<any> {
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
      { model, temperature: 0.4, usageContext }
    );
  }

  // ==================== 통합 분석 (뉴스 + 재무제표 + 기술적 분석) ====================

  async integratedAnalysis(params: {
    stockCode: string;
    stockName: string;
    currentPrice: number;
    financialRatios?: { per: string; pbr: string; eps: string; bps: string; roe: string; debt_ratio?: string; reserve_ratio?: string };
    priceHistory?: Array<{ date: string; price: number; volume: number }>;
    news?: NewsResult;
    dartFilings?: Array<{ reportNm: string; rceptDt: string }>;
    rainbowChart?: RainbowChartResult;
    model?: string;
    usageContext?: AiUsageContext;
  }): Promise<{
    newsScore: number;
    financialScore: number;
    technicalScore: number;
    themeScore: number;
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
    const { stockCode, stockName, currentPrice, financialRatios, priceHistory, news, dartFilings, rainbowChart, model = 'gpt-5-mini', usageContext } = params;

    const newsSummary = news?.articles?.length
      ? buildNewsSummary(news)
      : '관련 뉴스 없음';

    const financialSummary = financialRatios
      ? `PER: ${financialRatios.per}, PBR: ${financialRatios.pbr}, EPS: ${financialRatios.eps}원, BPS: ${financialRatios.bps}원, ROE: ${financialRatios.roe}%, 부채비율: ${financialRatios.debt_ratio ?? '0'}%, 유보율: ${financialRatios.reserve_ratio ?? '0'}%`
      : '재무 데이터 없음';

    const priceSummary = priceHistory?.length
      ? `최근 ${priceHistory.length}일 가격 데이터 (최신순): ${priceHistory.slice(0, 10).map(p => `${p.date}: ₩${p.price.toLocaleString()} (거래량 ${p.volume.toLocaleString()})`).join(', ')}`
      : '가격 이력 없음';

    const dartSummary = dartFilings?.length
      ? `최근 공시 ${dartFilings.length}건:\n${dartFilings.slice(0, 10).map((f, i) => `${i + 1}. [${f.rceptDt}] ${f.reportNm}`).join('\n')}`
      : '최근 공시 없음';

    const rainbowSummary = rainbowChart
      ? `레인보우 차트 (240일 범위):
- 240일 고점: ₩${rainbowChart.highest.toLocaleString()} / 저점: ₩${rainbowChart.lowest.toLocaleString()}
- 현재 위치: ${rainbowChart.currentPosition.toFixed(1)}% (0%=저점, 100%=고점)
- 현재 구간: ${rainbowChart.currentZone}
- 차트 추천: ${rainbowChart.recommendation.toUpperCase()}
- CL (50% 기준선): ₩${rainbowChart.CL.toLocaleString()} (현재가 대비 ${((currentPrice / rainbowChart.CL - 1) * 100).toFixed(2)}%)`
      : '레인보우 차트 데이터 없음';

    const prompt = `당신은 한국 주식시장 전문 퀀트 애널리스트입니다. 아래 데이터를 종합 분석하여 자동매매 진입 적합성을 판단하세요.

【판단 맥락】
이 시스템은 "레인보우 CL 라인(240일 고저 중간값)" 근처에서 진입하는 전략입니다.
현재가가 CL(50% 기준선) 근처라는 것은 240일 가격 범위의 중간값이므로, 추가 하락 리스크와 반등 잠재력이 균형 잡힌 구간입니다.

종목 정보:
- 종목코드: ${stockCode} / 종목명: ${stockName} / 현재가: ₩${currentPrice.toLocaleString()}

레인보우 차트 (CL 포지션):
${rainbowSummary}

재무지표 (채점 기준: PER<15→우수/15-25→보통/25+→주의, ROE>15%→우수, PBR<1→저평가):
${financialSummary}

최근 뉴스 (감성분석):
${newsSummary}

DART 전자공시:
${dartSummary}

최근 가격/거래량 흐름:
${priceSummary}

【채점 기준 — 반드시 준수】
- newsScore(0-100): 최근 뉴스 감성. 긍정 뉴스 비율·강도 반영. 뉴스 없으면 50점 기본. 악재(횡령/소송/적자) -30 이상 감점.
- financialScore(0-100): PER/PBR/ROE/EPS/부채비율/유보율 종합. ROE>15%+PER<20 → 70+점. 부채비율>200% → -10점. 유보율>500% → +5점(내부유보 풍부). 재무데이터 없으면 40점(불확실성 반영).
- technicalScore(0-100): 가격 추세·모멘텀. 최근 5일 상승+거래량증가 → 65+. CL 근처 횡보 → 55. 지속 하락 → 30-.
- themeScore(0-100): 섹터/테마 모멘텀. 종목명/업종에서 유추(AI·반도체·바이오·방산·2차전지 등 핫 섹터면 +). 뉴스와 독립 평가.
- confidence(0-100): 위 4개 점수 + 레인보우 차트 추천을 종합한 전반적 확신도. 데이터가 충분하고 긍정 신호 다수면 높게.
- action: 레인보우 recommendation이 buy/strong-buy이고 신뢰도≥60이면 "buy". 악재 多면 "hold"/"sell".

다음 JSON만 반환 (다른 텍스트 금지):
{
  "newsScore": 숫자,
  "financialScore": 숫자,
  "technicalScore": 숫자,
  "themeScore": 숫자,
  "totalScore": 0,
  "action": "buy|sell|hold",
  "confidence": 숫자,
  "targetPrice": 숫자 또는 null,
  "newsSentiment": "positive|negative|neutral",
  "newsAnalysis": "2-3문장 한국어",
  "financialAnalysis": "2-3문장 한국어",
  "technicalAnalysis": "2-3문장 한국어",
  "summary": "3-4문장 한국어 — CL 포지션과 진입 적합성 중심으로",
  "risks": ["구체적 리스크1", "구체적 리스크2"],
  "catalysts": ["구체적 촉매1", "구체적 촉매2"]
}`;

    const result = await this.createJsonCompletion(
      [
        { role: 'system', content: '당신은 한국 주식 전문 애널리스트로, 뉴스·재무·기술적 분석을 통합하여 정확한 투자 판단을 내립니다.' },
        { role: 'user', content: prompt },
      ],
      { model, temperature: 0.3, usageContext }
    );

    return {
      newsScore:       clamp(result.newsScore ?? 50),
      financialScore:  clamp(result.financialScore ?? 50),
      technicalScore:  clamp(result.technicalScore ?? 50),
      themeScore:      clamp(result.themeScore ?? 50),
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
  }, aiModel: string = 'gpt-5-mini', usageContext?: AiUsageContext): Promise<{
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
숫자는 240일 저점~고점 구간에서의 현재 위치(%). 숫자가 클수록 고점 근처(비쌈), 작을수록 저점 근처(저렴).
- 10~30%: 🔵 파랑/남색 = 240일 저점 근처 = 매우 저렴, 추가매수(scale_in) 구간
- 40~55%: 🟢 초록 CL 구간 = 첫 진입 타점 (50%가 CL 기준선)
- 56~80%: 🟡 주의구간 = CL 위 = 비싸짐, 신규 진입 자제
- 85%+: 🔴 고점 근처 → 신규 진입 절대 금지

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
- currentLine 40~55%(초록 CL 구간)이고 totalScore >= 60일 때만 accepted=true
- currentLine >= 70(비싼 구간)이면 반드시 accepted=false
- 라더 계획은 현재선(${currentLine})에서 시작, 더 낮은 % 라인(더 하락 시)에 추가 배정
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
    ], { model: aiModel, temperature: 0.2, usageContext });

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
  }, aiModel: string = 'gpt-5-mini', usageContext?: AiUsageContext): Promise<{
    action: 'hold' | 'scale_in' | 'partial_exit' | 'full_exit' | 'stop_loss';
    unitsToAdd?: number;
    unitsToSell?: number;
    reasoning: string;
  }> {
    const { stock, currentLine, performance, holdingDays, modelType, settings } = params;
    const pnlPct = ((stock.price - performance.entryPrice) / performance.entryPrice * 100).toFixed(1);
    const stopLossMode = settings.stopLossPolicy?.mode ?? 'soft_ai_first';

    const prompt = `당신은 보유 포지션을 관리하는 한국 주식 자동매매 AI입니다.

【레인보우 CL 시스템 — 핵심 구조, 반드시 숙지】
CL(%) = 240일 저점~고점 구간에서 현재가의 위치. 낮을수록 저렴(저점 근처), 높을수록 비쌈(고점 근처).

★ 초(CL/50%) 기준으로 아래/위가 완전히 다른 구간:

【매수 구간 — 초(50%) 미만, 각 라인 도달마다 추가매수 타점】
- 40% = 파(파랑): 추가매수 타점 → scale_in 적극 고려
- 30% = 남(남색): 추가매수 타점 → scale_in 적극 고려
- 20% = 보(보라): 추가매수 타점 → scale_in 적극 고려
- 10% = 연보라: 추가매수 타점 → scale_in 고려

【최초 진입 구간】
- 50% = 초(초록/CL): 최초 매수 타점, 보유 중이면 hold 유지

【매도 구간 — 초(50%) 초과】 ⚠️ 이 구간에서는 절대 매수(scale_in) 금지
- 60% = 노랑: 익절 고려 시작
- 70% = 주황: 익절 적극 고려
- 80% = 빨강: 익절 강력 고려
- 90% = 핑크: 목표 초과, full_exit 강력 권장
- 100% = MAX/흑색: full_exit 필수

보유 종목:
- 코드: ${stock.code}, 이름: ${stock.name}
- 현재가: ${stock.price.toLocaleString()}원, 진입가: ${performance.entryPrice.toLocaleString()}원
- 현재 수익률: ${pnlPct}%
- 현재 CL 위치: ${currentLine}% → ${currentLine <= 10 ? '🟣 연보라(추가매수 타점 — scale_in 고려)' : currentLine <= 20 ? '🟣 보(보라, 추가매수 타점 — scale_in 강력 고려)' : currentLine <= 30 ? '🔵 남(남색, 추가매수 타점 — scale_in 강력 고려)' : currentLine <= 40 ? '🔵 파(파랑, 추가매수 타점 — scale_in 적극 고려)' : currentLine <= 55 ? '🟢 초(초록CL, 최초 진입/보유 구간 — scale_in 불가)' : currentLine <= 70 ? '🟡 노랑/주황(매도 구간 — 절대 매수 금지, 익절 고려)' : currentLine <= 90 ? '🔴 빨강/핑크(매도 구간 — 절대 매수 금지, 익절 강력 고려)' : '⚫ MAX(매도 구간 — full_exit 필수)'}
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
- scale_in: CL이 10~40%(파/남/보/연보라 구간) 도달 + 해당 라인 미체결 스텝 존재 + 총유닛 < maxUnits → scale_in 실행
- hold: CL이 45~55%(초/CL 부근) — 추가매수도 매도도 하지 않음
- partial_exit: CL이 60% 이상(매도 구간)이고 allowAiPartialTakeProfit=true일 때
- full_exit: CL이 75% 이상이거나 모멘텀 소진 판단 시
- stop_loss: stopLossMode=disabled이면 절대 불가, hard이면 손실 >= 7% 시 강제
- ⚠️ CL 50% 초과 구간(노랑~MAX)에서는 scale_in 절대 불가

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
    ], { model: aiModel, temperature: 0.2, usageContext });

    return {
      action: result.action ?? 'hold',
      unitsToAdd: result.unitsToAdd,
      unitsToSell: result.unitsToSell,
      reasoning: result.reasoning ?? '',
    };
  }

  async generateHoldingExitPlan(params: {
    stockCode: string;
    stockName: string;
    averagePrice: number;
    currentPrice: number;
    profitRatePct: number;
    currentRainbowLine: number;
    quantity: number;
    filledEntrySteps: number[];
    holdingDays: number;
  }, aiModel: string = 'gpt-5-mini', usageContext?: AiUsageContext): Promise<{
    exitStages: import('@shared/schema').ExitStage[];
    reasoning: string;
  }> {
    const { stockCode, stockName, averagePrice, currentPrice, profitRatePct, currentRainbowLine, quantity, filledEntrySteps, holdingDays } = params;

    const prompt = `당신은 한국 주식 분할매도 전략을 수립하는 AI입니다.

【레인보우 CL 시스템】
CL(%) = 240일 저점~고점 구간에서 현재가의 위치. 낮을수록 저렴(저점 근처), 높을수록 비쌈(고점 근처).
- 50% 미만: 매수 구간, 50% 초과: 매도 구간
- 60%=노랑(익절 고려), 70%=주황(적극 익절), 80%=빨강(강력 익절), 90%=핑크(full_exit 권장), 100%=MAX(full_exit 필수)

【현재 보유 현황】
- 종목: ${stockCode} (${stockName})
- 평단가: ${averagePrice.toLocaleString()}원, 현재가: ${currentPrice.toLocaleString()}원
- 현재 수익률: ${profitRatePct.toFixed(2)}%
- 현재 CL 위치: ${currentRainbowLine}%
- 보유 수량: ${quantity}주, 보유 기간: ${holdingDays}일
- 진입한 레인보우 라인: ${filledEntrySteps.join(', ')}%

【지시사항】
위 종목에 대해 2~4개의 분할매도 단계를 제안하세요.
각 단계는 아래 트리거 중 하나를 사용합니다:
- profit_rate: 수익률이 triggerValue(%) 이상 될 때
- rainbow_line: CL이 triggerValue(10~100) 이상 될 때
- loss_rate: 수익률이 -triggerValue(%) 이하 될 때 (손절)

sellRatio는 그 시점의 잔여수량 중 몇 %를 팔지 (0.0~1.0).
예: 0.3 = 잔여의 30%, 1.0 = 전량

현재 CL(${currentRainbowLine}%), 수익률(${profitRatePct.toFixed(1)}%), 보유 기간(${holdingDays}일)을 고려해 현실적인 목표를 제안하세요.
매수 라인(${filledEntrySteps.join(', ')}%)이 낮을수록(평단가 낮을수록) 더 공격적 익절 가능.

아래 JSON 배열만 응답하세요 (다른 텍스트 없이):
[
  {
    "priority": 1,
    "triggerType": "profit_rate",
    "triggerValue": 8,
    "sellRatio": 0.3,
    "label": "1차 익절 (+8%)",
    "fulfilled": false
  },
  ...
]`;

    const result = await this.createJsonCompletion([
      { role: 'system', content: '당신은 한국 주식 분할매도 전략 AI입니다. 반드시 JSON 배열만 응답합니다.' },
      { role: 'user', content: prompt },
    ], { model: aiModel, temperature: 0.3, usageContext });

    const stages: import('@shared/schema').ExitStage[] = Array.isArray(result)
      ? result.map((s: any, i: number) => ({
          priority: s.priority ?? (i + 1),
          triggerType: s.triggerType ?? 'profit_rate',
          triggerValue: Number(s.triggerValue ?? 10),
          sellRatio: Math.min(1, Math.max(0, Number(s.sellRatio ?? 0.5))),
          label: s.label ?? `${i + 1}차 매도`,
          fulfilled: false,
        }))
      : [];

    return { exitStages: stages, reasoning: typeof result === 'object' && !Array.isArray(result) ? (result.reasoning ?? '') : '' };
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
  }, aiModel: string = 'gpt-5-mini', usageContext?: AiUsageContext): Promise<{
    suggestedLadder: { line: number; units: number }[];
    suggestedStopLossMode: string;
    suggestedMaxUnits: number;
    candidateThresholdAdjust: { minTotalScore?: number; minVolumeScore?: number };
    reasoning: string;
  }> {
    const { stats, linePerformance, unitPerformance, currentLadder, currentStopLossMode, modelType } = params;

    const kellyFraction = stats.winRate > 0 && stats.avgReturn > 0
      ? Math.max(0, parseFloat((stats.winRate / 100 - (1 - stats.winRate / 100) / (stats.avgReturn / Math.max(0.1, stats.maxDrawdown / stats.totalTrades))).toFixed(3)))
      : 0;

    const prompt = `당신은 한국 주식 자동매매 전략 최적화 전문가입니다. 실제 거래 성과 데이터를 분석해 전략을 개선하세요.

【모델 성과 요약】
- 모델 유형: ${modelType}
- 총 거래: ${stats.totalTrades}건 | 승률: ${stats.winRate.toFixed(1)}% | 평균수익: ${stats.avgReturn.toFixed(2)}% | 최대낙폭: ${stats.maxDrawdown.toFixed(1)}%
- 켈리 비율(포지션 크기 참고): ${kellyFraction}

【레인보우 라인별 성과】 (line: CL% 위치, 낮을수록 저점에 가까움)
${linePerformance.length > 0
  ? linePerformance.map(p => `  ${p.line}%: ${p.total}건, 승률${p.winRate.toFixed(0)}%, 평균수익${p.avgReturn.toFixed(2)}%, 기대값${p.expectancy.toFixed(2)}%`).join('\n')
  : '  데이터 없음'}

【유닛별 성과】
${unitPerformance.length > 0
  ? unitPerformance.map(p => `  ${p.units}유닛: ${p.total}건, 승률${p.winRate.toFixed(0)}%, 평균수익${p.avgReturn.toFixed(2)}%`).join('\n')
  : '  데이터 없음'}

【현재 전략】
- 라더 계획: ${JSON.stringify(currentLadder)}
- 손절 모드: ${currentStopLossMode}

【개선 원칙】
1. 기대값(expectancy) < 0 라인 → units=0 (해당 구간 진입 금지)
2. 기대값 > 2% + 승률 > 60% 라인 → units=2 고려 (그 외 units=1)
3. 손절 모드: 낙폭 > 15% → conditional/hard 권장; 낙폭 < 8% + 승률 > 60% → disabled 가능
4. maxUnits: 켈리 비율 기반 (보수적으로 켈리/2, 최대 5)
5. candidateThresholdAdjust: 승률 < 50% → minTotalScore +5, 승률 > 70% → -5 완화

JSON만 응답 (추가 텍스트 금지):
{
  "suggestedLadder": [{"line": 숫자, "units": 숫자}, ...],
  "suggestedStopLossMode": "disabled|soft_ai_first|conditional|hard",
  "suggestedMaxUnits": 숫자,
  "candidateThresholdAdjust": {"minTotalScore": 숫자},
  "reasoning": "핵심 근거 한 문장"
}`;

    const result = await this.createJsonCompletion([
      { role: 'system', content: '당신은 한국 주식 자동매매 전략 개선 AI입니다. 반드시 JSON만 응답합니다.' },
      { role: 'user', content: prompt },
    ], { model: aiModel, temperature: 0.3, usageContext });

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
