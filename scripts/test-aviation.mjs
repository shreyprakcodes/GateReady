/**
 * node scripts/test-aviation.mjs
 * Directly tests the AviationStack API call — bypasses Next.js.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// ── 1. Read .env.local manually ──────────────────────────────────
const envPath = resolve(process.cwd(), ".env.local");
const envVars = {};
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 0) continue;
  envVars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

const KEY = envVars["AVIATIONSTACK_API_KEY"] ?? process.env.AVIATIONSTACK_API_KEY;

// ── 2. Report key status ─────────────────────────────────────────
console.log("\n=== 1. API KEY ===");
if (!KEY) {
  console.error("❌ AVIATIONSTACK_API_KEY is missing or empty");
  process.exit(1);
}
console.log(`✓  Key present: ${KEY.slice(0, 6)}${"*".repeat(KEY.length - 6)}`);

// ── 3. Report URL ────────────────────────────────────────────────
const FLIGHT = "AA100";
const url = `https://api.aviationstack.com/v1/flights?access_key=${KEY}&flight_iata=${encodeURIComponent(FLIGHT)}`;
console.log("\n=== 2. URL BEING CALLED ===");
console.log(url.replace(KEY, "<KEY>"));

// ── 4. Make the call ─────────────────────────────────────────────
console.log("\n=== 3. API RESPONSE ===");
try {
  const res = await fetch(url);
  console.log(`HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("❌ Non-JSON body:", text.slice(0, 500));
    process.exit(1);
  }

  if (!res.ok) {
    console.error("❌ API error:", JSON.stringify(json, null, 2));
    process.exit(1);
  }

  // Full raw response
  console.log("\nFull response JSON:");
  console.log(JSON.stringify(json, null, 2));

  // ── 5. What aviation.ts would return ─────────────────────────
  console.log("\n=== 4. PARSED OUTPUT ===");
  const flight = json?.data?.[0];
  if (!flight) {
    console.warn("⚠  data[0] is empty — getMock() would be called");
  } else {
    const scheduledDeparture =
      flight.departure?.scheduled ?? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const boardingTime = new Date(
      new Date(flight.departure?.estimated ?? scheduledDeparture).getTime() - 30 * 60 * 1000
    ).toISOString();
    console.log({
      status:              flight.flight_status,
      gate:                flight.departure?.gate,
      terminal:            flight.departure?.terminal,
      delay_minutes:       flight.departure?.delay,
      scheduled_departure: scheduledDeparture,
      boarding_time:       boardingTime,
      aircraft:            flight.aircraft?.iata,
    });
  }
} catch (err) {
  console.error("❌ fetch threw:", err.message);
  process.exit(1);
}
