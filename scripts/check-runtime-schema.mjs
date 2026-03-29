import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  const strict = process.env.CI === 'true' || process.env.STRICT_RUNTIME_SCHEMA === '1';
  if (strict) {
    console.error('❌ DATABASE_URL is not set; strict runtime schema check requires DB');
    process.exit(1);
  }
  console.log('⚠️ DATABASE_URL is not set; skipping runtime schema check');
  process.exit(0);
}

const requiredTables = [
  'auto_trading_runs',
  'engine_notifications',
];

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();

  const missing = [];
  for (const table of requiredTables) {
    const result = await client.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
    const exists = Boolean(result.rows?.[0]?.reg);
    if (!exists) missing.push(table);
  }

  if (missing.length > 0) {
    console.error(`❌ Missing required runtime tables: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('✅ runtime schema check passed');
  process.exit(0);
} catch (error) {
  console.error('❌ runtime schema check failed:', error?.message || error);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
