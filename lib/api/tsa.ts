// ── getTsaWait ─────────────────────────────────────────────────────
// A single security-wait estimate in minutes for use in server-side
// orchestration. Historical-only — see the TODO below. Hour-of-day is
// resolved in the AIRPORT's own local timezone, never the server's.

import { hourAtAirport, tzForAirport } from "@/lib/utils/time";
import { standardWaitMinutes } from "@/lib/tsaHistorical";

export interface TsaWaitResult {
  waitMinutes: number;
  source: "live" | "historical";
  note?: string;
}

// TODO(tsa-live-data): the only "live" TSA wait-time source this app has
// ever pointed at (tsawaittimes.com) is dead/unauthenticated, and there is
// no working TSA_API_KEY integration to replace it. Decision needed before
// beta: pay for a real TSA/airport data feed, or ship historical-only
// permanently and keep the UI copy honest about that (current state).
// This stub keeps the signature stable so a real provider can slot in
// without touching getTsaWait or any of its callers.
async function tryLiveTsaWait(_airport: string): Promise<{ waitMinutes: number } | null> {
  return null;
}

export async function getTsaWait(airport: string): Promise<TsaWaitResult> {
  const code = airport.toUpperCase().slice(0, 3);

  const live = await tryLiveTsaWait(code);
  if (live) return { waitMinutes: live.waitMinutes, source: "live" };

  const hour = hourAtAirport(code);
  const timeLabel = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: tzForAirport(code),
  });
  return {
    waitMinutes: standardWaitMinutes(code, hour),
    source:      "historical",
    note:        `Historical average for ${code} at ${timeLabel}`,
  };
}

// ── Legacy export (kept for existing callers: agent tool, Inngest monitor) ──

export interface TSAWaitTime {
  wait_minutes: number;
  fastest_lane: string;
  crowd_level: string;
  updated_at: string;
  /** Always "historical" — the live path is quarantined, see TODO above. */
  source: "historical";
}

export async function getWaitTime({
  airport,
  lane_type,
}: {
  airport: string;
  terminal: string;
  lane_type: string;
}): Promise<TSAWaitTime> {
  const result = await getTsaWait(airport);
  const crowd_level =
    result.waitMinutes < 6 ? "Low" : result.waitMinutes < 15 ? "Moderate" : "High";
  const fastest_lane =
    lane_type === "precheck" ? "TSA PreCheck" : lane_type === "clear" ? "CLEAR" : "Standard";

  return {
    wait_minutes: result.waitMinutes,
    fastest_lane,
    crowd_level,
    updated_at: result.note ?? "Historical estimate",
    source: "historical",
  };
}
