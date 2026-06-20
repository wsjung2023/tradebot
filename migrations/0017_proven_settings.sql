-- 승격 브리지(Track 1): 시합 1등 설정 보관소
CREATE TABLE IF NOT EXISTS "proven_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "source_model_id" integer NOT NULL,
  "variant_label" text NOT NULL,
  "settings" jsonb NOT NULL,
  "score" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
