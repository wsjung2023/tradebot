import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';

const PREVIEW_PORT = Number(process.env.PLAYWRIGHT_PREVIEW_PORT || 4173);
const EXTERNAL_BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
const BASE_URL = EXTERNAL_BASE_URL || `http://127.0.0.1:${PREVIEW_PORT}`;
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS === '1';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReady(url, maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch (_) {
      // retry
    }
    await wait(500);
  }
  throw new Error(`Server did not become ready: ${url}`);
}

function startPreviewIfNeeded() {
  if (EXTERNAL_BASE_URL) return null;
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'cmd.exe' : 'npx';
  const args = isWin
    ? ['/c', 'npx', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)]
    : ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)];

  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => process.stdout.write(`[preview] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`));
  return child;
}

function stopPreview(preview) {
  if (!preview || preview.killed) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  preview.kill('SIGTERM');
}

async function run() {
  const preview = startPreviewIfNeeded();
  let browser;
  try {
    await waitForReady(BASE_URL);
    browser = await chromium.launch({ headless: HEADLESS });
    const page = await browser.newPage();
    page.setDefaultTimeout(10_000);

    const routes = ['/login', '/trading', '/guide'];
    for (const route of routes) {
      const target = `${BASE_URL}${route}`;
      try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      } catch (error) {
        const message = String(error?.message || error);
        if (!message.includes('interrupted by another navigation')) {
          throw error;
        }
        await page.waitForLoadState('domcontentloaded');
      }
      console.log(`[playwright-smoke] loaded ${route} -> ${page.url()} title="${await page.title()}"`);
    }
    console.log('[playwright-smoke] success');
  } finally {
    if (browser) await browser.close();
    stopPreview(preview);
  }
}

run().catch((error) => {
  console.error('[playwright-smoke] failed', error);
  process.exit(1);
});
