// FlightAware AeroAPI adapter.
// API reference: https://aeroapi.flightaware.com/aeroapi
// Auth: x-apikey header (NOT a query param).
// Free tier: $5/month credit, 10 req/min.

import type { NormalizedFlight } from "./types";

const FA_KEY  = process.env.FLIGHTAWARE_API_KEY;
const FA_BASE = "https://aeroapi.flightaware.com/aeroapi";

// Static IATA-code → display-name map for the airlines most likely to appear.
// FlightAware does not return airline names in the /flights response.
const AIRLINE_NAMES: Record<string, string> = {
  AA: "American Airlines",   DL: "Delta Air Lines",    UA: "United Airlines",
  WN: "Southwest Airlines",  B6: "JetBlue Airways",    AS: "Alaska Airlines",
  NK: "Spirit Airlines",     F9: "Frontier Airlines",  G4: "Allegiant Air",
  HA: "Hawaiian Airlines",   SY: "Sun Country Airlines",
  BA: "British Airways",     LH: "Lufthansa",           AF: "Air France",
  KL: "KLM",                 IB: "Iberia",              VS: "Virgin Atlantic",
  EK: "Emirates",            QR: "Qatar Airways",       EY: "Etihad Airways",
  TK: "Turkish Airlines",    SQ: "Singapore Airlines",  CX: "Cathay Pacific",
  JL: "Japan Airlines",      NH: "All Nippon Airways",  AC: "Air Canada",
  AM: "Aeromexico",          LA: "LATAM Airlines",      AV: "Avianca",
  CM: "Copa Airlines",       MX: "Mexicana",
};

// Map FlightAware's human-readable status string to our app's status enum.
// FA statuses look like "Scheduled", "En Route / On Time", "En Route / Late",
// "Landed", "Arrived", "Cancelled", "Unknown".
function mapStatus(
  faStatus: string,
  delaySecs: number | null,
  cancelled: boolean,
): string {
  if (cancelled) return "cancelled";
  const s = faStatus.toLowerCase();
  if (s.includes("cancel"))                          return "cancelled";
  if (s.includes("en route") || s.includes("airborne") || s.includes("active"))
    return (delaySecs ?? 0) > 300 ? "delayed" : "departed";
  if (s.includes("landed") || s.includes("arrived")) return "landed";
  if ((delaySecs ?? 0) > 300)                        return "delayed";
  return "scheduled";
}

// Returns the YYYY-MM-DD local date for a UTC ISO string in the given IANA timezone.
function toLocalDate(isoUtc: string, tz: string | null): string | null {
  if (!tz) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(isoUtc));
  } catch {
    return null;
  }
}

// Subset of FlightAware flight object fields we actually use.
// Field names are exact per the AeroAPI OpenAPI spec.
interface FAOrigin {
  code_iata: string | null;
  timezone:  string | null;
}
interface FAFlight {
  ident:            string;
  ident_iata:       string | null;
  operator_iata:    string | null;
  flight_number:    string | null;
  status:           string;
  origin:           FAOrigin | null;
  destination:      { code_iata: string | null; timezone: string | null } | null;
  scheduled_out:    string | null;  // gate departure — scheduled
  estimated_out:    string | null;  // gate departure — estimated
  actual_out:       string | null;  // gate departure — actual
  scheduled_in:     string | null;  // gate arrival — scheduled
  estimated_in:     string | null;  // gate arrival — estimated
  actual_in:        string | null;  // gate arrival — actual
  gate_origin:      string | null;
  terminal_origin:  string | null;
  departure_delay:  number | null;  // seconds; negative means early
  cancelled:        boolean;
}

function normalize(f: FAFlight, requestedIdent: string): NormalizedFlight {
  const airlineIata = f.operator_iata ?? requestedIdent.match(/^[A-Z]{2,3}/)?.[0] ?? "";

  // Effective departure/arrival = actual ?? estimated ?? scheduled
  const depTime = f.actual_out ?? f.estimated_out ?? f.scheduled_out ?? null;
  const arrTime = f.actual_in  ?? f.estimated_in  ?? f.scheduled_in  ?? null;

  const delaySecs = f.departure_delay ?? 0;
  const delayMins = delaySecs > 0 ? Math.round(delaySecs / 60) : 0;

  console.log(
    `[flightaware] normalize ${f.ident_iata ?? f.ident}` +
    ` scheduled_out=${f.scheduled_out} estimated_out=${f.estimated_out}` +
    ` actual_out=${f.actual_out} → depTime=${depTime}` +
    ` origin.timezone=${f.origin?.timezone ?? "(null)"}`,
  );

  return {
    flightNumber:        f.ident_iata ?? requestedIdent,
    airline:             airlineIata,
    airlineName:         AIRLINE_NAMES[airlineIata] ?? null,
    departure_airport:   f.origin?.code_iata ?? null,
    departure_time:      depTime,
    departure_scheduled: f.scheduled_out ?? null,
    departure_estimated: f.estimated_out ?? null,
    departure_actual:    f.actual_out    ?? null,
    arrival_airport:     f.destination?.code_iata ?? null,
    arrival_time:        arrTime,
    arrival_scheduled:   f.scheduled_in  ?? null,
    arrival_estimated:   f.estimated_in  ?? null,
    arrival_actual:      f.actual_in     ?? null,
    status:              mapStatus(f.status, f.departure_delay, f.cancelled),
    gate:                f.gate_origin ?? null,
    terminal:            f.terminal_origin ?? null,
    delay_minutes:       delayMins,
    departure_timezone:  f.origin?.timezone      ?? null,
    arrival_timezone:    f.destination?.timezone ?? null,
    source:              "flightaware",
    isSample:            false,
    raw:                 f,
  };
}

/**
 * Look up a flight by IATA ident (e.g. "AA123") and optional date (YYYY-MM-DD).
 * Returns an array of normalized flights, or null if the provider is
 * unavailable, rate-limited, or returns no results.
 */
export async function lookupFlightAware(
  flight: string,
  date: string,
): Promise<NormalizedFlight[] | null> {
  if (!FA_KEY) return null;

  try {
    let url = `${FA_BASE}/flights/${encodeURIComponent(flight)}?ident_type=designator`;
    if (date) {
      // ±12 h window around the requested date so late-evening local departures
      // whose UTC timestamp crosses midnight are still captured
      // (e.g. 10 PM EDT = 02:00 UTC next day).
      const startMs = new Date(date + "T12:00:00Z").getTime() - 24 * 60 * 60 * 1000;
      const endMs   = new Date(date + "T12:00:00Z").getTime() + 24 * 60 * 60 * 1000;
      url += `&start=${encodeURIComponent(new Date(startMs).toISOString())}` +
             `&end=${encodeURIComponent(new Date(endMs).toISOString())}`;
    }

    console.log(`[flightaware] GET /flights/${flight} date=${date || "any"}`);

    const res = await fetch(url, {
      headers: { "x-apikey": FA_KEY },
      cache:   "no-store",
    });

    if (res.status === 429) {
      console.warn("[flightaware] Rate limited (429) — falling through to next provider");
      return null;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[flightaware] HTTP ${res.status}: ${body.slice(0, 300)}`);
      return null;
    }

    const json = (await res.json()) as { flights?: FAFlight[] };
    const flights = json.flights ?? [];

    if (flights.length === 0) {
      console.log(`[flightaware] No results for ${flight} on ${date || "any"}`);
      return null;
    }

    console.log(`[flightaware] ${flights.length} result(s) for ${flight}`);

    // Filter to flights whose scheduled_out falls on the requested date in the
    // origin's local timezone.  Include flights with unknown timezone or missing
    // scheduled_out rather than dropping them.  Fall back to all results if
    // nothing passes the filter (e.g. timezone data missing for every flight).
    const matched = date
      ? flights.filter((f) => {
          const ref = f.scheduled_out ?? f.estimated_out;
          if (!ref) return true;
          const localD = toLocalDate(ref, f.origin?.timezone ?? null);
          return localD === null || localD === date;
        })
      : flights;

    const candidates = matched.length > 0 ? matched : flights;

    // Sort ascending by scheduled_out so the earliest departure on that day is [0].
    candidates.sort((a, b) => {
      const ta = a.scheduled_out ? new Date(a.scheduled_out).getTime() : 0;
      const tb = b.scheduled_out ? new Date(b.scheduled_out).getTime() : 0;
      return ta - tb;
    });

    return candidates.map((f) => normalize(f, flight));
  } catch (err) {
    console.error("[flightaware] fetch error:", err);
    return null;
  }
}
