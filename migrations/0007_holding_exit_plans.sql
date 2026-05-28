CREATE TABLE IF NOT EXISTS "holding_exit_plans" (
  "id" serial PRIMARY KEY,
  "model_id" integer NOT NULL REFERENCES "ai_models"("id") ON DELETE CASCADE,
  "stock_code" text NOT NULL,
  "take_profit_percent" decimal(8,4),
  "stop_loss_percent" decimal(8,4),
  "exit_stages" jsonb,
  "ai_reasoning" text,
  "source" text NOT NULL DEFAULT 'manual',
  "generated_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE("model_id", "stock_code")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "holding_exit_plans_model_stock_idx"
  ON "holding_exit_plans" ("model_id", "stock_code");
