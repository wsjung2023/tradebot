CREATE TABLE IF NOT EXISTS "condition_scan_logs" (
  "id" serial PRIMARY KEY,
  "model_id" integer NOT NULL,
  "user_id" varchar NOT NULL,
  "condition_seq" text NOT NULL,
  "condition_name" text,
  "stock_code" text NOT NULL,
  "stock_name" text NOT NULL DEFAULT '',
  "dart_blocked" boolean NOT NULL DEFAULT false,
  "scanned_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "condition_scan_logs_model_scanned_idx" ON "condition_scan_logs" ("model_id", "scanned_at" DESC);
