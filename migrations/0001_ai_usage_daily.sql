CREATE TABLE IF NOT EXISTS "ai_usage_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"usage_date" text NOT NULL,
	"user_id" varchar NOT NULL,
	"scope_type" text NOT NULL,
	"scope_key" text NOT NULL,
	"account_id" integer,
	"request_count" integer DEFAULT 0 NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(14, 8) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_usage_daily_unique_scope"
  ON "ai_usage_daily" ("usage_date","user_id","scope_key");

CREATE INDEX IF NOT EXISTS "ai_usage_daily_user_date_idx"
  ON "ai_usage_daily" ("user_id","usage_date");

