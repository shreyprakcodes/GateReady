// ONE-OFF DIAGNOSTIC — not part of the app. Discovers the network request(s)
// that populate PHX Sky Harbor's live security wait-time widget, so we know
// what lib/api/providers/phxWaits.ts should call directly (server-side, no
// headless browser at request time).
//
// Usage: node scripts/discover-phx-waits.mjs

import { chromium } from "playwright";

const TARGET = "https://www.skyharbor.com/";
const URL_HINT = /wait|queue|checkpoint|security/i;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const hits = [];

  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    const looksRelevant = URL_HINT.test(url) || /json|xml/i.test(ct);
    if (!looksRelevant) return;

    let bodySample = null;
    try {
      const buf = await res.body();
      bodySample = buf.toString("utf-8").slice(0, 2000);
    } catch (e) {
      bodySample = `<body read failed: ${e.message}>`;
    }

    hits.push({
      url,
      method: res.request().method(),
      status: res.status(),
      contentType: ct,
      requestHeaders: res.request().headers(),
      bodySample,
    });
  });

  console.log(`Navigating to ${TARGET} ...`);
  await page.goto(TARGET, { waitUntil: "networkidle", timeout: 45_000 }).catch((e) => {
    console.error("goto networkidle failed/timed out:", e.message);
  });

  // Give late XHRs (polling widgets, deferred fetches) a few more seconds.
  await page.waitForTimeout(8_000);

  await browser.close();

  console.log(`\n=== ${hits.length} candidate response(s) ===\n`);
  for (const h of hits) {
    console.log("─".repeat(80));
    console.log(`${h.method} ${h.url}`);
    console.log(`status: ${h.status}  content-type: ${h.contentType}`);
    console.log(`request headers: ${JSON.stringify(h.requestHeaders, null, 2)}`);
    console.log(`body sample:\n${h.bodySample}`);
  }
  if (hits.length === 0) {
    console.log("No candidate responses matched. The data may be embedded in an inline <script> tag instead of a network request — rerun with a broader hint or inspect page.content() manually.");
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
