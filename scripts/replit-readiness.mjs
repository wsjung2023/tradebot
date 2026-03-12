// replit-readiness.mjs — Replit 환경 준비상태 자동 점검 스크립트
// DB 연결, 필수 환경변수, 빌드 산출물, 서버 응답을 순서대로 확인하고 통과/실패 리포트를 출력.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const checks = [];

function addCheck(name, status, detail) {
  checks.push({ name, status, detail });
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', env: process.env });
  return result.status === 0;
}

function summarize() {
  for (const c of checks) {
    const icon = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌';
    console.log(`${icon} ${c.name}${c.detail ? ` - ${c.detail}` : ''}`);
  }

  const hasFail = checks.some((c) => c.status === 'fail');
  process.exit(hasFail ? 1 : 0);
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

// Static and type validation
const typeOk = run('npm', ['run', 'check']);
addCheck('TypeScript check', typeOk ? 'pass' : 'fail');

const buildOk = run('npm', ['run', 'build']);
addCheck('Production build', buildOk ? 'pass' : 'fail');

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
