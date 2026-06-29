// Flight data orchestrator.
// Provider priority: FlightAware → AviationStack → labeled sample data.
// Exports:
//   lookupFlight()    — full normalized result for the Add-Flight flow
//   getFlightStatus() — legacy shape kept for Inngest poller + agent tool-handlers

import { lookupFlightAware }   from "./providers/flightaware";
import { lookupAviationStack } from "./providers/aviationstack";
import { makeSampleFlight, type NormalizedFlight, type FlightSource } from "./providers/types";

// ── Orchestrator ──────────────────────────────────────────────────────────────

export interface LookupResult {
  flights:  NormalizedFlight[];
  source:   FlightSource;
  isSample: boolean;
}

/**
 * Look up flights for the given IATA ident + date (YYYY-MM-DD).
 * Tries FlightAware first, falls back to AviationStack, then sample data.
 * Never throws — always returns a result the caller can render.
 */
export async function lookupFlight(flight: string, date: string): Promise<LookupResult> {
  // 1. FlightAware (primary — live, free tier included)
  const faFlights = await lookupFlightAware(flight, date);
  if (faFlights && faFlights.length > 0) {
    console.log(`[aviation] source=flightaware  flight=${flight}`);
    return { flights: faFlights, source: "flightaware", isSample: false };
  }

  // 2. AviationStack (fallback)
  const asFlights = await lookupAviationStack(flight, date);
  if (asFlights && asFlights.length > 0) {
    console.log(`[aviation] source=aviationstack  flight=${flight}`);
    return { flights: asFlights, source: "aviationstack", isSample: false };
  }

  // 3. Sample data — clearly labeled so the UI banner appears
  console.warn(`[aviation] source=sample  flight=${flight} (all providers failed/exhausted)`);
  return {
    flights:  [makeSampleFlight(flight, date)],
    source:   "sample",
    isSample: true,
  };
}

// ── Legacy FlightStatus shape ─────────────────────────────────────────────────
// Kept unchanged so lib/inngest/pollFlightStatus.ts and lib/agent/tool-handlers.ts
// compile without any modifications.

export interface FlightStatus {
  status:                  string;
  gate:                    string;
  terminal:                string;
  delay_minutes:           number;
  scheduled_departure:     string;  // effective departure (actual ?? estimated ?? scheduled)
  arrival_time:            string | null;
  boarding_time:           string;
  aircraft:                string;
  airline:                 string | null;
  origin:                  string | null;
  destination:             string | null;
  departure_timezone:      string | null;
  departure_scheduled_iso: string | null;
  departure_estimated_iso: string | null;
  departure_actual_iso:    string | null;
  arrival_scheduled_iso:   string | null;
  arrival_estimated_iso:   string | null;
  arrival_actual_iso:      string | null;
}

function deriveBoardingTime(iso: string): string {
  // Boards 30 min before gate departure
  return new Date(new Date(iso).getTime() - 30 * 60 * 1000).toISOString();
}

function toFlightStatus(f: NormalizedFlight): FlightStatus {
  const dep = f.departure_time ?? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  return {
    status:                  f.status,
    gate:                    f.gate     ?? "TBD",
    terminal:                f.terminal ?? "TBD",
    delay_minutes:           f.delay_minutes,
    scheduled_departure:     dep,
    arrival_time:            f.arrival_time ?? null,
    boarding_time:           deriveBoardingTime(dep),
    aircraft:                "Unknown",
    airline:                 f.airlineName ?? f.airline ?? null,
    origin:                  f.departure_airport ?? null,
    destination:             f.arrival_airport  ?? null,
    departure_timezone:      f.departure_timezone ?? null,
    departure_scheduled_iso: f.departure_scheduled ?? null,
    departure_estimated_iso: f.departure_estimated ?? null,
    departure_actual_iso:    f.departure_actual    ?? null,
    arrival_scheduled_iso:   f.arrival_scheduled   ?? null,
    arrival_estimated_iso:   f.arrival_estimated   ?? null,
    arrival_actual_iso:      f.arrival_actual      ?? null,
  };
}

/**
 * Backward-compatible status check used by the Inngest poller and agent tools.
 * Internally uses the same provider chain as lookupFlight().
 */
export async function getFlightStatus({
  flight_number,
  date,
}: {
  flight_number: string;
  date: string;
}): Promise<FlightStatus> {
  const { flights } = await lookupFlight(flight_number, date);
  return toFlightStatus(flights[0]);
}
