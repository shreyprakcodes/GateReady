import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Read .env.local manually ──────────────────────────────────
const envPath = resolve(process.cwd(), ".env.local");
const envVars = {};
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 0) continue;
  envVars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

const SUPABASE_URL = envVars["NEXT_PUBLIC_SUPABASE_URL"] ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = envVars["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_EMAIL   = envVars["SCREENSHOT_USER_EMAIL"] ?? process.env.SCREENSHOT_USER_EMAIL;
const BASE         = "http://localhost:3000";
const OUT          = resolve(process.cwd(), "scripts/screenshots");

if (!SUPABASE_URL || !SERVICE_KEY || !USER_EMAIL) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SCREENSHOT_USER_EMAIL in .env.local");
  process.exit(1);
}

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
