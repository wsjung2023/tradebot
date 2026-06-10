CREATE TABLE IF NOT EXISTS "learning_suggestions" (
  "id" serial PRIMARY KEY,
  "model_id" integer NOT NULL REFERENCES "ai_models"("id") ON DELETE CASCADE,
  "param_key" text NOT NULL,
  "current_value" text NOT NULL,
  "suggested_value" text NOT NULL,
  "reasoning" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "source" text NOT NULL DEFAULT 'ai',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "reviewed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_suggestions_model_status_idx"
  ON "learning_suggestions" ("model_id", "status");
