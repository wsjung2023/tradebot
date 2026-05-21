import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";

const EXTERNAL_BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
const DEV_PORT = Number(process.env.PORT || 5000);
const BASE_URL = EXTERNAL_BASE_URL || `http://127.0.0.1:${DEV_PORT}`;
const EMAIL = process.env.TEST_EMAIL || "test@test.com";
const PASSWORD = process.env.TEST_PASSWORD || "12345678";
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS === "1";
const HOLD_MS = Number(process.env.PLAYWRIGHT_HOLD_MS || "3000");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isHttpReady(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch (_) {
    return false;
  }
}

async function waitForReady(url, maxAttempts = 120) {
  for (let i = 0; i < maxAttempts; i += 1) {
    if (await isHttpReady(url)) return;
    await wait(500);
  }
  throw new Error(`Server did not become ready: ${url}`);
}

async function startDevServerIfNeeded() {
  if (EXTERNAL_BASE_URL) return null;
  const healthUrl = `${BASE_URL}/api/healthz`;
  if (await isHttpReady(healthUrl)) {
    console.log(`[candidate-decisions] reusing existing server: ${BASE_URL}`);
    return null;
  }
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "npm";
  const args = isWin ? ["/c", "npm", "run", "dev"] : ["run", "dev"];
  const child = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(DEV_PORT),
      NODE_ENV: "development",
    },
  });
  child.stdout.on("data", (d) => process.stdout.write(`[dev] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[dev] ${d}`));
  return child;
}

function stopDevServer(devServer) {
  if (!devServer || devServer.killed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(devServer.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  devServer.kill("SIGTERM");
}

async function ensureTestAccount() {
  try {
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "Playwright Test" }),
    });
  } catch (_) {
    // noop
  }
}

async function login(page) {
  await ensureTestAccount();
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const emailInput = page.locator('[data-testid="input-email"]');
  const loginFormVisible = await emailInput.isVisible({ timeout: 15000 }).catch(() => false);
  if (!loginFormVisible) {
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      throw new Error(`login form not visible on /login (url=${currentUrl})`);
    }
    return;
  }

  await emailInput.fill(EMAIL);
  await page.locator('[data-testid="input-password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);

  if (page.url().includes("/login")) {
    throw new Error(`login failed for ${EMAIL}`);
  }
}

async function run() {
  const devServer = await startDevServerIfNeeded();
  const browser = await chromium.launch({ headless: HEADLESS, slowMo: 80 });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);

  try {
    await waitForReady(`${BASE_URL}/api/healthz`);
    await waitForReady(`${BASE_URL}/login`);
    await login(page);
    await page.goto(`${BASE_URL}/candidate-decisions`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="text-candidate-decisions-title"]');

    const titleText = await page.locator('[data-testid="text-candidate-decisions-title"]').textContent();
    console.log(`[candidate-decisions] title: ${titleText?.trim()}`);

    await page
      .waitForSelector('[data-testid="table-candidate-decisions"], [data-testid="text-no-candidate-decisions"]', {
        timeout: 10000,
      })
      .catch(() => {});
    const hasTable = await page.locator('[data-testid="table-candidate-decisions"]').isVisible().catch(() => false);
    const hasEmpty = await page.locator('[data-testid="text-no-candidate-decisions"]').isVisible().catch(() => false);
    if (!hasTable && !hasEmpty) {
      throw new Error("candidate decisions page did not render result area");
    }

    await page.locator('[data-testid="button-decision-refetch"]').click();
    await page.waitForTimeout(500);
    console.log("[candidate-decisions] refetch click success");

    // Keep browser open briefly in headful mode so humans can visually confirm.
    if (!HEADLESS && HOLD_MS > 0) {
      await page.waitForTimeout(HOLD_MS);
    }

    console.log("[candidate-decisions] success");
  } finally {
    await browser.close();
    stopDevServer(devServer);
  }
}

run().catch((error) => {
  console.error("[candidate-decisions] failed", error);
  process.exit(1);
});
