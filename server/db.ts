// db.ts — PostgreSQL 연결 풀. 읽기 전용(dbReadonly)과 쓰기용(db) 풀을 분리하여 제공
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

// DATABASE_URL(헬리엄) 우선, 없으면 NEON_DATABASE_URL 폴백
const resolvedDatabaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!resolvedDatabaseUrl) {
  throw new Error("DATABASE_URL 또는 NEON_DATABASE_URL 이 설정되어야 합니다.");
}

const isLocalDb = resolvedDatabaseUrl.includes('localhost') || resolvedDatabaseUrl.includes('127.0.0.1');

const poolConfig = {
  connectionString: resolvedDatabaseUrl,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
  keepAlive: true,
  keepAliveInitialDelayMillis: 5000,
};

// 쓰기 풀: INSERT/UPDATE/DELETE 전용 (max 3 - 트랜잭션 안전)
export const pool = new Pool({ ...poolConfig, max: 3 });

// 읽기 전용 풀: SELECT 전용 (max 5 - 동시 조회 최적화)
const readonlyConnectionString = process.env.DATABASE_READONLY_URL || resolvedDatabaseUrl;
export const readonlyPool = new Pool({ ...poolConfig, connectionString: readonlyConnectionString, max: 5 });

// 연결 에러 이벤트 핸들러: 끊어진 연결을 조용히 로그만 남김 (서버 크래시 방지)
pool.on("error", (err) => {
  console.warn("[DB Pool] 유휴 클라이언트 연결 오류 (자동 복구됨):", err.message);
});
readonlyPool.on("error", (err) => {
  console.warn("[DB ReadonlyPool] 유휴 클라이언트 연결 오류 (자동 복구됨):", err.message);
});

// 쓰기 DB 인스턴스 (INSERT/UPDATE/DELETE에 사용)
export const db = drizzle({ client: pool, schema });

// 읽기 전용 DB 인스턴스 (SELECT에 사용 — 실수로 쓰기 방지)
export const dbReadonly = drizzle({ client: readonlyPool, schema });
