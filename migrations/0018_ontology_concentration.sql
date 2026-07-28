-- 온톨로지 1차: 집중 리스크 게이트 설정 (additive, 기본 OFF)
ALTER TABLE "auto_trading_settings" ADD COLUMN IF NOT EXISTS "ontology_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "auto_trading_settings" ADD COLUMN IF NOT EXISTS "concentration_policy" text NOT NULL DEFAULT 'warn';
ALTER TABLE "auto_trading_settings" ADD COLUMN IF NOT EXISTS "concentration_threshold" numeric(4,2) NOT NULL DEFAULT 0.70;
ALTER TABLE "auto_trading_settings" ADD COLUMN IF NOT EXISTS "max_correlated_positions" integer NOT NULL DEFAULT 1;
