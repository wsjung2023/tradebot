// feature-flags.ts — 환경변수 기반 피처 플래그
// 환경변수(ENABLE_*)로 실험적 기능을 ON/OFF 제어한다.
// 기본값: AI Council·엔트리포인트·고급학습 OFF, 가격알림 ON
const TRUE_SET = new Set(["1", "true", "yes", "on"]);

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  return TRUE_SET.has(value.trim().toLowerCase());
}

export interface FeatureFlags {
  enableAICouncil: boolean;
  enableEntryPointEngine: boolean;
  enableAdvancedLearning: boolean;
  enablePriceAlertsInTradingCycle: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    enableAICouncil: parseBooleanEnv(process.env.ENABLE_AI_COUNCIL, false),
    enableEntryPointEngine: parseBooleanEnv(process.env.ENABLE_ENTRY_POINT_ENGINE, false),
    enableAdvancedLearning: parseBooleanEnv(process.env.ENABLE_ADVANCED_LEARNING, false),
    enablePriceAlertsInTradingCycle: parseBooleanEnv(process.env.ENABLE_PRICE_ALERTS_IN_TRADING_CYCLE, true),
  };
}
