import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE = 'http://localhost:3000';
const OUT  = 'C:/Users/shrey/gateready/scripts/screenshots';

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx     = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone 14 viewport
const page    = await ctx.newPage();

const snap = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`✓ ${name}`);
};

// Collect console errors
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(err.message));

// ── 1. Dashboard ──────────────────────────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 20000 });
await snap('01-dashboard');

// ── 2. Agent chat ─────────────────────────────────────────────────
await page.goto(`${BASE}/agent`, { waitUntil: 'networkidle', timeout: 10000 });
await snap('02-agent-empty');

// Type a message and hit send
await page.fill('input[placeholder*="TSA"]', 'What is the TSA wait at LAX Terminal 2?');
await snap('02b-agent-typed');
await page.click('button[class*="blue"]');
// Wait for response (allow up to 30s for Claude tool loop)
await page.waitForSelector('[class*="AgentMessage"], [class*="tool"]', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2000);
await snap('02c-agent-response');

// ── 3. Itinerary ──────────────────────────────────────────────────
await page.goto(`${BASE}/itinerary`, { waitUntil: 'networkidle', timeout: 10000 });
await snap('03-itinerary');

// ── 4. Onboarding ─────────────────────────────────────────────────
await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle', timeout: 10000 });
await snap('04-onboarding-manual');

// Switch to boarding pass tab
await page.click('button:has-text("Boarding Pass")');
await snap('04b-onboarding-pkpass');

// Switch to Gmail tab
await page.click('button:has-text("Gmail")');
await snap('04c-onboarding-gmail');

// ── 5. Preferences ───────────────────────────────────────────────
await page.goto(`${BASE}/preferences`, { waitUntil: 'networkidle', timeout: 10000 });
await snap('05-preferences');

await browser.close();

if (errors.length) {
  console.log('\n⚠ Console errors:');
  [...new Set(errors)].forEach(e => console.log(' ', e));
} else {
  console.log('\n✓ No console errors');
}

console.log('\nScreenshots saved to', OUT);
