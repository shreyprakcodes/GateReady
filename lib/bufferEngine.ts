// Pure, I/O-free buffer engine.
// Each rule contributes a signed adjustment stored in factors — this is the
// labeled breakdown that will train the ML model once actual outcomes are collected.

export interface BufferInput {
  baseBufferMinutes: number;        // user's arrival_buffer_minutes from their profile
  departureHour: number;            // 0–23 in departure airport local time
  airportIata: string | null;       // trip origin (e.g. "LAX")
  tripScope: string | null;         // "domestic" | "international" | "both" | null
  travelStressors: string[] | null; // from user profile
}

export interface BufferFactor {
  rule: string;
  adjustmentMinutes: number;
  reason: string;
}

export interface BufferResult {
  bufferMinutes: number;    // final buffer, clamped to [MIN_BUFFER, MAX_BUFFER]
  factors: BufferFactor[];  // full breakdown suitable for storing as rule_factors jsonb
}

// Sourced from lib/api/airport-map.ts (top 10 by traffic) + the 15 next-busiest US hubs.
// These airports have measurably longer security queues and gate-walk times.
const LARGE_HUB_IATA = new Set([
  "ATL", "DFW", "DEN", "ORD", "LAX", "JFK", "LAS", "MCO", "MIA", "CLT",
  "SEA", "PHX", "EWR", "SFO", "IAH", "BOS", "FLL", "MSP", "LGA", "DTW",
  "PHL", "SLC", "BWI", "IAD", "MDW",
]);

const MIN_BUFFER = 10;
const MAX_BUFFER = 90;

export function computeBuffer(input: BufferInput): BufferResult {
  const { baseBufferMinutes, departureHour, airportIata, tripScope, travelStressors } = input;
  const factors: BufferFactor[] = [];

  // ── Base ────────────────────────────────────────────────────────────────────
  factors.push({
    rule: "base",
    adjustmentMinutes: 0,
    reason: `User preferred buffer: ${baseBufferMinutes} min`,
  });

  // ── Time of day ─────────────────────────────────────────────────────────────
  if (departureHour >= 4 && departureHour <= 6) {
    factors.push({
      rule: "time_of_day_early_morning",
      adjustmentMinutes: 5,
      reason: "Early morning (4–6 am) — security staffing often lighter at open",
    });
  } else if (departureHour >= 22 || departureHour <= 3) {
    factors.push({
      rule: "time_of_day_late_night",
      adjustmentMinutes: -5,
      reason: "Late night / red-eye — airport typically quiet",
    });
  }

  // ── Airport tier ─────────────────────────────────────────────────────────────
  const iata = airportIata?.toUpperCase() ?? null;
  if (iata && LARGE_HUB_IATA.has(iata)) {
    factors.push({
      rule: "airport_tier_large_hub",
      adjustmentMinutes: 5,
      reason: `${iata} is a large hub — longer security queues and gate walks`,
    });
  }

  // ── Trip scope ───────────────────────────────────────────────────────────────
  if (tripScope === "international") {
    factors.push({
      rule: "trip_scope_international",
      adjustmentMinutes: 15,
      reason: "International departure — passport control and additional screening",
    });
  } else if (tripScope === "both") {
    factors.push({
      rule: "trip_scope_mixed",
      adjustmentMinutes: 5,
      reason: "Mixed traveler profile — conservative buffer for potential international leg",
    });
  }

  // ── Travel stressors ─────────────────────────────────────────────────────────
  const stressors = travelStressors ?? [];
  if (stressors.includes("security_lines")) {
    factors.push({
      rule: "stressor_security_lines",
      adjustmentMinutes: 5,
      reason: "Security lines flagged as a stressor",
    });
  }
  if (stressors.includes("when_to_leave")) {
    factors.push({
      rule: "stressor_when_to_leave",
      adjustmentMinutes: 5,
      reason: "Timing anxiety flagged — extra buffer to reduce stress",
    });
  }
  if (stressors.includes("traffic")) {
    factors.push({
      rule: "stressor_traffic",
      adjustmentMinutes: 5,
      reason: "Traffic flagged as a stressor — earlier departure preferred",
    });
  }

  const totalAdjustment = factors
    .filter((f) => f.rule !== "base")
    .reduce((sum, f) => sum + f.adjustmentMinutes, 0);

  const bufferMinutes = Math.max(
    MIN_BUFFER,
    Math.min(MAX_BUFFER, baseBufferMinutes + totalAdjustment),
  );

  return { bufferMinutes, factors };
}
