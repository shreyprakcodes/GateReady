// AviationStack adapter — fallback when FlightAware is unavailable.
// Free plan: http:// only (https returns https_access_restricted);
// flight_date param is a paid feature (free plan returns function_access_restricted).

import type { NormalizedFlight } from "./types";

const AS_KEY = process.env.AVIATIONSTACK_API_KEY;

function normalize(f: Record<string, unknown>, requested: string): NormalizedFlight {
  const dep = f.departure as Record<string, unknown> | undefined;
  const arr = f.arrival   as Record<string, unknown> | undefined;
  const al  = f.airline   as Record<string, unknown> | undefined;
  const fl  = f.flight    as Record<string, unknown> | undefined;
  const airlineIata = (al?.iata as string | undefined) ?? requested.match(/^[A-Z]{2,3}/)?.[0] ?? "";
  return {
    flightNumber:        (fl?.iata  as string | undefined) ?? requested,
    airline:             airlineIata,
    airlineName:         (al?.name  as string | undefined) ?? null,
    departure_airport:   (dep?.iata as string | undefined) ?? null,
    departure_time:      (dep?.actual    as string | undefined)
                      ?? (dep?.estimated as string | undefined)
                      ?? (dep?.scheduled as string | undefined) ?? null,
    departure_scheduled: (dep?.scheduled as string | undefined) ?? null,
    departure_estimated: (dep?.estimated as string | undefined) ?? null,
    departure_actual:    (dep?.actual    as string | undefined) ?? null,
    arrival_airport:     (arr?.iata as string | undefined) ?? null,
    arrival_time:        (arr?.actual    as string | undefined)
                      ?? (arr?.estimated as string | undefined)
                      ?? (arr?.scheduled as string | undefined) ?? null,
    arrival_scheduled:   (arr?.scheduled as string | undefined) ?? null,
    arrival_estimated:   (arr?.estimated as string | undefined) ?? null,
    arrival_actual:      (arr?.actual    as string | undefined) ?? null,
    status:              (f.flight_status as string | undefined) ?? "scheduled",
    gate:                (dep?.gate      as string | undefined) ?? null,
    terminal:            (dep?.terminal  as string | undefined) ?? null,
    delay_minutes:       (dep?.delay     as number | undefined) ?? 0,
    departure_timezone:  (dep?.timezone  as string | undefined) ?? null,
    arrival_timezone:    (arr?.timezone  as string | undefined) ?? null,
    source:              "aviationstack",
    isSample:            false,
    raw:                 f,
  };
}

async function fetchAS(flight: string, date?: string): Promise<Response> {
  // Must use http:// — free plan blocks https with https_access_restricted (403).
  let url =
    `http://api.aviationstack.com/v1/flights` +
    `?access_key=${AS_KEY}` +
    `&flight_iata=${encodeURIComponent(flight)}`;
  if (date) url += `&flight_date=${encodeURIComponent(date)}`;
  console.log(`[aviationstack] GET flight=${flight} date=${date ?? "any"}`);
  return fetch(url, { cache: "no-store" });
}

async function parseASResponse(res: Response): Promise<{
  ok: boolean;
  json: Record<string, unknown>;
  errorCode: string | null;
}> {
  let json: Record<string, unknown> = {};
  try { json = await res.json(); } catch { /* empty or non-JSON body */ }
  const errObj    = json.error as Record<string, unknown> | undefined;
  const errorCode = (errObj?.code as string | undefined) ?? null;
  if (errorCode || !res.ok) {
    // Full body logged server-side only — never forwarded to client.
    console.warn("[aviationstack] error — HTTP", res.status, JSON.stringify(json, null, 2));
  }
  return { ok: res.ok && !errObj, json, errorCode };
}

/**
 * Look up a flight via AviationStack.
 * Returns an array of normalized flights, or null on key error / quota / any failure.
 */
export async function lookupAviationStack(
  flight: string,
  date: string,
): Promise<NormalizedFlight[] | null> {
  if (!AS_KEY) return null;

  try {
    // Attempt 1: with flight_date (paid feature — free plans reject it)
    let res = await fetchAS(flight, date || undefined);
    let { ok, json, errorCode } = await parseASResponse(res);

    // Free plan rejects flight_date → retry without it
    if (errorCode === "function_access_restricted") {
      console.log("[aviationstack] flight_date rejected (free plan) — retrying without it");
      res = await fetchAS(flight);
      ({ ok, json, errorCode } = await parseASResponse(res));
    }

    if (errorCode === "usage_limit_reached") {
      console.warn("[aviationstack] Monthly quota exhausted");
      return null;
    }
    if (errorCode === "invalid_access_key") {
      console.error("[aviationstack] Invalid API key — check AVIATIONSTACK_API_KEY in .env.local");
      return null;
    }
    if (errorCode === "https_access_restricted") {
      console.error("[aviationstack] https_access_restricted — adapter should use http://");
      return null;
    }
    if (!ok) {
      console.warn(`[aviationstack] Non-OK (code: ${errorCode ?? "none"})`);
      return null;
    }

    const data = (json.data as unknown[]) ?? [];
    if (data.length === 0) return null;

    return (data as Record<string, unknown>[]).map((f) => normalize(f, flight));
  } catch (err) {
    console.error("[aviationstack] fetch error:", err);
    return null;
  }
}
