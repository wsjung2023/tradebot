import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";

const EXTERNAL_BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
const DEV_PORT = Number(process.env.PORT || 5000);
const BASE_URL = EXTERNAL_BASE_URL || `http://127.0.0.1:${DEV_PORT}`;
const EMAIL = process.env.TEST_EMAIL || "test@test.com";
const PASSWORD = process.env.TEST_PASSWORD || "12345678";
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "0";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function expectTruthy(value, message) {
  if (!value) {
    throw new Error(message);
  }
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
  throw new Error(`Server did not become ready: ${url}`);
}

async function startDevServerIfNeeded() {
  if (EXTERNAL_BASE_URL) return null;
  if (await isHttpReady(`${BASE_URL}/api/healthz`)) {
    console.log(`[ai-functional] reusing existing server: ${BASE_URL}`);
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
  } catch {
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

async function goAiAnalysis(page) {
  await page.goto(`${BASE_URL}/ai-analysis`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="text-ai-title"]', { timeout: 15000 });
}

async function testStockAnalysisTab(page) {
  console.log("[ai-functional] TC1 종목 분석 탭");
  await page.locator('[data-testid="tab-stock-analysis"]').click();

  await page.route("**/api/stocks/search?q=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { stockCode: "005930", stockName: "삼성전자", currentPrice: 80500, marketName: "KOSPI" },
      ]),
    });
  });

  await page.route("**/api/stocks/005930/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ name: "삼성전자", marketName: "KOSPI", currentPrice: 80500 }),
    });
  });

  await page.route("**/api/stocks/005930/price", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stockName: "삼성전자", currentPrice: 80500 }),
    });
  });

  await page.route("**/api/ai/analyze-stock", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action: "hold",
        confidence: 72,
        targetPrice: 89000,
        reasoning: "현재는 박스권이라 추격매수보다 분할 관찰이 유리합니다.",
        indicators: {
          trend: "neutral",
          momentum: "weak",
          support: 78000,
          resistance: 86000,
        },
      }),
    });
  });

  await page.locator('[data-testid="input-stock-code"]').fill("삼성");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /삼성전자/ }).first().click();
  await page.locator('[data-testid="button-analyze-stock"]').click();

  await page.waitForSelector('[data-testid="card-analysis-result"]', { timeout: 10000 });
  const reasoning = await page.locator("text=현재는 박스권이라 추격매수보다 분할 관찰이 유리합니다.").isVisible();
  expectTruthy(reasoning, "종목 분석 의견이 렌더링되지 않았습니다.");

  const confidenceText = (await page.locator('[data-testid="card-analysis-result"]').textContent()) || "";
  expectTruthy(confidenceText.includes("72.0%"), "신뢰도 표기가 72.0%가 아닙니다.");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-testid="button-download-stock-markdown"]').click(),
  ]);
  const filename = download.suggestedFilename();
  expectTruthy(filename.endsWith(".md"), "종목 분석 Markdown 다운로드 파일 확장자가 .md가 아닙니다.");

  await page.unroute("**/api/stocks/search?q=*");
  await page.unroute("**/api/stocks/005930/info");
  await page.unroute("**/api/stocks/005930/price");
  await page.unroute("**/api/ai/analyze-stock");
}

async function testPortfolioAnalysisTab(page) {
  console.log("[ai-functional] TC2 포트폴리오 분석 탭");
  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: 9001, accountNumber: "81208166", accountName: "모의투자" }]),
    });
  });
  await page.route("**/api/ai/analyze-portfolio", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        overallStrategy: "대형주 코어 비중을 유지하고 변동성 높은 종목은 비중을 축소하세요.",
        riskAssessment: "소수 종목 집중도가 높아 단기 변동 리스크가 큽니다.",
        recommendations: [
          { stockCode: "005930", stockName: "삼성전자", action: "hold", reason: "실적 안정성이 높아 코어 보유에 적합" },
        ],
      }),
    });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="tab-portfolio-analysis"]').click();
  await page.locator('[data-testid="select-account"]').click();
  await page.getByRole("option", { name: /81208166/ }).click();
  await page.locator('[data-testid="button-analyze-portfolio"]').click();

  await page.waitForSelector('[data-testid="card-portfolio-result"]', { timeout: 10000 });
  expectTruthy(
    await page.locator("text=대형주 코어 비중을 유지하고 변동성 높은 종목은 비중을 축소하세요.").isVisible(),
    "포트폴리오 전체 전략이 렌더링되지 않았습니다.",
  );

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-testid="button-download-portfolio-markdown"]').click(),
  ]);
  const filename = download.suggestedFilename();
  expectTruthy(filename.endsWith(".md"), "포트폴리오 Markdown 다운로드 파일 확장자가 .md가 아닙니다.");

  await page.unroute("**/api/accounts");
  await page.unroute("**/api/ai/analyze-portfolio");
}

async function testIntegratedAnalysisTab(page) {
  console.log("[ai-functional] TC3 통합 분석 탭");
  await page.route("**/api/stocks/search?q=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { stockCode: "005930", stockName: "삼성전자", currentPrice: 81200, marketName: "KOSPI" },
      ]),
    });
  });
  await page.route("**/api/stocks/005930/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ name: "삼성전자", marketName: "KOSPI", currentPrice: 81200 }),
    });
  });
  await page.route("**/api/stocks/005930/price", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stockName: "삼성전자", currentPrice: 81200 }),
    });
  });
  await page.route("**/api/stocks/005930/sync-materials", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        snapshotId: 1234,
        stockCode: "005930",
        stockName: "삼성전자",
        newsCount: 10,
        filingCount: 4,
        issueCount: 2,
        collectedAt: new Date().toISOString(),
        reused: true,
      }),
    });
  });
  await page.route("**/api/ai/integrated-analysis", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        newsScore: 64,
        financialScore: 71,
        technicalScore: 58,
        totalScore: 65,
        action: "hold",
        confidence: 67,
        targetPrice: 92000,
        newsSentiment: "neutral",
        newsAnalysis: "중립 뉴스가 우세하고 단기 모멘텀은 제한적입니다.",
        financialAnalysis: "재무지표는 안정적이며 밸류에이션 부담은 제한적입니다.",
        technicalAnalysis: "단기 박스권 흐름으로 추세 확인이 더 필요합니다.",
        summary: "현재 구간은 무리한 추격보다 분할 접근이 적절합니다.",
        risks: ["거래량 둔화", "박스권 하단 이탈 가능성"],
        catalysts: ["반도체 업황 개선", "외국인 수급 유입"],
        news: { articles: [], fetchedAt: new Date().toISOString() },
        financialRatios: { per: "12.3", pbr: "1.1", eps: "4000", bps: "45000", roe: "10.2" },
        filings: [],
        marketIssues: [],
        materialSnapshotId: 1234,
        materialSync: {
          triggered: false,
          reused: true,
          snapshotId: 1234,
          collectedAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.locator('[data-testid="tab-integrated-analysis"]').click();
  expectTruthy(
    !(await page.locator('[data-testid="input-integrated-stock-name"]').isVisible().catch(() => false)),
    "통합 분석에서 구식 종목명 입력 필드가 남아 있습니다.",
  );

  await page.locator('[data-testid="input-integrated-stock-code"]').fill("삼성");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /삼성전자/ }).first().click();

  await page.locator('[data-testid="button-sync-materials"]').click();
  await page.locator('[data-testid="input-integrated-price"]').fill("81200");
  await page.locator('[data-testid="button-integrated-analyze"]').click();

  await page.waitForSelector('[data-testid="text-integrated-summary"]', { timeout: 10000 });
  expectTruthy(
    await page.locator("text=현재 구간은 무리한 추격보다 분할 접근이 적절합니다.").isVisible(),
    "통합 분석 요약이 렌더링되지 않았습니다.",
  );

  expectTruthy(
    await page.locator("text=재료 동기화: 최근 30분 내 저장된 재료가 있으면 재사용하고, 없으면 뉴스/공시/이슈를 새로 수집합니다.").isVisible(),
    "재료 동기화 설명 문구가 보이지 않습니다.",
  );

  await page.unroute("**/api/stocks/search?q=*");
  await page.unroute("**/api/stocks/005930/info");
  await page.unroute("**/api/stocks/005930/price");
  await page.unroute("**/api/stocks/005930/sync-materials");
  await page.unroute("**/api/ai/integrated-analysis");
}

async function run() {
  const devServer = await startDevServerIfNeeded();
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    await waitForReady(`${BASE_URL}/api/healthz`);
    await login(page);
    await goAiAnalysis(page);

    await testStockAnalysisTab(page);
    await testPortfolioAnalysisTab(page);
    await testIntegratedAnalysisTab(page);

    console.log("[ai-functional] success");
  } finally {
    await context.close();
    await browser.close();
    stopDevServer(devServer);
  }
}

run().catch((error) => {
  console.error("[ai-functional] failed", error);
  process.exit(1);
});

