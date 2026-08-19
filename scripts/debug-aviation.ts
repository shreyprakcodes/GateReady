/**
 * Manual timezone-pipeline trace for the FlightAware → DB → display path.
 *
 * Ported from the former app/api/debug/aviation/route.ts (removed — it was an
 * unauthenticated route that queried live user trip data via the service-role
 * key with no auth check; see the security audit that flagged it).
 *
 * Run manually:
 *   npx tsx scripts/debug-aviation.ts
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) read from .env.local — this
 * script talks directly to the DB and to FlightAware, outside the Next.js
 * request/auth pipeline entirely. Do not wire this back up as a route.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { lookupFlight } from "../lib/api/aviation";

// ── Load .env.local manually (this runs outside Next.js, which normally does this) ──
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 0) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  if (!(key in process.env)) process.env[key] = value;
}

const FA_KEY  = process.env.FLIGHTAWARE_API_KEY;
const FA_BASE = "https://aeroapi.flightaware.com/aeroapi";

interface FAOriginRaw {
  code_iata: string | null;
  timezone:  string | null; // IANA name, e.g. "America/New_York" — may be absent
  [k: string]: unknown;
}
interface FAFlightRaw {
  ident:         string;
  ident_iata:    string | null;
  scheduled_out: string | null;
  estimated_out: string | null;
  actual_out:    string | null;
  origin:        FAOriginRaw | null;
  destination:   FAOriginRaw | null;
  status:        string;
  [k: string]: unknown;
}

async function main() {
  const today = new Date().toISOString().split("T")[0];

  // ── STAGE A: RAW FlightAware response (before any transformation) ─────────

  let rawFlight: FAFlightRaw | null = null;
  let faHttpStatus = 0;

  if (FA_KEY) {
    const startMs = new Date(today + "T12:00:00Z").getTime() - 86_400_000;
    const endMs   = new Date(today + "T12:00:00Z").getTime() + 86_400_000;
    const url =
      `${FA_BASE}/flights/AA100?ident_type=designator` +
      `&start=${encodeURIComponent(new Date(startMs).toISOString())}` +
      `&end=${encodeURIComponent(new Date(endMs).toISOString())}`;

    const res = await fetch(url, { headers: { "x-apikey": FA_KEY }, cache: "no-store" });
    faHttpStatus = res.status;
    if (res.ok) {
      const j = (await res.json()) as { flights?: FAFlightRaw[] };
      rawFlight = j.flights?.[0] ?? null;
    }
  }

  const stageA = {
    fa_key_present:      !!FA_KEY,
    fa_http_status:      faHttpStatus,
    ident:               rawFlight?.ident_iata ?? rawFlight?.ident ?? "(no result)",
    scheduled_out:       rawFlight?.scheduled_out   ?? "(null)",
    estimated_out:       rawFlight?.estimated_out   ?? "(null)",
    actual_out:          rawFlight?.actual_out       ?? "(null)",
    "origin.code_iata":  rawFlight?.origin?.code_iata  ?? "(null)",
    "origin.timezone":   rawFlight?.origin?.timezone   ?? "(null — BUG SOURCE if null here)",
  };
  console.log("[tz-trace] STAGE A raw FA:", JSON.stringify(stageA, null, 2));

  // ── STAGE B: After adapter normalization ──────────────────────────────────
  // lookupFlight runs the same FA call internally; we use its return value.

  const { flights, source, isSample } = await lookupFlight("AA100", today);
  const norm = flights[0] ?? null;

  const stageB = {
    departure_time:     norm?.departure_time     ?? "(null)",
    departure_timezone: norm?.departure_timezone ?? "(null — BUG SOURCE if null here)",
    source,
    isSample,
    note: "adapter: depTime = estimated_out ?? scheduled_out; tz = origin?.timezone ?? null",
  };
  console.log("[tz-trace] STAGE B normalized:", JSON.stringify(stageB, null, 2));

  // ── STAGE C: Stored in trips table ───────────────────────────────────────
  // Queries existing AA100 rows so we can see what was actually written.
  // Uses the service-role key directly (not lib/supabase/server's
  // createServiceClient — that file also exports a next/headers-based client,
  // and importing it here would pull next/headers into a non-Next.js runtime).

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: dbRows, error: dbErr } = await db
    .from("trips")
    .select("id, flight_number, departure_time, departure_timezone, created_at")
    .ilike("flight_number", "AA100")
    .order("created_at", { ascending: false })
    .limit(5);

  const stageC = {
    column_type_departure_time:     "timestamptz  (migration 001_initial_schema.sql:35)",
    column_type_departure_timezone: "text         (migration 007_add_departure_timezone.sql)",
    rows: (dbRows ?? []).map((r) => ({
      id:                 r.id.slice(0, 8) + "…",
      departure_time:     r.departure_time,
      departure_timezone: r.departure_timezone,
      timezone_is_null:   r.departure_timezone === null,
      created_at:         r.created_at,
    })),
    db_error: dbErr?.message ?? null,
    hint:
      (dbRows ?? []).length === 0
        ? "⚠️  No AA100 rows found — add the flight then re-run this script"
        : (dbRows ?? []).some((r) => r.departure_timezone === null)
          ? "🔴 departure_timezone is NULL in DB row(s) — this IS the display bug"
          : "✅ departure_timezone is set in all DB rows",
  };
  console.log("[tz-trace] STAGE C DB rows:", JSON.stringify(stageC, null, 2));

  // ── STAGE D: What the trip API returns to the client ─────────────────────
  // The dashboard queries Supabase directly (no custom API route for trips).
  // Supabase JS returns timestamptz as ISO-8601 with explicit offset.

  const firstRow = dbRows?.[0] ?? null;
  const stageD = {
    note:
      "Dashboard: supabase.from('trips').select('*') — no server API route in between",
    departure_time_as_returned:  firstRow?.departure_time  ?? "(no row found)",
    departure_timezone_as_returned: firstRow?.departure_timezone ?? "(null or no row)",
    supabase_timestamptz_format_example: "2026-06-28T22:05:00+00:00",
  };
  console.log("[tz-trace] STAGE D API→client:", JSON.stringify(stageD, null, 2));

  // ── STAGE E: Component formatting ─────────────────────────────────────────
  // Simulates fmtFlightTime() from lib/utils/time.ts with / without tz.

  const simDep = firstRow?.departure_time ?? norm?.departure_time ?? null;
  const simTz  = firstRow?.departure_timezone ?? norm?.departure_timezone ?? null;

  const stageE: Record<string, unknown> = {
    input_iso:     simDep,
    timezone_used: simTz,
    fmtFlightTime_call:
      `fmtFlightTime(trip.departure_time, trip.departure_timezone)  // lib/utils/time.ts`,
  };

  if (simDep) {
    stageE["result_WITH_origin_tz"]   = new Date(simDep).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", hour12: true,
      ...(simTz ? { timeZone: simTz } : {}),
    });
    stageE["result_WITHOUT_tz_server"] = new Date(simDep).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", hour12: true,
    });
    stageE["utc_instant"] = new Date(simDep).toISOString();
    stageE["interpretation"] = simTz
      ? "✅ timezone present → will display correctly in origin local time"
      : "🔴 timezone null → falls back to server/browser local time → 3-hour shift in PDT browser";
  } else {
    stageE["note"] = "No departure_time available — add flight to DB first";
  }
  console.log("[tz-trace] STAGE E display:", JSON.stringify(stageE, null, 2));

  // ── Verdict ────────────────────────────────────────────────────────────────

  const faHasTz  = !!rawFlight?.origin?.timezone;
  const dbHasTz  = !!firstRow?.departure_timezone;
  const hasDbRow = (dbRows?.length ?? 0) > 0;

  let verdict: string;
  if (!FA_KEY) {
    verdict = "⚠️  No FLIGHTAWARE_API_KEY — results are sample data; add key to test real pipeline";
  } else if (!faHasTz) {
    verdict = "🔴 BUG AT STAGE A→B: FlightAware does not return origin.timezone for AA100. " +
      "The timezone is null at the adapter and propagates null into the DB and display.";
  } else if (!hasDbRow) {
    verdict = "⚠️  FlightAware returns timezone but no AA100 row exists in DB yet. " +
      "Add the flight, then re-run this script to confirm stages C–E.";
  } else if (!dbHasTz) {
    verdict = "🔴 BUG AT STAGE B→C: FA returns origin.timezone but DB row has null. " +
      "The save route was missing departure_timezone when this row was inserted. " +
      "Delete the trip and re-add it — or run a backfill UPDATE.";
  } else {
    verdict = "🟡 Stages A–C look correct. Bug is at stage D→E: check that " +
      "trip.departure_timezone is threaded to every fmtFlightTime() call in components.";
  }

  console.log("\n[tz-trace] VERDICT:", verdict);
}

main().catch((err) => {
  console.error("[tz-trace] script threw:", err);
  process.exit(1);
});
