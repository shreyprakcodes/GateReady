// ── getTsaWait ─────────────────────────────────────────────────────
// A single security-wait estimate in minutes for use in server-side
// orchestration. Tries the live TSA API first; falls back to
// time-of-day historical averages if the key is missing or the call
// fails (the same model used by app/api/tsa/route.ts).

export interface TsaWaitResult {
  waitMinutes: number;
  source: "live" | "historical";
  note?: string;
}

// 24-value arrays indexed by hour (0 = midnight) — standard lane, minutes.
const HOURLY: Record<string, number[]> = {
  JFK: [5, 4, 3, 3, 6, 14, 28, 38, 32, 22, 16, 15, 18, 20, 22, 26, 32, 35, 28, 22, 16, 12, 9, 6],
  LAX: [6, 5, 4, 4, 7, 16, 30, 40, 35, 25, 18, 16, 18, 20, 22, 28, 34, 38, 30, 24, 18, 14, 10, 7],
  ORD: [5, 4, 3, 3, 6, 15, 30, 42, 38, 26, 18, 16, 20, 22, 24, 28, 35, 38, 30, 22, 16, 12, 9, 6],
  ATL: [5, 4, 3, 3, 7, 16, 32, 44, 40, 28, 20, 18, 22, 24, 26, 30, 36, 40, 32, 24, 18, 14, 10, 7],
  DFW: [5, 4, 3, 3, 6, 14, 28, 38, 34, 24, 18, 16, 20, 22, 24, 28, 34, 36, 28, 22, 16, 12, 9, 6],
  LGA: [4, 3, 3, 3, 6, 14, 26, 34, 30, 22, 16, 14, 16, 18, 20, 24, 30, 32, 26, 20, 14, 10, 8, 5],
  SFO: [5, 4, 3, 3, 6, 14, 26, 36, 32, 22, 16, 15, 17, 19, 21, 25, 31, 34, 27, 21, 15, 11, 8, 6],
  PHX: [4, 3, 3, 3, 5, 14, 16, 26, 35, 28, 16, 18, 20, 19, 20, 24, 26, 28, 38, 30, 14, 12, 10, 8],
  DEN: [4, 3, 3, 3, 5, 12, 22, 30, 26, 18, 14, 12, 14, 16, 18, 20, 25, 28, 22, 17, 12, 9, 7, 5],
  MCO: [5, 4, 3, 3, 6, 13, 24, 32, 28, 20, 15, 14, 16, 18, 20, 23, 28, 30, 24, 18, 13, 10, 7, 5],
  LAS: [5, 4, 3, 3, 6, 12, 20, 26, 22, 16, 13, 13, 16, 18, 20, 22, 26, 28, 24, 20, 15, 12, 9, 6],
  SEA: [4, 3, 3, 3, 5, 12, 22, 30, 26, 18, 14, 12, 14, 16, 18, 20, 25, 28, 22, 17, 12, 9, 7, 5],
  MIA: [5, 4, 3, 3, 6, 14, 26, 34, 30, 22, 16, 15, 18, 20, 22, 26, 32, 34, 27, 21, 15, 11, 8, 5],
  BOS: [4, 3, 3, 3, 5, 13, 24, 32, 28, 20, 15, 13, 15, 17, 19, 22, 27, 30, 24, 18, 13, 10, 7, 5],
};
const GENERIC: number[] = [
  5, 4, 3, 3, 5, 12, 22, 28, 24, 18, 14, 13,
  15, 17, 18, 20, 24, 26, 22, 18, 14, 11, 9, 7,
];

export async function getTsaWait(airport: string): Promise<TsaWaitResult> {
  const TSA_KEY = process.env.TSA_API_KEY;
  const code    = airport.toUpperCase().slice(0, 3);

  // Attempt live data when a key is configured
  if (TSA_KEY) {
    try {
      const url = `https://www.tsawaittimes.com/api/airports/${code}/waitTimes`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${TSA_KEY}` },
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      });
      if (res.ok) {
        const raw: unknown = await res.json();
        type RawCheckpoint = { lanes?: { laneType?: string; waitTime?: number }[] };
        const lanes = (Array.isArray(raw) ? (raw as RawCheckpoint[]) : [])
          .flatMap((c) => c.lanes ?? []);
        const stdLane = lanes.find(
          (l) =>
            !String(l.laneType ?? "").toLowerCase().includes("precheck") &&
            !String(l.laneType ?? "").toLowerCase().includes("clear"),
        );
        const minutes =
          typeof stdLane?.waitTime === "number" ? stdLane.waitTime : null;
        if (minutes !== null && minutes > 0) {
          return { waitMinutes: minutes, source: "live" };
        }
      }
    } catch {
      // Fall through to historical
    }
  }

  // Historical fallback keyed by current hour-of-day
  const hour    = new Date().getHours();
  const profile = HOURLY[code] ?? GENERIC;
  const timeLabel = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
  return {
    waitMinutes: profile[hour] ?? 15,
    source:      "historical",
    note:        `Historical average for ${code} at ${timeLabel}`,
  };
}

// ── Legacy export (kept for existing callers) ──────────────────────

export interface TSAWaitTime {
  wait_minutes: number;
  fastest_lane: string;
  crowd_level: string;
  updated_at: string;
}

function getMock(): TSAWaitTime {
  const base = 8;
  const variance = Math.floor(Math.random() * 4) - 2;
  const wait = Math.max(1, base + variance);
  const crowds = ["Low", "Moderate", "High"];
  return {
    wait_minutes: wait,
    fastest_lane: "Lane " + (Math.floor(Math.random() * 6) + 1),
    crowd_level: crowds[wait < 6 ? 0 : wait < 15 ? 1 : 2],
    updated_at: Math.floor(Math.random() * 5 + 1) + " min ago",
  };
}

export async function getWaitTime({
  airport,
  terminal,
  lane_type,
}: {
  airport: string;
  terminal: string;
  lane_type: string;
}): Promise<TSAWaitTime> {
  const TSA_KEY = process.env.TSA_API_KEY;

  if (!TSA_KEY || process.env.NODE_ENV === "development") {
    return getMock();
  }

  try {
    const url = `https://www.tsawaittimes.com/api/airports/${airport}/waitTimes`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TSA_KEY}` },
    });
    if (!res.ok) throw new Error(`TSA API ${res.status}`);
    const json = await res.json();

    const terminalData = json?.terminals?.find(
      (t: { name: string }) =>
        t.name?.toLowerCase() === terminal?.toLowerCase()
    );
    const laneData = terminalData?.lanes?.[lane_type];

    return {
      wait_minutes: laneData?.waitMinutes ?? getMock().wait_minutes,
      fastest_lane: laneData?.fastestLane ?? getMock().fastest_lane,
      crowd_level: laneData?.crowdLevel ?? getMock().crowd_level,
      updated_at: laneData?.updatedAt ?? getMock().updated_at,
    };
  } catch {
    return getMock();
  }
}
