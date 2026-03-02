import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Standard node-postgres (pg) pool: uses TCP connections (not WebSockets),
// fully supports PostgreSQL wire protocol including RETURNING, empty results, transactions.
// More memory-stable than neon-serverless WebSocket pool.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle({ client: pool, schema });
