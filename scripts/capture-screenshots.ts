import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : 'http://localhost:5000';

const SCREENSHOTS_DIR = './attached_assets/guide_screenshots';

async function captureScreenshots() {
  // Create screenshots directory
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  console.log('Capturing screenshots...');

  // 1. Login page
  console.log('1. Capturing login page...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login.png` });

  // 2. Register page
  console.log('2. Capturing register page...');
  await page.goto(`${BASE_URL}/register`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-register.png` });

  // Register a test user
  const testEmail = `guide_test_${Date.now()}@test.com`;
  await page.fill('[data-testid="input-name"]', '테스트사용자');
  await page.fill('[data-testid="input-email"]', testEmail);
  await page.fill('[data-testid="input-password"]', 'TestPassword123!');
  await page.click('[data-testid="button-register"]');
  
  // Wait for redirect to dashboard
  await page.waitForURL('**/', { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState('networkidle');

  // 3. Dashboard
  console.log('3. Capturing dashboard...');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-dashboard.png` });

  // 4. Guide page
  console.log('4. Capturing guide page...');
  await page.goto(`${BASE_URL}/guide`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-guide.png` });

  // 5. Trading page
  console.log('5. Capturing trading page...');
  await page.goto(`${BASE_URL}/trading`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-trading.png` });

  // 6. AI Analysis page
  console.log('6. Capturing AI analysis page...');
  await page.goto(`${BASE_URL}/ai-analysis`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-ai-analysis.png` });

  // 7. Auto Trading page
  console.log('7. Capturing auto trading page...');
  await page.goto(`${BASE_URL}/auto-trading`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-auto-trading.png` });

  // 8. Portfolio page
  console.log('8. Capturing portfolio page...');
  await page.goto(`${BASE_URL}/portfolio`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-portfolio.png` });

  // 9. Trade History page
  console.log('9. Capturing trade history page...');
  await page.goto(`${BASE_URL}/trade-history`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-trade-history.png` });

  // 10. Watchlist page
  console.log('10. Capturing watchlist page...');
  await page.goto(`${BASE_URL}/watchlist`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-watchlist.png` });

  // 11. Settings page
  console.log('11. Capturing settings page...');
  await page.goto(`${BASE_URL}/settings`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-settings.png` });

  await browser.close();
  console.log('All screenshots captured successfully!');
}

captureScreenshots().catch(console.error);
