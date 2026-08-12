import assert from "node:assert/strict";
import { waitForDatabase } from "../server/utils/startup-db";

async function run(): Promise<void> {
  let probeAttempts = 0;
  const retryAttempts: number[] = [];
  const sleepDelays: number[] = [];

  const successfulAttempt = await waitForDatabase(
    async () => {
      probeAttempts += 1;
      if (probeAttempts < 3) {
        throw new Error("database is still starting");
      }
    },
    {
      retryDelayMs: 5,
      onRetry: (_error, attempt) => retryAttempts.push(attempt),
      sleep: async (delayMs) => {
        sleepDelays.push(delayMs);
      },
    },
  );

  assert.equal(successfulAttempt, 3);
  assert.equal(probeAttempts, 3);
  assert.deepEqual(retryAttempts, [1, 2]);
  assert.deepEqual(sleepDelays, [5, 5]);

  console.log("startup database retry test passed");
}

void run();
