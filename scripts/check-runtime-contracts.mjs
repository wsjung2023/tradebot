import { readFileSync } from 'node:fs';

const checks = [
  {
    file: 'server/routes/settings.routes.ts',
    pattern: /app\.get\(\s*["']\/api\/runtime-introspection["']/,
    reason: 'Runtime introspection endpoint must remain available.',
  },
  {
    file: 'server/routes/autotrading.routes.ts',
    pattern: /app\.get\(\s*["']\/api\/auto-trading\/engine-status["']/,
    reason: 'Engine status endpoint must remain available.',
  },
  {
    file: 'server/routes/autotrading.routes.ts',
    pattern: /app\.get\(\s*["']\/api\/auto-trading\/notifications["']/,
    reason: 'Notification list endpoint must remain available.',
  },
  {
    file: 'server/routes/autotrading.routes.ts',
    pattern: /app\.post\(\s*["']\/api\/auto-trading\/notifications\/:id\/read["']/,
    reason: 'Single notification read endpoint must remain available.',
  },
  {
    file: 'server/routes/autotrading.routes.ts',
    pattern: /app\.get\(\s*["']\/api\/auto-trading\/notifications\/summary["']/,
    reason: 'Notification summary endpoint must remain available.',
  },
  {
    file: 'server/routes/autotrading.routes.ts',
    pattern: /app\.get\(\s*["']\/api\/auto-trading\/notifications\/unread-count["']/,
    reason: 'Unread-count endpoint must remain available.',
  },
  {
    file: 'server/routes/autotrading.routes.ts',
    pattern: /app\.post\(\s*["']\/api\/auto-trading\/notifications\/read-all["']/,
    reason: 'Bulk read endpoint must remain available.',
  },
  {
    file: 'server/storage/interface.ts',
    pattern: /getUnreadEngineNotificationCount\(userId: string\): Promise<number>/,
    reason: 'Storage contract for unread count must remain available.',
  },
  {
    file: 'server/storage/interface.ts',
    pattern: /markAllEngineNotificationsRead\(userId: string\): Promise<number>/,
    reason: 'Storage contract for bulk read must remain available.',
  },
  {
    file: 'server/storage/interface.ts',
    pattern: /getEngineNotificationSummary\(userId: string\): Promise<\{/,
    reason: 'Storage contract for notification summary must remain available.',
  },
  {
    file: 'server/routes/settings.routes.ts',
    pattern: /notificationSummary\s*=/,
    reason: 'Runtime introspection should expose notification summary.',
  },
  {
    file: 'server/routes/settings.routes.ts',
    pattern: /agentCooldownRemainingSec/,
    reason: 'Runtime introspection should expose agent timeout cooldown state.',
  },
];

let failed = false;
for (const check of checks) {
  const source = readFileSync(check.file, 'utf-8');
  const ok = check.pattern.test(source);
  if (!ok) {
    console.error(`❌ Missing runtime contract: ${check.pattern.toString()} (${check.reason})`);
    failed = true;
  } else {
    console.log(`✅ Runtime contract present: ${check.pattern.toString()}`);
  }
}

if (failed) process.exit(1);
console.log('✅ runtime contract guard passed');
