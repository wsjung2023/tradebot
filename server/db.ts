import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Set WebSocket constructor BEFORE creating Pool
neonConfig.webSocketConstructor = ws;

// Strictly limited Pool: max 3 connections, short idle timeout to prevent accumulation.
// MemoryStore is used for sessions (no session DB connections needed).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 15000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle({ client: pool, schema });
