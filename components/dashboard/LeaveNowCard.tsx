"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, MapPin, Navigation, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store/useStore";
import { useUserLocation } from "@/src/hooks/useUserLocation";

// ─── Design tokens ────────────────────────────────────────────────

const NAVY = "#07101F";
const TEAL = "#00D4B8";

const STATUS_CFG = {
  "on-time":    { color: TEAL,      bg: `${TEAL}18`,      label: "On Time"       },
  "leave-soon": { color: "#F5A623", bg: "#F5A62318",      label: "Leave Soon"    },
  "leave-now":  { color: "#FF6B00", bg: "#FF6B0018",      label: "Leave Now!"    },
  "late":       { color: "#FF4444", bg: "#FF444418",      label: "Running Late"  },
} as const;

// ─── Types ────────────────────────────────────────────────────────

type LeaveStatus = keyof typeof STATUS_CFG;

interface LeaveNowData {
  recommendedLeaveTime: string;
  minutesUntilLeave:    number;
  status:               LeaveStatus;
  segments:             { label: string; minutes: number }[];
  inputs: {
    drive: {
      minutes:     number;
      isLive:      boolean;
      note?:       string;
      unavailable?: boolean;   // true when user is far from the departure airport
      distanceKm?: number;
    };
    tsa:        { minutes: number; source: string; note?: string };
    walkToGate: { minutes: number };
    buffer:     { minutes: number };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
}

function formatCountdown(ms: number): string {
  if (ms <= 0) {
    const mins = Math.round(Math.abs(ms) / 60_000);
    // Cap absurd "late" values — anything > 3 h past the leave time means
    // either the flight has already departed or the data is stale.
    if (mins > 180) return "—";
    return mins < 1 ? "NOW" : `${mins}m late`;
  }
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Sub-component: breakdown row ─────────────────────────────────

function BreakdownRow({
  icon, label, minutes, estimated,
}: {
  icon: string; label: string; minutes: number; estimated?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base leading-none shrink-0">{icon}</span>
        <span className="text-sm truncate" style={{ color: "#94A3B8" }}>{label}</span>
        {estimated && (
          <span
            className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
            style={{ backgroundColor: "#162030", color: "#6B8DB0" }}
          >
            est
          </span>
        )}
      </div>
      <span className="text-sm font-bold shrink-0" style={{ color: "#E2E8F0" }}>
        {minutes} min
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────

export function LeaveNowCard() {
  const trip = useStore((s) => s.getActiveFlight());
  const { lat, lng, permissionState, isLoading: locLoading, requestPermission } =
    useUserLocation();

  const [data, setData]           = useState<LeaveNowData | null>(null);
  const [fetching, setFetching]   = useState(false);
  const [fetchErr, setFetchErr]   = useState<string | null>(null);
  const [countdown, setCountdown] = useState("--:--");

  const abortRef    = useRef<AbortController | null>(null);
  const hadCoordsRef = useRef(false);

  const fetchLeaveNow = useCallback(async (coordLat?: number, coordLng?: number) => {
    if (!trip?.departure_time) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setFetching(true);
    setFetchErr(null);

    try {
      const body: Record<string, unknown> = { tripId: trip.id };
      if (typeof coordLat === "number" && typeof coordLng === "number") {
        body.lat = coordLat;
        body.lng = coordLng;
      }

      const res = await fetch("/api/leave-now", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
        signal:  ctrl.signal,
      });

      const json = await res.json();
      if (!res.ok) { setFetchErr(json.error ?? "Could not compute leave time"); return; }
      setData(json as LeaveNowData);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setFetchErr("Could not compute leave time");
      }
    } finally {
      setFetching(false);
    }
  }, [trip?.id, trip?.departure_time]);

  // Initial fetch (no coords yet — returns estimated drive time)
  useEffect(() => {
    fetchLeaveNow();
    return () => abortRef.current?.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch the moment real coordinates first become available
  useEffect(() => {
    if (lat !== null && lng !== null && !hadCoordsRef.current) {
      hadCoordsRef.current = true;
      fetchLeaveNow(lat, lng);
    }
  }, [lat, lng, fetchLeaveNow]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const id = setInterval(() => {
      fetchLeaveNow(
        hadCoordsRef.current && lat !== null ? lat : undefined,
        hadCoordsRef.current && lng !== null ? lng : undefined,
      );
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchLeaveNow, lat, lng]);

  // Live countdown ticker
  useEffect(() => {
    if (!data) return;
    const leaveAt = new Date(data.recommendedLeaveTime).getTime();
    const tick = () => setCountdown(formatCountdown(leaveAt - Date.now()));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [data]);

  if (!trip?.departure_time) return null;

  // When the countdown is capped ("> 3 h late"), use a neutral colour so we
  // don't blast a red "Running Late" for what is likely a stale data state.
  const staleData = countdown === "—";
  const cfg = data
    ? staleData
      ? { color: "#6B8DB0", bg: "#6B8DB018", label: "Check flight details" }
      : STATUS_CFG[data.status] ?? STATUS_CFG["on-time"]
    : STATUS_CFG["on-time"];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: NAVY, boxShadow: `0 4px 24px rgba(0,212,184,0.08)` }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: `${TEAL}80` }}
          >
            Leave Now Engine
          </p>
          <div className="flex items-center gap-2">
            {(fetching || locLoading) && (
              <Loader2 className="h-3 w-3 animate-spin" style={{ color: TEAL }} />
            )}
            <button
              onClick={() => fetchLeaveNow(
                hadCoordsRef.current && lat !== null ? lat : undefined,
                hadCoordsRef.current && lng !== null ? lng : undefined,
              )}
              className="h-6 w-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#162030" }}
              aria-label="Refresh"
            >
              <RefreshCw className="h-3 w-3" style={{ color: "#6B8DB0" }} />
            </button>
          </div>
        </div>

        {fetchErr ? (
          <div className="flex items-center gap-2 py-1">
            <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#FF4444" }} />
            <p className="text-sm" style={{ color: "#FF4444" }}>{fetchErr}</p>
          </div>
        ) : data ? (
          <>
            {/* Leave time + countdown */}
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs mb-0.5" style={{ color: "#4A6580" }}>Leave by</p>
                <p
                  className="text-4xl font-bold tracking-tight"
                  style={{ color: "#FFFFFF", fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {fmtTime(data.recommendedLeaveTime)}
                </p>
              </div>
              <div className="text-right pb-0.5">
                <p className="text-xs mb-0.5" style={{ color: "#4A6580" }}>in</p>
                <p
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: cfg.color, fontFamily: "monospace" }}
                >
                  {countdown}
                </p>
              </div>
            </div>

            {/* Status pill */}
            <div className="mt-3">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: cfg.color,
                    animation: data.status !== "on-time" ? "pulse 1.5s infinite" : undefined,
                  }}
                />
                {cfg.label}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: TEAL }} />
            <p className="text-sm" style={{ color: "#4A6580" }}>Computing best leave time…</p>
          </div>
        )}
      </div>

      {/* ── Breakdown ──────────────────────────────────────────── */}
      {data && (
        <div
          className="px-5 py-4 space-y-2.5"
          style={{ borderTop: "1px solid #162030" }}
        >
          {data.inputs.drive.unavailable ? (
            /* User is far from the departure airport — drive routing skipped */
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none shrink-0">🚗</span>
                <span className="text-sm truncate" style={{ color: "#94A3B8" }}>
                  Drive to airport
                </span>
              </div>
              <span className="text-sm font-bold shrink-0" style={{ color: "#4A6580" }}>
                N/A
              </span>
            </div>
          ) : (
            <BreakdownRow
              icon="🚗"
              label="Drive to airport"
              minutes={data.inputs.drive.minutes}
              estimated={!data.inputs.drive.isLive}
            />
          )}
          {data.inputs.drive.unavailable && data.inputs.drive.note && (
            <p className="text-[11px] leading-relaxed" style={{ color: "#4A6580" }}>
              {data.inputs.drive.note}
            </p>
          )}
          <BreakdownRow
            icon="🛡️"
            label="Security"
            minutes={data.inputs.tsa.minutes}
            estimated={data.inputs.tsa.source !== "live"}
          />
          <BreakdownRow icon="🚶" label="Walk to gate" minutes={data.inputs.walkToGate.minutes} />
          <BreakdownRow icon="⏱" label="Buffer"       minutes={data.inputs.buffer.minutes}     />
        </div>
      )}

      {/* ── Location state footer ──────────────────────────────── */}
      {permissionState === "denied" && (
        <div
          className="px-5 py-3 flex items-center gap-2"
          style={{ borderTop: "1px solid #162030" }}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "#4A6580" }} />
          <p className="text-xs" style={{ color: "#4A6580" }}>
            Drive time is estimated — enable location for live traffic
          </p>
        </div>
      )}

      {permissionState === "prompt" && lat === null && (
        <div
          className="px-5 py-3 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid #162030" }}
        >
          <div className="flex items-center gap-2">
            <Navigation className="h-3.5 w-3.5 shrink-0" style={{ color: TEAL }} />
            <p className="text-xs" style={{ color: "#4A6580" }}>
              Share location for live traffic
            </p>
          </div>
          <button
            onClick={requestPermission}
            className="text-xs font-bold px-3 py-1 rounded-full shrink-0"
            style={{ backgroundColor: `${TEAL}20`, color: TEAL }}
          >
            Allow
          </button>
        </div>
      )}
    </div>
  );
}
