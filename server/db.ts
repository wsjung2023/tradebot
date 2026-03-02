import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// neon-http: stateless HTTP per query, no persistent WebSocket connections (prevents OOM).
// Bug patch: neon-http returns null for empty results causing null.map() error.
// We catch that specific error and return [] (correct behavior for 0 rows).
const _rawSql = neon(process.env.DATABASE_URL);

type NeonSql = typeof _rawSql;

function buildPatchedSql(raw: NeonSql): NeonSql {
  function patched(strings: TemplateStringsArray, ...values: unknown[]): Promise<any> {
    return (raw as any)(strings, ...values).catch((err: Error) => {
      if (err?.message === "Cannot read properties of null (reading 'map')") {
        // Neon HTTP API returns rows:null for zero-row results; treat as empty array.
        return [];
      }
      throw err;
    });
  }
  Object.assign(patched, raw);
  Object.setPrototypeOf(patched, Object.getPrototypeOf(raw));
  return patched as unknown as NeonSql;
}

const sql = buildPatchedSql(_rawSql);
export const db = drizzle({ client: sql, schema });

// Pool only kept for compatibility — MemoryStore is used for sessions.
neonConfig.webSocketConstructor = ws;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});
