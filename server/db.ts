// db.ts — PostgreSQL 연결 풀. 읽기 전용(dbReadonly)과 쓰기용(db) 풀을 분리하여 제공
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false },
};

// 쓰기 풀: INSERT/UPDATE/DELETE 전용 (max 3 - 트랜잭션 안전)
export const pool = new Pool({ ...poolConfig, max: 3 });

// 읽기 전용 풀: SELECT 전용 (max 5 - 동시 조회 최적화)
// 실제 운영환경에서는 DATABASE_READONLY_URL 환경변수로 읽기 복제본 연결을 권장
const readonlyConnectionString = process.env.DATABASE_READONLY_URL || process.env.DATABASE_URL;
export const readonlyPool = new Pool({ ...poolConfig, connectionString: readonlyConnectionString, max: 5 });

// 쓰기 DB 인스턴스 (INSERT/UPDATE/DELETE에 사용)
export const db = drizzle({ client: pool, schema });

// 읽기 전용 DB 인스턴스 (SELECT에 사용 — 실수로 쓰기 방지)
export const dbReadonly = drizzle({ client: readonlyPool, schema });
