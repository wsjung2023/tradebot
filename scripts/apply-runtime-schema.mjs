import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is required to apply runtime schema');
  process.exit(1);
}

const sql = `
CREATE TABLE IF NOT EXISTS auto_trading_runs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  state TEXT NOT NULL DEFAULT 'stopped',
  reason TEXT,
  last_cycle_at TIMESTAMP,
  last_heartbeat_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_error TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT auto_trading_runs_user_unique UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS engine_notifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engine_notifications_user_created
  ON engine_notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_update_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  agent_hash_before TEXT,
  server_hash TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  id SERIAL PRIMARY KEY,
  usage_date TEXT NOT NULL,
  user_id VARCHAR NOT NULL,
  scope_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  account_id INTEGER,
  request_count INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_daily_unique_scope
  ON ai_usage_daily (usage_date, user_id, scope_key);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_user_date
  ON ai_usage_daily (user_id, usage_date DESC);

CREATE TABLE IF NOT EXISTS stock_status (
  stock_code VARCHAR(10) PRIMARY KEY,
  order_warning SMALLINT,
  state TEXT,
  audit_info TEXT,
  is_warning BOOLEAN,
  is_danger BOOLEAN,
  is_audit_alert BOOLEAN,
  credit_available BOOLEAN,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE auto_trading_settings ADD COLUMN IF NOT EXISTS filter_investment_warnings BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE auto_trading_settings SET filter_investment_warnings = FALSE WHERE filter_investment_warnings IS NULL OR filter_investment_warnings = TRUE;
`;

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(sql);
  console.log('✅ runtime schema applied (auto_trading_runs, engine_notifications, agent_update_logs, ai_usage_daily, stock_status)');
} catch (error) {
  console.error('❌ failed to apply runtime schema:', error?.message || error);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
