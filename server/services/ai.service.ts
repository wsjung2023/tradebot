import OpenAI from 'openai';
import type { AiModel, Holding, Order } from '@shared/schema';
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
    const { model = 'gpt-4', temperature = 0.3 } = options;

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

  async analyzeStock(request: StockAnalysisRequest, model: string = 'gpt-4'): Promise<StockAnalysisResponse> {
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
3. Target price (if applicable)
4. Clear reasoning for your recommendation
5. Key indicators that support your decision

Format your response as JSON:
{
  "action": "buy|sell|hold",
  "confidence": 75,
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
    
    return {
      action: response.action || 'hold',
      confidence: response.confidence || 50,
      targetPrice: response.targetPrice || null,
      reasoning: response.reasoning || 'Analysis pending',
      indicators: response.indicators || {},
    };
  }

  // ==================== Portfolio Analysis ====================

  async analyzePortfolio(request: PortfolioAnalysisRequest, model: string = 'gpt-4'): Promise<PortfolioAnalysisResponse> {
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

  async generateTradingStrategy(request: TradingStrategyRequest, model: string = 'gpt-4'): Promise<TradingStrategyResponse> {
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

  async analyzeMarketSentiment(marketData: any, model: string = 'gpt-4'): Promise<any> {
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
    model: string = 'gpt-4'
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

  async analyzeBacktest(backtestResults: any, model: string = 'gpt-4'): Promise<any> {
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
