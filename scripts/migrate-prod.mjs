// Production migration script — runs before server start on Railway
// Pure ESM, no TypeScript needed
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { fileURLToPath } from 'url';
import path from 'path';

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../migrations'
);

console.log('[migrate] Running pending migrations...');
await migrate(db, { migrationsFolder });
console.log('[migrate] Done.');
await pool.end();
