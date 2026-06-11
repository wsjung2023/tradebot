-- Plans definition table
CREATE TABLE IF NOT EXISTS "plans" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "paddle_price_id" text,
  "monthly_usd" decimal(10,2),
  "max_models" integer,
  "max_ai_calls_per_day" integer,
  "aum_limit_krw" bigint,
  "features" jsonb NOT NULL DEFAULT '{}',
  "is_active" boolean NOT NULL DEFAULT true
);

-- Seed default plans
INSERT INTO "plans" ("id", "name", "monthly_usd", "max_models", "max_ai_calls_per_day", "features") VALUES
  ('free',       'Free (on_prem/private)',  NULL,   5,   50, '{"autoTrade":true}'),
  ('saas_basic', 'Basic',                   85.00,  2,   50, '{"autoTrade":true}'),
  ('saas_pro',   'Pro',                    180.00,  5,  200, '{"autoTrade":true,"prioritySupport":true}'),
  ('saas_enterprise', 'Enterprise',        320.00, 20, 1000, '{"autoTrade":true,"prioritySupport":true,"customStrategy":true}')
ON CONFLICT ("id") DO NOTHING;

-- User subscriptions table
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" serial PRIMARY KEY,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "paddle_subscription_id" text UNIQUE,
  "paddle_customer_id" text,
  "tier" text NOT NULL DEFAULT 'free',
  "status" text NOT NULL DEFAULT 'active',
  -- 'active' | 'past_due' | 'cancelled' | 'trialing'
  "current_period_end" timestamp,
  "aum_tier" text,
  -- 'under_20m' | 'under_50m' | 'under_100m' | 'over_100m'
  "detected_aum" bigint,
  "aum_checked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_paddle_sub_id_idx" ON "subscriptions"("paddle_subscription_id");
