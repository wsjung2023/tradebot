import { chromium } from "playwright";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";
const EMAIL = process.env.TEST_EMAIL || "test@test.com";
const PASSWORD = process.env.TEST_PASSWORD || "12345678";
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS === "1";
const HOLD_MS = Number(process.env.PLAYWRIGHT_HOLD_MS || "3000");

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
  const browser = await chromium.launch({ headless: HEADLESS, slowMo: 80 });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);

  try {
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
  }
}

run().catch((error) => {
  console.error("[candidate-decisions] failed", error);
  process.exit(1);
});
