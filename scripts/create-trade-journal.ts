import pkg from "pg";
const { Pool } = pkg;

const run = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const sql = `
CREATE TABLE IF NOT EXISTS "trade_journal" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"account_id" integer NOT NULL,
	"model_id" integer,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"trade_date" text NOT NULL,
	"trade_time" text NOT NULL,
	"trade_type" text NOT NULL,
	"price" numeric(12, 2),
	"quantity" integer NOT NULL,
	"total_amount" numeric(16, 2),
	"avg_price" numeric(12, 2),
	"rainbow_line" integer,
	"profit_rate" numeric(8, 4),
	"profit_loss" numeric(12, 2),
	"ai_confidence" numeric(5, 2),
	"exit_reason" text,
	"is_auto_trading" boolean DEFAULT true NOT NULL,
	"memo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trade_journal_user_id_stock_code_trade_date_trade_time_unique" UNIQUE("user_id","stock_code","trade_date","trade_time")
);

-- Add constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trade_journal_user_id_users_id_fk') THEN
        ALTER TABLE "trade_journal" ADD CONSTRAINT "trade_journal_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trade_journal_account_id_kiwoom_accounts_id_fk') THEN
        ALTER TABLE "trade_journal" ADD CONSTRAINT "trade_journal_account_id_kiwoom_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."kiwoom_accounts"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trade_journal_model_id_ai_models_id_fk') THEN
        ALTER TABLE "trade_journal" ADD CONSTRAINT "trade_journal_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;
  `;

  await pool.query(sql);
  console.log("trade_journal table created successfully!");
  await pool.end();
};

run().catch(console.error);
