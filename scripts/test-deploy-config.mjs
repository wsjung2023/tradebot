import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/deploy-staging.yml', 'utf8');
const dockerfile = readFileSync('Dockerfile', 'utf8');

assert.doesNotMatch(
  workflow,
  /railway up/,
  'Railway GitHub autodeploy is the deploy owner; Actions must not upload a duplicate deployment',
);
assert.match(workflow, /vars\.RAILWAY_PROJECT_ID/);
assert.match(workflow, /vars\.RAILWAY_ENVIRONMENT_ID/);
assert.match(workflow, /vars\.RAILWAY_SERVICE_ID/);
assert.match(workflow, /vars\.SAAS_HEALTH_URL/);
assert.match(workflow, /railway deployment list/);
assert.match(workflow, /GITHUB_SHA/);
assert.match(workflow, /test:startup-resilience/);
assert.match(
  dockerfile,
  /node scripts\/wait-for-database\.mjs && node scripts\/migrate-prod\.mjs/,
  'container startup must wait for PostgreSQL before running migrations',
);

console.log('deployment workflow resilience test passed');
