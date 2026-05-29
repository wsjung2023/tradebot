import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";

const EXTERNAL_BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
const DEV_PORT = Number(process.env.PORT || 5000);
const BASE_URL = EXTERNAL_BASE_URL || `http://127.0.0.1:${DEV_PORT}`;
const EMAIL = process.env.TEST_EMAIL || "test@test.com";
const PASSWORD = process.env.TEST_PASSWORD || "12345678";
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS === "1";
const HOLD_MS = Number(process.env.PLAYWRIGHT_HOLD_MS || "2000");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isHttpReady(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForReady(url, maxAttempts = 120) {
  for (let i = 0; i < maxAttempts; i += 1) {
    if (await isHttpReady(url)) return;
    await wait(500);
  }
  throw new Error(`Server not ready: ${url}`);
}

async function startDevServerIfNeeded() {
  if (EXTERNAL_BASE_URL) return null;
  const health = `${BASE_URL}/api/healthz`;
  if (await isHttpReady(health)) {
    console.log(`[monitoring-war-room] reusing existing server: ${BASE_URL}`);
    return null;
  }

  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "npm";
  const args = isWin ? ["/c", "npm", "run", "dev"] : ["run", "dev"];
  const child = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(DEV_PORT), NODE_ENV: "development" },
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
  } catch {
    // noop
  }
}

async function login(page) {
  await ensureTestAccount();
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  const emailInput = page.locator('[data-testid="input-email"]');
  const visible = await emailInput.isVisible().catch(() => false);
  if (!visible) {
    if (page.url().includes("/login")) throw new Error("login form not visible");
    return;
  }

  await emailInput.fill(EMAIL);
  await page.locator('[data-testid="input-password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  if (page.url().includes("/login")) throw new Error("login failed");
}

async function ensureMonitorJobRunning(page) {
  await page.goto(`${BASE_URL}/admin-jobs`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="card-job-ops-monitor"]', { timeout: 15000 });

  const status = page.locator('[data-testid="status-job-ops-monitor"]');
  const statusText = (await status.textContent()) || "";
  if (statusText.includes("중지")) {
    await page.locator('[data-testid="button-start-ops-monitor"]').click();
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="status-job-ops-monitor"]');
      return el?.textContent?.includes("실행중");
    }, { timeout: 10000 });
  }

  // Set to 5 seconds for fast live updates in test.
  const intervalInput = page.locator('[data-testid="input-interval-ops-monitor"]');
  await intervalInput.fill("5");
  await page.locator('[data-testid="button-apply-interval-ops-monitor"]').click();
  await page.waitForTimeout(1000);
}

async function verifyMonitoringWarRoom(page) {
  await page.goto(`${BASE_URL}/monitoring`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="text-monitoring-title"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="badge-monitor-job"]');
  await page.waitForSelector('[data-testid="card-anomalies"]');
  await page.waitForSelector('[data-testid="card-ai-traces"]');
  await page.waitForSelector('[data-testid="card-job-runtime"]');
  await page.waitForSelector('[data-testid="card-monitoring-thresholds"]');

  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="badge-monitor-job"]');
    return el?.textContent?.includes("ON");
  }, { timeout: 15000 });

  const monitorBadge = (await page.locator('[data-testid="badge-monitor-job"]').textContent()) || "";
  if (!monitorBadge.includes("ON")) {
    throw new Error(`monitor badge is not ON: ${monitorBadge}`);
  }

  await page.locator('[data-testid="button-refresh-situation-room"]').click();
  await page.waitForTimeout(1500);
  const streamBadge = (await page.locator('[data-testid="badge-stream-status"]').textContent()) || "";
  console.log(`[monitoring-war-room] stream badge: ${streamBadge.trim()}`);

  const thresholdInput = page.locator('[data-testid="input-threshold-aiErrorRateWarnPct"]');
  await thresholdInput.fill("37.5");
  await page.locator('[data-testid="button-save-thresholds"]').click();
  await page.waitForTimeout(1500);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="input-threshold-aiErrorRateWarnPct"]', { timeout: 15000 });
  await page.waitForFunction(() => {
    const input = document.querySelector('[data-testid="input-threshold-aiErrorRateWarnPct"]');
    return input && Number.isFinite(Number(input.value)) && Math.abs(Number(input.value) - 37.5) <= 0.1;
  }, { timeout: 15000 });
  const savedValue = await page.locator('[data-testid="input-threshold-aiErrorRateWarnPct"]').inputValue();
  const numericSaved = Number(savedValue);
  if (!Number.isFinite(numericSaved) || Math.abs(numericSaved - 37.5) > 0.1) {
    throw new Error(`threshold persistence check failed: ${savedValue}`);
  }
  console.log(`[monitoring-war-room] threshold persisted: ${savedValue}`);
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
    await ensureMonitorJobRunning(page);
    await verifyMonitoringWarRoom(page);
    if (!HEADLESS && HOLD_MS > 0) await page.waitForTimeout(HOLD_MS);
    console.log("[monitoring-war-room] success");
  } finally {
    await browser.close();
    stopDevServer(devServer);
  }
}

run().catch((error) => {
  console.error("[monitoring-war-room] failed", error);
  process.exit(1);
});
