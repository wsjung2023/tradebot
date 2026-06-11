CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" serial PRIMARY KEY,
  "user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "detail" jsonb NOT NULL DEFAULT '{}',
  "ip" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");
