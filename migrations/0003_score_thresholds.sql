ALTER TABLE "auto_trading_settings"
  ADD COLUMN IF NOT EXISTS "financials_score_threshold" numeric(5,2) NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "liquidity_score_threshold"  numeric(5,2) NOT NULL DEFAULT 40;
