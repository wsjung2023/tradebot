import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  const strict = process.env.CI === 'true' || process.env.STRICT_RUNTIME_SCHEMA === '1';
  if (strict) {
    console.error('DATABASE_URL is not set; strict runtime schema check requires DB');
    process.exit(1);
  }
  console.log('DATABASE_URL is not set; skipping runtime schema check');
  process.exit(0);
}

const requiredTables = [
  'auto_trading_runs',
  'engine_notifications',
  'agent_update_logs',
  'ai_usage_daily',
];

const requiredColumns = [
  { table: 'orders', column: 'error_message' },
];

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();

  const missingTables = [];
  for (const table of requiredTables) {
    const result = await client.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
    const exists = Boolean(result.rows?.[0]?.reg);
    if (!exists) missingTables.push(table);
  }

  if (missingTables.length > 0) {
    console.error(`Missing required runtime tables: ${missingTables.join(', ')}`);
    process.exit(1);
  }

  const missingColumns = [];
  for (const c of requiredColumns) {
    const result = await client.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
        LIMIT 1`,
      [c.table, c.column],
    );
    if ((result.rowCount ?? 0) === 0) missingColumns.push(`${c.table}.${c.column}`);
  }

  if (missingColumns.length > 0) {
    console.error(`Missing required runtime columns: ${missingColumns.join(', ')}`);
    process.exit(1);
  }

  console.log('runtime schema check passed');
  process.exit(0);
} catch (error) {
  console.error('runtime schema check failed:', error?.message || error);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
