ALTER TABLE "auto_trading_settings" ADD COLUMN IF NOT EXISTS "filter_investment_warnings" boolean NOT NULL DEFAULT false;
