// Production migration script — runs before server start on Railway
// Drizzle 내장 migrator 대신 직접 SQL 파일을 순서대로 실행
import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../migrations'
);

// 마이그레이션 추적 테이블 생성 (없으면)
await pool.query(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id serial PRIMARY KEY,
    filename text NOT NULL UNIQUE,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

// migrations 폴더에서 .sql 파일 알파벳 순 정렬
const files = readdirSync(migrationsFolder)
  .filter(f => f.endsWith('.sql'))
  .sort();

// 이미 적용된 파일 목록 조회
const { rows: applied } = await pool.query('SELECT filename FROM _migrations ORDER BY id');
const appliedSet = new Set(applied.map(r => r.filename));

// _migrations 테이블이 비어있으면 기존 drizzle 추적 테이블에서 이미 적용된 수를 확인
if (applied.length === 0) {
  const { rows: drizzleRows } = await pool.query(`
    SELECT COUNT(*) as cnt FROM information_schema.tables
    WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
  `);
  const hasDrizzleTable = drizzleRows[0].cnt > 0;

  if (hasDrizzleTable) {
    const { rows: drizzleMigrations } = await pool.query(
      'SELECT COUNT(*) as cnt FROM drizzle.__drizzle_migrations'
    );
    const alreadyApplied = parseInt(drizzleMigrations[0].cnt, 10);
    console.log(`[migrate] Drizzle table has ${alreadyApplied} applied migrations — seeding _migrations...`);

    // 이미 적용된 N개는 _migrations에 기록 (재실행 방지)
    for (let i = 0; i < alreadyApplied && i < files.length; i++) {
      await pool.query('INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [files[i]]);
      appliedSet.add(files[i]);
    }
  }
}

let count = 0;
for (const file of files) {
  if (appliedSet.has(file)) continue;

  const sql = readFileSync(path.join(migrationsFolder, file), 'utf8');
  console.log(`[migrate] Applying ${file}...`);
  await pool.query(sql);
  await pool.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
  count++;
}

if (count === 0) {
  console.log('[migrate] No pending migrations.');
} else {
  console.log(`[migrate] Applied ${count} migration(s).`);
}

await pool.end();
