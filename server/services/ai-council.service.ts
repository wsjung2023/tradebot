// ai-council.service.ts — AI 투자자문 위원회 (shadow 모드)
// 기술·기본·감성 3인 애널리스트가 독립 분석 후 다수결로 최종 의견 도출.
// 현재는 shadow 모드(실거래 미연동)로만 동작하며, enableAICouncil 플래그 ON 시 자동매매 연동.
import { getAIService } from './ai.service';
import { getNewsService } from './news.service';
import { getKiwoomService } from './kiwoom';

export type CouncilAction = 'buy' | 'sell' | 'hold';

export interface CouncilOpinion {
  analyst: 'technical' | 'fundamental' | 'sentiment';
  action: CouncilAction;
  confidence: number;
  reasoning: string;
  model: string;
}

export interface CouncilResult {
  stockCode: string;
  stockName: string;
  currentPrice: number;
  opinions: CouncilOpinion[];
  chairman: {
    action: CouncilAction;
    confidence: number;
    voting: { buy: number; sell: number; hold: number };
    reasoning: string;
  };
  mode: 'shadow';
  createdAt: string;
}

function normalizeAction(input: any): CouncilAction {
  const action = String(input || '').toLowerCase();
  if (action === 'buy' || action === 'sell' || action === 'hold') return action;
  return 'hold';
}

function normalizeConfidence(input: any): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

export class AICouncilService {
  private ai = getAIService();
  private news = getNewsService();
  private kiwoom = getKiwoomService();

  async conductShadowCouncil(params: {
    stockCode: string;
    stockName: string;
    currentPrice: number;
    preferredModel?: string;
  }): Promise<CouncilResult> {
    const { stockCode, stockName, currentPrice, preferredModel = 'gpt-5.1' } = params;

    const [newsResult, ratiosResult] = await Promise.allSettled([
      this.news.getStockNews(stockCode, stockName, 5),
      this.kiwoom.getFinancialRatios(stockCode),
    ]);

    const contextHint = {
      newsCount: newsResult.status === 'fulfilled'
        ? (Array.isArray((newsResult.value as any)?.items)
            ? (newsResult.value as any).items.length
            : Array.isArray(newsResult.value)
              ? (newsResult.value as any[]).length
              : 0)
        : 0,
      hasRatios: ratiosResult.status === 'fulfilled' && !!ratiosResult.value,
    };

    const personaPrompts: Array<{ analyst: CouncilOpinion['analyst']; role: string }> = [
      { analyst: 'technical', role: '기술적 분석 관점으로 차트/수급 기반 결론을 내려라.' },
      { analyst: 'fundamental', role: '재무/밸류에이션 관점으로 결론을 내려라.' },
      { analyst: 'sentiment', role: '뉴스/심리/이슈 관점으로 결론을 내려라.' },
    ];

    const opinions = await Promise.all(
      personaPrompts.map(async ({ analyst, role }) => {
        const prompt = `${role}\n종목:${stockName}(${stockCode}) 현재가:${currentPrice}\n맥락:${JSON.stringify(contextHint)}`;
        try {
          const analysis = await this.ai.analyzeStock(
            { stockCode, stockName, currentPrice, reasoningHint: prompt } as any,
            preferredModel,
          );
          return {
            analyst,
            action: normalizeAction((analysis as any)?.action),
            confidence: normalizeConfidence((analysis as any)?.confidence),
            reasoning: String((analysis as any)?.reasoning || 'N/A'),
            model: preferredModel,
          } as CouncilOpinion;
        } catch (error: any) {
          return {
            analyst,
            action: 'hold',
            confidence: 40,
            reasoning: `fallback: ${error?.message || 'analysis failed'}`,
            model: preferredModel,
          } as CouncilOpinion;
        }
      }),
    );

    const voting = { buy: 0, sell: 0, hold: 0 };
    opinions.forEach((o) => {
      voting[o.action] += 1;
    });

    const sorted = Object.entries(voting).sort((a, b) => b[1] - a[1]);
    const action = (sorted[0]?.[0] as CouncilAction) || 'hold';
    const avgConfidence = opinions.length
      ? opinions.reduce((sum, o) => sum + o.confidence, 0) / opinions.length
      : 50;

    return {
      stockCode,
      stockName,
      currentPrice,
      opinions,
      chairman: {
        action,
        confidence: Math.round(avgConfidence),
        voting,
        reasoning: `다수결(${voting.buy}/${voting.sell}/${voting.hold}) 및 평균 신뢰도 기반 의사결정`,
      },
      mode: 'shadow',
      createdAt: new Date().toISOString(),
    };
  }
}

let aiCouncilServiceInstance: AICouncilService | null = null;

export function getAICouncilService(): AICouncilService {
  if (!aiCouncilServiceInstance) {
    aiCouncilServiceInstance = new AICouncilService();
  }
  return aiCouncilServiceInstance;
}
