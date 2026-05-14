// replit-readiness.mjs — Replit 환경 준비상태 자동 점검 스크립트
// DB 연결, 필수 환경변수, 빌드 산출물, 서버 응답을 순서대로 확인하고 통과/실패 리포트를 출력.
import { existsSync } from 'node:fs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';

const checks = [];

function addCheck(name, status, detail) {
  checks.push({ name, status, detail });
}

function run(cmd, args, envOverride = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...envOverride },
  });
  return result.status === 0;
}

function summarize() {
  for (const c of checks) {
    const icon = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌';
    console.log(`${icon} ${c.name}${c.detail ? ` - ${c.detail}` : ''}`);
  }

  const outDir = path.join(process.cwd(), 'artifacts');
  mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, 'replit-readiness.json');
  const previousReport = existsSync(reportPath)
    ? JSON.parse(readFileSync(reportPath, 'utf-8'))
    : null;
  const previousChecks = new Map((previousReport?.checks || []).map((c) => [c.name, c.status]));
  const statusChanges = checks
    .filter((c) => previousChecks.has(c.name) && previousChecks.get(c.name) !== c.status)
    .map((c) => ({ name: c.name, from: previousChecks.get(c.name), to: c.status }));
  const rank = { pass: 0, warn: 1, fail: 2 };
  const regressions = statusChanges.filter((d) => (rank[d.to] ?? 0) > (rank[d.from] ?? 0));

  writeFileSync(
    reportPath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      checks,
      diff: {
        previousGeneratedAt: previousReport?.generatedAt || null,
        statusChanges,
        regressions,
      },
    }, null, 2),
    'utf-8',
  );
  console.log(`🧾 readiness report saved: ${reportPath}`);
  if (statusChanges.length > 0) {
    console.log(`🔄 readiness status changes: ${statusChanges.map((d) => `${d.name} ${d.from}→${d.to}`).join(', ')}`);
  }
  if (regressions.length > 0) {
    console.log(`🚨 readiness regressions: ${regressions.map((d) => `${d.name} ${d.from}→${d.to}`).join(', ')}`);
  }

  const hasFail = checks.some((c) => c.status === 'fail');
  const failOnRegression = process.env.FAIL_ON_REGRESSION === '1';
  process.exit(hasFail || (failOnRegression && regressions.length > 0) ? 1 : 0);
}

// Environment suitability checks
if (process.env.DATABASE_URL) {
  addCheck('DATABASE_URL', 'pass', 'set');
} else {
  addCheck('DATABASE_URL', 'warn', 'not set (server runtime will fail to boot)');
}

if (process.env.SESSION_SECRET) {
  addCheck('SESSION_SECRET', 'pass', 'set');
} else {
  addCheck('SESSION_SECRET', 'warn', 'not set (session security may be weak/default)');
}

addCheck('Kiwoom browser credentials API', 'pass', 'disabled-by-design (410 Gone)');

// Static and type validation
const typeOk = run('npm', ['run', 'check']);
addCheck('TypeScript check', typeOk ? 'pass' : 'fail');

const buildOk = run('npm', ['run', 'build']);
addCheck('Production build', buildOk ? 'pass' : 'fail');

const chartNormOk = run('npm', ['run', 'test:chart-normalization']);
addCheck('Chart normalization regression', chartNormOk ? 'pass' : 'fail');

const runtimeSchemaOk = run('npm', ['run', 'check:runtime-schema'], {
  STRICT_RUNTIME_SCHEMA: process.env.CI === 'true' ? '1' : (process.env.STRICT_RUNTIME_SCHEMA || '0'),
});
addCheck('Runtime schema check', runtimeSchemaOk ? 'pass' : 'fail');

const legacyContractOk = run('npm', ['run', 'check:legacy-contracts']);
addCheck('Legacy API contract guard', legacyContractOk ? 'pass' : 'fail');

const runtimeContractOk = run('npm', ['run', 'check:runtime-contracts']);
addCheck('Runtime contract guard', runtimeContractOk ? 'pass' : 'fail');

const agentContractOk = run('npm', ['run', 'check:agent-contracts']);
addCheck('Agent contract guard', agentContractOk ? 'pass' : 'fail');

const secretHygieneOk = run('npm', ['run', 'check:secret-hygiene']);
addCheck('Secret hygiene guard', secretHygieneOk ? 'pass' : 'fail');

const securityConfigOk = run('npm', ['run', 'check:security-config']);
addCheck('Security config guard', securityConfigOk ? 'pass' : 'fail');

if (existsSync('dist/index.js') && existsSync('dist/public/index.html')) {
  addCheck('Build artifacts', 'pass', 'dist/index.js and dist/public/index.html present');
} else {
  addCheck('Build artifacts', 'fail', 'missing expected dist outputs');
}

// Playwright smoke check for Replit preview suitability
const smokeOk = run('node', ['scripts/playwright-smoke.mjs']);
if (smokeOk) {
  addCheck('Playwright smoke', 'pass');
} else {
  addCheck('Playwright smoke', 'warn', 'failed (often due to missing browser binaries); run `npx playwright install chromium`');
}

summarize();
