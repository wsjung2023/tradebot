import { readFileSync } from 'node:fs';

const checks = [
  {
    file: 'server/routes/kiwoom-agent.routes.ts',
    pattern: /timingSafeEqual/,
    reason: 'Agent key comparison in core agent routes must use timing-safe compare.',
  },
  {
    file: 'server/routes/kiwoom-agent.routes.ts',
    pattern: /x-agent-key/,
    reason: 'Core agent routes should keep x-agent-key header support.',
  },
  {
    file: 'server/routes/kiwoom-jobs.routes.ts',
    pattern: /timingSafeEqual/,
    reason: 'Legacy kiwoom-jobs routes must use timing-safe compare.',
  },
  {
    file: 'server/routes/kiwoom-jobs.routes.ts',
    pattern: /router\.get\(\s*["']\/jobs["']\s*,\s*checkAgent/,
    reason: 'Legacy debug jobs list must remain agent-protected.',
  },
  {
    file: 'server/routes/kiwoom-jobs.routes.ts',
    pattern: /invalid_job_id/,
    reason: 'Legacy result route must keep invalid jobId validation.',
  },
];

let failed = false;
for (const check of checks) {
  const source = readFileSync(check.file, 'utf-8');
  if (!check.pattern.test(source)) {
    console.error(`❌ Missing agent contract: ${check.pattern} (${check.reason})`);
    failed = true;
  } else {
    console.log(`✅ Agent contract present: ${check.pattern}`);
  }
}

if (failed) process.exit(1);
console.log('✅ agent contract guard passed');
