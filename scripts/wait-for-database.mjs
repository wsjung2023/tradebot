import pg from 'pg';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const defaultSleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

export async function waitForDatabase(probe, options) {
  let attempt = 0;
  const sleep = options.sleep ?? defaultSleep;

  while (true) {
    attempt += 1;
    try {
      await probe();
      return attempt;
    } catch (error) {
      options.onRetry?.(error, attempt);
      await sleep(options.retryDelayMs);
    }
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  try {
    const successfulAttempt = await waitForDatabase(
      () => pool.query('select 1'),
      {
        retryDelayMs: 5000,
        onRetry: (error, attempt) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[railway] Database unavailable (attempt ${attempt}): ${message}. Retrying in 5s...`);
        },
      },
    );
    console.log(`[railway] Database ready after ${successfulAttempt} attempt(s).`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error('[railway] Database readiness failed:', error);
    process.exit(1);
  });
}
