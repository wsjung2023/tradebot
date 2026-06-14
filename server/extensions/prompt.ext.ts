// prompt.ext.ts — AI 분석 프롬프트 커스터마이징 Extension Point
// Private Cloud 고객이 자체 투자 철학에 맞게 프롬프트를 조정할 수 있습니다.

export interface PromptContext {
  stockCode: string;
  stockName: string;
  modelType: string;
  userTradingStyle?: string;
}

export interface PromptExtension {
  // 시스템 프롬프트 앞에 추가할 접두 지시사항. null 반환 시 생략.
  systemPromptPrefix(ctx: PromptContext): string | null;
  // 분석 요청 프롬프트 뒤에 추가할 접미 조건. null 반환 시 생략.
  analysisPromptSuffix(ctx: PromptContext): string | null;
}

// 기본 구현: 추가 지시사항 없음
const defaultPrompt: PromptExtension = {
  systemPromptPrefix: (_ctx) => null,
  analysisPromptSuffix: (_ctx) => null,
};

export function getPromptExtension(): PromptExtension {
  return defaultPrompt;
}
