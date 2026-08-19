// ── getTsaWait ─────────────────────────────────────────────────────
// A single security-wait estimate in minutes for use in server-side
// orchestration. Historical-only — see the TODO below. Hour-of-day is
// resolved in the AIRPORT's own local timezone, never the server's.

import { hourAtAirport, tzForAirport } from "@/lib/utils/time";
import { standardWaitMinutes } from "@/lib/tsaHistorical";
import { fetchPhxLiveWaits } from "@/lib/api/providers/phxWaits";

export interface TsaWaitResult {
  waitMinutes: number;
  source: "live" | "historical";
  note?: string;
}

// TODO(tsa-live-data): PHX is the only airport with a discovered live
// source (lib/api/providers/phxWaits.ts, extracted from skyharbor.com's
// homepage widget). Every other airport still has no working live feed —
// the tsawaittimes.com endpoint this used to call is dead/unauthenticated,
// and there is no TSA_API_KEY integration to replace it with. Decision
// needed before beta: pay for a real TSA/airport data feed for non-PHX
// airports, or ship historical-only for them permanently. This stub keeps
// the signature stable so a real provider can slot in per-airport without
// touching getTsaWait or any of its callers.
async function tryLiveTsaWait(airport: string): Promise<{ waitMinutes: number; note: string } | null> {
  if (airport !== "PHX") return null;

  const live = await fetchPhxLiveWaits();
  if (!live) return null;

  const avgMinutes = Math.round(
    live.lanes.reduce((sum, l) => sum + l.waitMinutes, 0) / live.lanes.length,
  );
  const timeLabel = new Date(live.updatedAt).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: tzForAirport("PHX"),
  });
  return { waitMinutes: avgMinutes, note: `Live from PHX Sky Harbor · updated ${timeLabel}` };
}

export async function getTsaWait(airport: string): Promise<TsaWaitResult> {
  const code = airport.toUpperCase().slice(0, 3);

  const live = await tryLiveTsaWait(code);
  if (live) return { waitMinutes: live.waitMinutes, source: "live", note: live.note };

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
  /** "live" only for PHX when the upstream feed is fresh — see TODO above. */
  source: "live" | "historical";
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
    source: result.source,
  };
}
