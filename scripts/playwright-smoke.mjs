import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PREVIEW_PORT = Number(process.env.PLAYWRIGHT_PREVIEW_PORT || 4173);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PREVIEW_PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPreviewReady(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(BASE_URL, { method: 'GET' });
      if (res.ok) return;
    } catch (_) {
      // ignore until server is ready
    }
    await wait(500);
  }
  throw new Error(`Preview server did not become ready: ${BASE_URL}`);
}

async function run() {
  const preview = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  preview.stdout.on('data', (d) => process.stdout.write(`[preview] ${d}`));
  preview.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`));

  try {
    await waitForPreviewReady();

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const routes = ['/login', '/register', '/trading'];
    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      console.log(`[playwright-smoke] loaded ${route} title="${await page.title()}"`);
    }

    await browser.close();
    console.log('[playwright-smoke] success');
  } finally {
    preview.kill('SIGTERM');
  }
}

run().catch((error) => {
  console.error('[playwright-smoke] failed', error);
  process.exit(1);
});
