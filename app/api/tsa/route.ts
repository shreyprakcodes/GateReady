import { NextRequest, NextResponse } from "next/server";
import { hourAtAirport, tzForAirport } from "@/lib/utils/time";
import { historicalWait, TERMINAL_LANES, type TsaLane } from "@/lib/tsaHistorical";
import { fetchPhxLiveWaits } from "@/lib/api/providers/phxWaits";

export type { TsaLane } from "@/lib/tsaHistorical";
export type TsaSource = "live" | "historical";

export interface TsaWaitData {
  airport: string;
  lanes: TsaLane[];
  source: TsaSource;
  fetchedAt: string;
  /** Only present when source === "historical" */
  historicalNote?: string;
  /** Only present when source === "live" — upstream's own reading timestamp (ISO) */
  liveUpdatedAt?: string;
}

// TODO(tsa-live-data): PHX is the only airport with a discovered live
// source (lib/api/providers/phxWaits.ts) — see lib/api/tsa.ts for the full
// decision writeup on why every other airport is still historical-only.
async function tryLiveTsa(airport: string): Promise<{ lanes: TsaLane[]; updatedAt: string } | null> {
  if (airport !== "PHX") return null;
  const live = await fetchPhxLiveWaits();
  if (!live) return null;
  return { lanes: live.lanes, updatedAt: live.updatedAt };
}

// ── Main handler ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const airport = (request.nextUrl.searchParams.get("airport") ?? "JFK").toUpperCase().slice(0, 3);
  const fetchedAt = new Date().toISOString();

  // 1. Attempt live data
  const live = await tryLiveTsa(airport);

  if (live) {
    const data: TsaWaitData = {
      airport,
      lanes: live.lanes,
      source: "live",
      fetchedAt,
      liveUpdatedAt: live.updatedAt,
    };
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  // 2. Fall back to historical averages for this hour, in the AIRPORT's
  //    own local timezone — not the server's.
  const tz = tzForAirport(airport);
  const now = new Date();
  const hourOfDay = hourAtAirport(airport, now);
  const avgs = historicalWait(airport, hourOfDay);

  const terminalDef = TERMINAL_LANES[airport];

  const historicalLanes: TsaLane[] = terminalDef
    ? [
        ...terminalDef.map((t) => ({
          name: t.label,
          type: "standard" as const,
          waitMinutes: Math.max(1, avgs.standard + t.offset),
        })),
        { name: "TSA PreCheck", type: "precheck" as const, waitMinutes: avgs.precheck },
        { name: "CLEAR",        type: "clear" as const,    waitMinutes: avgs.clear    },
      ]
    : [
        { name: "Standard",     type: "standard" as const, waitMinutes: avgs.standard },
        { name: "TSA PreCheck", type: "precheck" as const, waitMinutes: avgs.precheck },
        { name: "CLEAR",        type: "clear" as const,    waitMinutes: avgs.clear    },
      ];

  const timeLabel = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });

  const data: TsaWaitData = {
    airport,
    lanes: historicalLanes,
    source: "historical",
    fetchedAt,
    historicalNote: `Live data unavailable · Estimates based on historical averages for ${airport} at ${timeLabel}`,
  };

  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
