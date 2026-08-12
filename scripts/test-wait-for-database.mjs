import assert from 'node:assert/strict';
import { waitForDatabase } from './wait-for-database.mjs';

let attempts = 0;
const retryAttempts = [];
const sleepDelays = [];

const successfulAttempt = await waitForDatabase(
  async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('database is still starting');
  },
  {
    retryDelayMs: 5,
    onRetry: (_error, attempt) => retryAttempts.push(attempt),
    sleep: async (delayMs) => sleepDelays.push(delayMs),
  },
);

assert.equal(successfulAttempt, 3);
assert.deepEqual(retryAttempts, [1, 2]);
assert.deepEqual(sleepDelays, [5, 5]);

console.log('Railway database wait test passed');
