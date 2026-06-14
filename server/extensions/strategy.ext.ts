// strategy.ext.ts — 매수/매도 신호 커스터마이징 Extension Point
// Private Cloud 고객이 이 파일을 수정해 자체 전략 로직을 주입할 수 있습니다.

export interface TradeSignal {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;   // 0~1
  reason?: string;
}

export interface StrategyContext {
  stockCode: string;
  currentPrice: number;
  rainbowLine?: number;
  aiScore?: number;
  modelConfig?: Record<string, unknown>;
}

export interface StrategyExtension {
  // Core AI 판단 이후 추가 필터링 로직. null 반환 시 Core 판단 그대로 사용.
  postProcessSignal(signal: TradeSignal, ctx: StrategyContext): TradeSignal | null;
  // 종목 제외 필터. true 반환 시 해당 종목 거래 스킵.
  shouldSkipStock(stockCode: string, ctx: StrategyContext): boolean;
}

// 기본 구현: Core 판단 그대로 통과
const defaultStrategy: StrategyExtension = {
  postProcessSignal: (_signal, _ctx) => null,
  shouldSkipStock: (_stockCode, _ctx) => false,
};

export function getStrategyExtension(): StrategyExtension {
  return defaultStrategy;
}
