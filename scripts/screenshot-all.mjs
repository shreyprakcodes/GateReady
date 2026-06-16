import { chromium } from "playwright";
import { readFileSync } from "fs";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT  = "C:/Users/shrey/gateready/scripts/screenshots";
mkdirSync(OUT, { recursive: true });

// Read magic-link credentials from .env.local for admin API
const env = Object.fromEntries(
  readFileSync("C:/Users/shrey/gateready/.env.local", "utf8")
    .split("\n").filter(l => l.includes("="))
    .map(l => { const [k,...v] = l.split("="); return [k.trim(), v.join("=").trim()]; })
);

const SUPABASE_URL      = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE_KEY  = env["SUPABASE_SERVICE_ROLE_KEY"];
const USER_EMAIL        = "shreyashprakashescapes@gmail.com";

// Generate magic link
const mgResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "apikey": SERVICE_ROLE_KEY, "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
  body: JSON.stringify({ type: "magiclink", email: USER_EMAIL }),
});
const mgData = await mgResp.json();
const verifyUrl = mgData.action_link;
if (!verifyUrl) { console.error("No link", mgData); process.exit(1); }

const browser = await chromium.launch();
const ctx     = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page    = await ctx.newPage();

// Auth via debug signin
const tmpPage = await ctx.newPage();
await tmpPage.goto(verifyUrl, { waitUntil: "networkidle" });
const hash = new URL(tmpPage.url()).hash;
const hp   = new URLSearchParams(hash.slice(1));
const at   = hp.get("access_token");
const rt   = hp.get("refresh_token");
if (!at) { console.error("No tokens in", tmpPage.url()); process.exit(1); }
await tmpPage.close();

await page.goto(`${BASE}/api/debug/signin?access_token=${at}&refresh_token=${rt}`, { waitUntil: "networkidle" });

const PAGES = [
  { path: "/",           name: "dashboard"    },
  { path: "/routes",     name: "routes"       },
  { path: "/itinerary",  name: "itinerary"    },
  { path: "/agent",      name: "agent"        },
  { path: "/food",       name: "food"         },
  { path: "/preferences",name: "preferences"  },
  { path: "/family",     name: "family"       },
];

for (const { path, name } of PAGES) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`✓ ${name}`);
}

await browser.close();
