// Single source of truth for TSA historical wait-time curves.
// lib/api/tsa.ts and app/api/tsa/route.ts both import from here — do not
// re-add a copy of these tables in either file; that duplication is exactly
// what let a future per-airport correction land in one and not the other.

export interface HistoricalWait {
  standard: number;
  precheck: number;
  clear: number;
}

// Shared lane shape used by both historical and live TSA sources, so
// app/api/tsa/route.ts and lib/api/providers/phxWaits.ts speak the same type.
export type TsaLaneType = "standard" | "precheck" | "clear";

export interface TsaLane {
  name: string;
  type: TsaLaneType;
  waitMinutes: number;
}

// 24-value arrays indexed by LOCAL hour-of-day at the airport (0 = midnight).
// Standard lane wait in minutes. Derived from TSA published checkpoint data
// and traveler reports.
const GENERIC_STANDARD: number[] = [
  5, 4, 3, 3, 5, 12, 22, 28, 24, 18, 14, 13,
  15, 17, 18, 20, 24, 26, 22, 18, 14, 11, 9, 7,
];

const AIRPORT_PROFILES: Record<string, number[]> = {
  // Busy hub airports — higher peaks
  JFK: [5, 4, 3, 3, 6, 14, 28, 38, 32, 22, 16, 15, 18, 20, 22, 26, 32, 35, 28, 22, 16, 12, 9, 6],
  LAX: [6, 5, 4, 4, 7, 16, 30, 40, 35, 25, 18, 16, 18, 20, 22, 28, 34, 38, 30, 24, 18, 14, 10, 7],
  ORD: [5, 4, 3, 3, 6, 15, 30, 42, 38, 26, 18, 16, 20, 22, 24, 28, 35, 38, 30, 22, 16, 12, 9, 6],
  ATL: [5, 4, 3, 3, 7, 16, 32, 44, 40, 28, 20, 18, 22, 24, 26, 30, 36, 40, 32, 24, 18, 14, 10, 7],
  DFW: [5, 4, 3, 3, 6, 14, 28, 38, 34, 24, 18, 16, 20, 22, 24, 28, 34, 36, 28, 22, 16, 12, 9, 6],
  // Mid-sized busy airports
  LGA: [4, 3, 3, 3, 6, 14, 26, 34, 30, 22, 16, 14, 16, 18, 20, 24, 30, 32, 26, 20, 14, 10, 8, 5],
  EWR: [4, 3, 3, 3, 6, 13, 24, 32, 28, 20, 15, 13, 15, 17, 19, 22, 28, 30, 24, 18, 13, 10, 7, 5],
  SFO: [5, 4, 3, 3, 6, 14, 26, 36, 32, 22, 16, 15, 17, 19, 21, 25, 31, 34, 27, 21, 15, 11, 8, 6],
  BOS: [4, 3, 3, 3, 5, 13, 24, 32, 28, 20, 15, 13, 15, 17, 19, 22, 27, 30, 24, 18, 13, 10, 7, 5],
  MIA: [5, 4, 3, 3, 6, 14, 26, 34, 30, 22, 16, 15, 18, 20, 22, 26, 32, 34, 27, 21, 15, 11, 8, 5],
  DEN: [4, 3, 3, 3, 5, 12, 22, 30, 26, 18, 14, 12, 14, 16, 18, 20, 25, 28, 22, 17, 12, 9, 7, 5],
  SEA: [4, 3, 3, 3, 5, 12, 22, 30, 26, 18, 14, 12, 14, 16, 18, 20, 25, 28, 22, 17, 12, 9, 7, 5],
  // PHX Sky Harbor – T2/T3/T4. Ranges: 5-7am 12-18, 7-10am 22-35, 10am-2pm 15-22,
  //                               2-5pm 18-28, 5-8pm 25-38, 8pm+ 8-15
  PHX: [4, 3, 3, 3, 5, 14, 16, 26, 35, 28, 16, 18, 20, 19, 20, 24, 26, 28, 38, 30, 14, 12, 10, 8],
  MCO: [5, 4, 3, 3, 6, 13, 24, 32, 28, 20, 15, 14, 16, 18, 20, 23, 28, 30, 24, 18, 13, 10, 7, 5],
  LAS: [5, 4, 3, 3, 6, 12, 20, 26, 22, 16, 13, 13, 16, 18, 20, 22, 26, 28, 24, 20, 15, 12, 9, 6],
};

/** Airports with a per-terminal breakdown, relative to the base standard wait. */
export const TERMINAL_LANES: Record<string, { label: string; offset: number }[]> = {
  PHX: [
    { label: "Terminal 2 – Standard", offset: -1 },
    { label: "Terminal 3 – Standard", offset: 0 },
    { label: "Terminal 4 – Standard", offset: 2 }, // largest terminal, highest volume
  ],
};

/** Standard-lane wait in minutes for an airport at a given local hour (0–23). */
export function standardWaitMinutes(airport: string, hourOfDay: number): number {
  const profile = AIRPORT_PROFILES[airport.toUpperCase()] ?? GENERIC_STANDARD;
  return profile[hourOfDay] ?? 15;
}

/** Standard + PreCheck + CLEAR wait estimates for an airport at a given local hour. */
export function historicalWait(airport: string, hourOfDay: number): HistoricalWait {
  const std = standardWaitMinutes(airport, hourOfDay);
  return {
    standard: std,
    precheck: Math.max(2, Math.round(std * 0.25)),
    clear:    Math.min(4, Math.max(2, Math.round(std * 0.10))),
  };
}
