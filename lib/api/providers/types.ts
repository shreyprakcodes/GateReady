// Shared normalized flight shape produced by every provider adapter.
// The lookup route re-exports this type so app/api/flights/save/route.ts
// keeps its existing import path unchanged.

export type FlightSource = "flightaware" | "aviationstack" | "sample";

export interface NormalizedFlight {
  flightNumber: string;
  airline: string;            // IATA airline code  (e.g. "AA")
  airlineName: string | null;
  departure_airport: string | null;   // IATA airport code
  departure_time: string | null;      // ISO 8601; effective = actual ?? estimated ?? scheduled
  departure_scheduled: string | null; // raw scheduled gate departure from provider
  departure_estimated: string | null; // raw estimated gate departure from provider
  departure_actual:    string | null; // raw actual gate departure from provider
  arrival_airport: string | null;
  arrival_time: string | null;        // ISO 8601; effective = actual ?? estimated ?? scheduled
  arrival_scheduled: string | null;   // raw scheduled gate arrival from provider
  arrival_estimated: string | null;   // raw estimated gate arrival from provider
  arrival_actual:    string | null;   // raw actual gate arrival from provider
  status: string;
  gate: string | null;
  terminal: string | null;
  delay_minutes: number;
  departure_timezone: string | null;  // IANA name for origin airport, e.g. "America/New_York"
  arrival_timezone: string | null;    // IANA name for destination airport
  source: FlightSource;
  isSample: boolean;
  raw: unknown;
}

// Last-resort placeholder used when all live providers fail.
// Departure is set to the later of noon-UTC on the requested date OR 4 h from now
// so the Leave Now engine always sees a future flight and produces sensible numbers.
export function makeSampleFlight(flightNum: string, date: string): NormalizedFlight {
  const match      = flightNum.match(/^([A-Z]{2,3})/);
  const airline    = match?.[1] ?? flightNum.slice(0, 2);
  const noonOnDate = new Date(`${date}T14:00:00.000Z`).getTime();
  const minFuture  = Date.now() + 4 * 60 * 60 * 1000;
  const dep        = new Date(Math.max(noonOnDate, minFuture)).toISOString();
  const arr        = new Date(new Date(dep).getTime() + 3 * 60 * 60 * 1000).toISOString();
  return {
    flightNumber:      flightNum,
    airline,
    airlineName:       null,
    departure_airport: null,
    departure_time:      dep,
    departure_scheduled: null,
    departure_estimated: null,
    departure_actual:    null,
    arrival_airport:     null,
    arrival_time:        arr,
    arrival_scheduled:   null,
    arrival_estimated:   null,
    arrival_actual:      null,
    status:              "scheduled",
    gate:                null,
    terminal:            null,
    delay_minutes:       0,
    departure_timezone:  null,
    arrival_timezone:    null,
    source:              "sample",
    isSample:          true,
    raw:               {},
  };
}
