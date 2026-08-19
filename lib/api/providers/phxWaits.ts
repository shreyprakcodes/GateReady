// PHX Sky Harbor live security wait times.
//
// Endpoint discovered by capturing the network traffic behind skyharbor.com's
// homepage widget — see scripts/discover-phx-waits.mjs for how, and the
// session notes for the raw response shape. The `Key` below is not a login
// or session credential: it's a static value shipped in every anonymous
// visitor's page bundle to power that public widget, so calling it directly
// server-side carries the same visibility as scraping the rendered page,
// just without a headless browser. If PHX ever rotates it, this silently
// falls back to the historical estimate (see fetchPhxLiveWaits below) —
// nothing breaks, someone just needs to re-run the discovery script.
//
// PHX-only. No other airport has a discovered live source.

import type { TsaLane } from "@/lib/tsaHistorical";

const PHX_WAITS_URL =
  "https://api.phx.aero/avn-wait-times/raw?Key=4f85fe2ef5a240d59809b63de94ef536";

// A reading older than this is treated as unavailable rather than shown as
// current — stale-but-labeled-live would be a worse honesty failure than
// just falling back to the historical estimate.
const MAX_LIVE_AGE_MS = 30 * 60 * 1000; // 30 minutes

// PHX's queueName strings → our display checkpoint names. Only "General"
// (standard) lanes are published live; there is no live PreCheck/CLEAR
// breakdown, so we don't fabricate one.
const QUEUE_NAMES: Record<string, string> = {
  "T3 General": "T3",
  "T4 Checkpoint A General": "T4 – Checkpoint A",
  "T4 Checkpoint B General": "T4 – Checkpoint B",
  "T4 Checkpoint C General": "T4 – Checkpoint C",
  "T4 Checkpoint D General": "T4 – Checkpoint D",
};

interface PhxRawQueue {
  queueName?: string;
  projectedWaitTime?: number; // seconds
  time?: string;              // ISO 8601 UTC — upstream's own reading timestamp
}

interface PhxRawResponse {
  current?: PhxRawQueue[];
}

export interface PhxLiveWaits {
  lanes: TsaLane[];
  /** Upstream's own "as of" timestamp for this reading, ISO 8601 UTC. */
  updatedAt: string;
}

/**
 * Fetch PHX's live per-checkpoint security wait times. Cached server-side
 * (Next.js Data Cache) for 60s so every user shares one upstream call.
 * Never throws — returns null on any failure, staleness, or unusable
 * response, and logs why, so callers can fall through to historical.
 */
export async function fetchPhxLiveWaits(): Promise<PhxLiveWaits | null> {
  try {
    const res = await fetch(PHX_WAITS_URL, {
      signal: AbortSignal.timeout(5_000),
      // Next.js Data Cache: one upstream request per 60s, shared across all
      // requests to this URL — not a per-user or per-request fetch.
      next: { revalidate: 60 },
      headers: {
        "User-Agent": "GateReady/1.0 (+https://gateready.app; TSA wait-time integration)",
      },
    });

    if (!res.ok) {
      console.warn(`[phxWaits] HTTP ${res.status} — falling back to historical`);
      return null;
    }

    const json = (await res.json()) as PhxRawResponse;
    const rows = json.current ?? [];

    const lanes: TsaLane[] = [];
    let latestTime: string | null = null;

    for (const row of rows) {
      const name = row.queueName ? QUEUE_NAMES[row.queueName] : undefined;
      if (!name || typeof row.projectedWaitTime !== "number") continue;

      lanes.push({
        name,
        type: "standard",
        waitMinutes: Math.max(0, Math.round(row.projectedWaitTime / 60)),
      });
      if (row.time && (!latestTime || row.time > latestTime)) latestTime = row.time;
    }

    if (lanes.length === 0 || !latestTime) {
      console.warn("[phxWaits] response had no usable checkpoint data — falling back to historical");
      return null;
    }

    const ageMs = Date.now() - new Date(latestTime).getTime();
    if (ageMs > MAX_LIVE_AGE_MS) {
      console.warn(`[phxWaits] reading is ${Math.round(ageMs / 60_000)} min stale — falling back to historical`);
      return null;
    }

    return { lanes, updatedAt: latestTime };
  } catch (err) {
    console.warn("[phxWaits] fetch failed — falling back to historical:", err instanceof Error ? err.message : err);
    return null;
  }
}
