import assert from "node:assert/strict";
import { createStartupReadiness } from "../server/utils/startup-readiness";

const readiness = createStartupReadiness({
  startedAt: "2026-08-12T00:00:00.000Z",
  buildVersion: "test-commit",
});

assert.deepEqual(readiness.getHealthResponse(), {
  statusCode: 503,
  body: {
    ok: false,
    status: "starting",
    buildVersion: "test-commit",
    startedAt: "2026-08-12T00:00:00.000Z",
  },
});

readiness.markReady();

assert.deepEqual(readiness.getHealthResponse(), {
  statusCode: 200,
  body: {
    ok: true,
    status: "ready",
    buildVersion: "test-commit",
    startedAt: "2026-08-12T00:00:00.000Z",
  },
});

console.log("startup readiness test passed");
