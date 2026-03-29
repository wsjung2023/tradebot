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
`;

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(sql);
  console.log('✅ runtime schema applied (auto_trading_runs, engine_notifications)');
} catch (error) {
  console.error('❌ failed to apply runtime schema:', error?.message || error);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
