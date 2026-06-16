import { chromium } from "playwright";
import { mkdir } from "fs/promises";

const SUPABASE_URL = "https://ovxxzefhtkrusdnvneks.supabase.co";
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92eHh6ZWZodGtydXNkbnZuZWtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE0OTQ5MCwiZXhwIjoyMDk2NzI1NDkwfQ.X4wS1nd0YJvWN0ytQqYpfqjEnnLhlt7RuqtIqLSJ3eU";
const USER_EMAIL   = "shreyashprakashescapes@gmail.com";
const BASE         = "http://localhost:3000";
const OUT          = "C:/Users/shrey/gateready/scripts/screenshots";

// 1. Generate a magic link via the Supabase Admin API
const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: {
    "apikey": SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ type: "magiclink", email: USER_EMAIL }),
});

if (!linkRes.ok) {
  console.error("Failed to generate magic link:", linkRes.status, await linkRes.text());
  process.exit(1);
}

const { action_link } = await linkRes.json();
console.log("Magic link generated (token hidden)");

// 2. Follow the Supabase verify URL to get tokens in the redirect hash
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx     = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page    = await ctx.newPage();
page.on("console", msg => { if (msg.type() === "error") console.error("PAGE:", msg.text()); });

await page.goto(action_link, { waitUntil: "networkidle", timeout: 20000 });
const hash = new URL(page.url()).hash.slice(1);
const p    = new URLSearchParams(hash);
const accessToken  = p.get("access_token");
const refreshToken = p.get("refresh_token");

if (!accessToken) {
  console.error("No access_token in redirect hash. URL:", page.url());
  await page.screenshot({ path: `${OUT}/dashboard.png` });
  await browser.close();
  process.exit(1);
}
console.log("Tokens extracted from redirect. Setting session via server route…");

// 3. Hit the debug signin route — it calls supabase.auth.setSession() server-side
//    so @supabase/ssr writes the proper auth cookies, then redirects to /
const signinUrl = `${BASE}/api/debug/signin?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;
await page.goto(signinUrl, { waitUntil: "networkidle", timeout: 20000 });
console.log("After signin route, URL:", page.url());

// 4. Screenshot the dashboard
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: false });
console.log("✓ Saved:", `${OUT}/dashboard.png`);
await browser.close();
