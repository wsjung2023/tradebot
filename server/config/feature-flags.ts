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
