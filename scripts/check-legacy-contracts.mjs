import { readFileSync } from 'node:fs';

const checks = [
  {
    file: 'server/routes/account.routes.ts',
    pattern: /app\.get\(\s*["']\/api\/kiwoom\/credentials["']/,
    reason: 'Legacy browser credential route must remain present (flag-gated), not deleted.',
  },
  {
    file: 'server/routes/account.routes.ts',
    pattern: /app\.get\(\s*["']\/api\/accounts\/:accountId\/fetch-balance["']/,
    reason: 'Account balance fetch endpoint must remain available.',
  },
  {
    file: 'server/routes/autotrading.routes.ts',
    pattern: /app\.post\(\s*["']\/api\/auto-trading\/backattack-scan["']/,
    reason: 'Backattack scan endpoint must remain available.',
  },
  {
    file: 'server/routes/trading.routes.ts',
    pattern: /app\.get\(\s*["']\/api\/stocks\/:stockCode\/price["']/,
    reason: 'Stock price endpoint must remain available.',
  },
  {
    file: 'server/routes/kiwoom-agent.routes.ts',
    pattern: /app\.get\(\s*["']\/api\/kiwoom-agent\/jobs\/:jobId\/status["']/,
    reason: 'Agent job status endpoint must remain available.',
  },
];

let failed = false;
for (const check of checks) {
  const source = readFileSync(check.file, 'utf-8');
  const ok = check.pattern.test(source);
  if (!ok) {
    console.error(`❌ Missing contract: ${check.pattern.toString()} (${check.reason})`);
    failed = true;
  } else {
    console.log(`✅ Contract present: ${check.pattern.toString()}`);
  }
}

if (failed) process.exit(1);
console.log('✅ legacy contract guard passed');
