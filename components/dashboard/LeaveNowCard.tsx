"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, MapPin, Navigation, RefreshCw } from "lucide-react";
import { formatDuration } from "@/lib/utils/time";
import { useStore } from "@/lib/store/useStore";
import { useUserLocation } from "@/src/hooks/useUserLocation";
import { getAirlineTheme } from "@/lib/airlineThemes";
import { computeLeaveTime } from "@/lib/leaveNow";
import type { BufferFactor } from "@/lib/bufferEngine";

// ─── Design tokens ────────────────────────────────────────────────

const STATUS_CFG = {
  "on-time":    { color: "#00C48C", bg: "#E8FAF5", label: "On Time"       },
  "leave-soon": { color: "#D97706", bg: "#FEF3C7", label: "Leave Soon"    },
  "leave-now":  { color: "#EA580C", bg: "#FFF1E6", label: "Leave Now!"    },
  "late":       { color: "#DC2626", bg: "#FEE2E2", label: "Running Late"  },
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
      minutes:      number;
      isLive:       boolean;
      note?:        string;
      unavailable?: boolean;
      distanceKm?:  number;
      source?:      "gps" | "home" | "none";
    };
    tsa:        { minutes: number; source: string; note?: string };
    walkToGate: { minutes: number };
    buffer:     { minutes: number; factors?: BufferFactor[] };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

function fmtTime(iso: string | Date) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
}

// One-line rationale for the "On Time" tier — the largest-magnitude
// non-base rule factor, already computed and logged by the buffer engine.
function topFactorReason(factors: BufferFactor[]): string | null {
  const nonBase = factors.filter((f) => f.rule !== "base");
  if (!nonBase.length) return null;
  const top = nonBase.reduce((a, b) =>
    Math.abs(b.adjustmentMinutes) > Math.abs(a.adjustmentMinutes) ? b : a
  );
  return top.reason;
}

const COMFORTABLE_OFFSET_MIN     = 20;
const CUTTING_IT_CLOSE_OFFSET_MIN = -15;
const COMFORTABLE_RATIONALE      = "+20 min — extra cushion for the unexpected";
const CUTTING_IT_CLOSE_RATIONALE = "-15 min — the tightest margin that still works";

function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  if (ms <= 0) {
    const mins = Math.round(Math.abs(ms) / 60_000);
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
  icon, label, minutes, estimated, live,
}: {
  icon: string; label: string; minutes: number; estimated?: boolean; live?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base leading-none shrink-0">{icon}</span>
        <span className="text-sm truncate" style={{ color: "#8B8070" }}>{label}</span>
        {live ? (
          <span
            className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
            style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#10B981" }}
          >
            live
          </span>
        ) : estimated && (
          <span
            className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
            style={{ backgroundColor: "#F0EDE8", color: "#8B8070" }}
          >
            est
          </span>
        )}
      </div>
      <span className="text-sm font-bold shrink-0" style={{ color: "#1A1A2E" }}>
        {formatDuration(minutes)}
      </span>
    </div>
  );
}

// ─── Sub-component: secondary tier row ────────────────────────────

function TierRow({
  label, color, time, countdown, rationale,
}: {
  label: string; color: string; time: string; countdown: string; rationale: string;
}) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ backgroundColor: `${color}12`, border: `1px solid ${color}30` }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color }}>
        {label}
      </p>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-base font-bold"
          style={{ color: "#1A1A2E", fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {time}
        </span>
        <span className="text-xs font-bold tabular-nums shrink-0" style={{ color }}>
          {countdown}
        </span>
      </div>
      <p className="text-[10px] mt-1 leading-snug" style={{ color: "#8B8070" }}>
        {rationale}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────

export function LeaveNowCard({ onDataLoaded }: { onDataLoaded?: (data: LeaveNowData) => void } = {}) {
  const trip = useStore((s) => s.getActiveFlight());
  const { lat, lng, permissionState, isLoading: locLoading, requestPermission } =
    useUserLocation();

  const [data, setData]           = useState<LeaveNowData | null>(null);
  const [fetching, setFetching]   = useState(false);
  const [fetchErr, setFetchErr]   = useState<string | null>(null);
  const [countdowns, setCountdowns] = useState({
    comfortable: "--:--", onTime: "--:--", cuttingItClose: "--:--",
  });

  const abortRef    = useRef<AbortController | null>(null);
  const hadCoordsRef = useRef(false);

  // Derive accent from airline for the header label
  const airlineCode = trip?.flight_number?.match(/^([A-Z]{2,3})/)?.[1] ?? null;
  const accentColor = getAirlineTheme(airlineCode).primary;

  // Three-tier leave window — reuses the unmodified, pure computeLeaveTime()
  // with the same live drive/tsa/walk inputs, varying only the buffer offset.
  // The base buffer (data.inputs.buffer.minutes) is untouched — it's the same
  // number already logged to trip_predictions by the API route.
  const tiers = useMemo(() => {
    if (!data || !trip?.departure_time) return null;
    const shared = {
      departureTime:     new Date(trip.departure_time),
      driveMinutes:      data.inputs.drive.minutes,
      tsaMinutes:        data.inputs.tsa.minutes,
      walkToGateMinutes: data.inputs.walkToGate.minutes,
    };
    const baseBuffer = data.inputs.buffer.minutes;
    return {
      comfortable: computeLeaveTime({
        ...shared, userBufferMinutes: baseBuffer + COMFORTABLE_OFFSET_MIN,
      }),
      onTime: computeLeaveTime({
        ...shared, userBufferMinutes: baseBuffer,
      }),
      cuttingItClose: computeLeaveTime({
        ...shared, userBufferMinutes: Math.max(0, baseBuffer + CUTTING_IT_CLOSE_OFFSET_MIN),
      }),
    };
  }, [data, trip?.departure_time]);

  const onTimeRationale = data
    ? topFactorReason(data.inputs.buffer.factors ?? []) ?? "Matches your saved travel preferences"
    : "";

  // Bounds how long a hung request can leave the card stuck on "Computing…" —
  // distinguished from an intentional abort (re-fetch / unmount) below so only
  // a real timeout surfaces an error to the user.
  const FETCH_TIMEOUT_MS = 15_000;

  const fetchLeaveNow = useCallback(async (coordLat?: number, coordLng?: number) => {
    if (!trip?.departure_time) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, FETCH_TIMEOUT_MS);

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
      const leaveData = json as LeaveNowData;
      setData(leaveData);
      onDataLoaded?.(leaveData);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        if (timedOut) setFetchErr("Taking longer than expected — tap refresh to retry");
      } else {
        setFetchErr("Could not compute leave time");
      }
    } finally {
      clearTimeout(timeoutId);
      setFetching(false);
    }
  }, [trip?.id, trip?.departure_time]);

  useEffect(() => {
    fetchLeaveNow();
    return () => abortRef.current?.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lat !== null && lng !== null && !hadCoordsRef.current) {
      hadCoordsRef.current = true;
      fetchLeaveNow(lat, lng);
    }
  }, [lat, lng, fetchLeaveNow]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchLeaveNow(
        hadCoordsRef.current && lat !== null ? lat : undefined,
        hadCoordsRef.current && lng !== null ? lng : undefined,
      );
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchLeaveNow, lat, lng]);

  useEffect(() => {
    if (!tiers) return;
    const leaveAtComfortable    = tiers.comfortable.recommendedLeaveTime.getTime();
    const leaveAtOnTime         = tiers.onTime.recommendedLeaveTime.getTime();
    const leaveAtCuttingItClose = tiers.cuttingItClose.recommendedLeaveTime.getTime();
    const tick = () => {
      const now = Date.now();
      setCountdowns({
        comfortable:    formatCountdown(leaveAtComfortable - now),
        onTime:         formatCountdown(leaveAtOnTime - now),
        cuttingItClose: formatCountdown(leaveAtCuttingItClose - now),
      });
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [tiers]);

  if (!trip?.departure_time) return null;

  // Distinct from staleData below: this fires as soon as the flight's own
  // departure timestamp is behind us, regardless of countdown state.
  const departureMs = new Date(trip.departure_time).getTime();
  const departureHasPassed = Number.isFinite(departureMs) && departureMs < Date.now();

  const staleData = countdowns.onTime === "—";
  // Unknown/corrupt status degrades to the cautious "Leave Soon" tier rather
  // than the falsely-reassuring "On Time" default.
  const cfg = data
    ? staleData
      ? { color: "#8B8070", bg: "#F0EDE8", label: "Check flight details" }
      : STATUS_CFG[data.status] ?? STATUS_CFG["leave-soon"]
    : STATUS_CFG["leave-soon"];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: "#FFFFFF",
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
        border: "1px solid #E8E0D5",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: accentColor }}
          >
            Leave Now Engine
          </p>
          <div className="flex items-center gap-2">
            {(fetching || locLoading) && (
              <Loader2 className="h-3 w-3 animate-spin" style={{ color: "#8B8070" }} />
            )}
            <button
              onClick={() => fetchLeaveNow(
                hadCoordsRef.current && lat !== null ? lat : undefined,
                hadCoordsRef.current && lng !== null ? lng : undefined,
              )}
              className="h-6 w-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#F0EDE8" }}
              aria-label="Refresh"
            >
              <RefreshCw className="h-3 w-3" style={{ color: "#8B8070" }} />
            </button>
          </div>
        </div>

        {fetchErr ? (
          <div className="flex items-center gap-2 py-1">
            <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#DC2626" }} />
            <p className="text-sm" style={{ color: "#DC2626" }}>{fetchErr}</p>
          </div>
        ) : departureHasPassed ? (
          <div className="flex items-center gap-2 py-4">
            <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#8B8070" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>
                You should have left
              </p>
              <p className="text-xs" style={{ color: "#8B8070" }}>
                This flight&apos;s scheduled departure has passed.
              </p>
            </div>
          </div>
        ) : data && tiers ? (
          <>
            {/* On Time — primary tier */}
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs mb-0.5 font-semibold" style={{ color: "#07101F" }}>Leave by</p>
                <p
                  className="text-4xl font-bold tracking-tight"
                  style={{ color: "#07101F", fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {fmtTime(tiers.onTime.recommendedLeaveTime)}
                </p>
              </div>
              <div className="text-right pb-0.5">
                <p className="text-xs mb-0.5" style={{ color: "#8B8070" }}>in</p>
                <p
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: "#07101F", fontFamily: "monospace" }}
                >
                  {countdowns.onTime}
                </p>
              </div>
            </div>
            <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "#8B8070" }}>
              {onTimeRationale}
            </p>

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

            {/* Comfortable + Cutting It Close — secondary tiers */}
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <TierRow
                label="Comfortable"
                color="#00D4B8"
                time={fmtTime(tiers.comfortable.recommendedLeaveTime)}
                countdown={countdowns.comfortable}
                rationale={COMFORTABLE_RATIONALE}
              />
              <TierRow
                label="Cutting It Close"
                color="#D97706"
                time={fmtTime(tiers.cuttingItClose.recommendedLeaveTime)}
                countdown={countdowns.cuttingItClose}
                rationale={CUTTING_IT_CLOSE_RATIONALE}
              />
            </div>
          </>
        ) : (
          // Skeleton shaped to match the loaded layout below so the card
          // doesn't jump in height once data arrives.
          <div className="animate-pulse">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="h-3 w-16 rounded mb-2" style={{ backgroundColor: "#F0EDE8" }} />
                <div className="h-9 w-28 rounded" style={{ backgroundColor: "#F0EDE8" }} />
              </div>
              <div className="text-right">
                <div className="h-3 w-6 rounded mb-2 ml-auto" style={{ backgroundColor: "#F0EDE8" }} />
                <div className="h-7 w-16 rounded" style={{ backgroundColor: "#F0EDE8" }} />
              </div>
            </div>
            <div className="h-3 w-40 rounded mt-3" style={{ backgroundColor: "#F0EDE8" }} />
            <div className="h-6 w-32 rounded-full mt-3" style={{ backgroundColor: "#F0EDE8" }} />
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <div className="h-16 rounded-xl" style={{ backgroundColor: "#F0EDE8" }} />
              <div className="h-16 rounded-xl" style={{ backgroundColor: "#F0EDE8" }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Breakdown ──────────────────────────────────────────── */}
      {!data && !fetchErr && (
        <div
          className="px-5 py-4 space-y-2.5 animate-pulse"
          style={{ borderTop: "1px solid #F0EDE8" }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="h-4 w-28 rounded" style={{ backgroundColor: "#F0EDE8" }} />
              <div className="h-4 w-10 rounded" style={{ backgroundColor: "#F0EDE8" }} />
            </div>
          ))}
        </div>
      )}
      {data && (
        <div
          className="px-5 py-4 space-y-2.5"
          style={{ borderTop: "1px solid #F0EDE8" }}
        >
          {data.inputs.drive.unavailable ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base leading-none shrink-0">🚗</span>
                  <span className="text-sm truncate" style={{ color: "#8B8070" }}>
                    Drive to airport
                  </span>
                </div>
                <span className="text-sm font-bold shrink-0" style={{ color: "#B5A89A" }}>
                  N/A
                </span>
              </div>
              {data.inputs.drive.source === "none" ? (
                <p className="text-[11px] leading-relaxed" style={{ color: "#B5A89A" }}>
                  No starting point set.{" "}
                  <Link href="/settings/preferences" className="underline" style={{ color: "#8B8070" }}>
                    Set home address
                  </Link>{" "}
                  or share your location below.
                </p>
              ) : data.inputs.drive.note ? (
                <p className="text-[11px] leading-relaxed" style={{ color: "#B5A89A" }}>
                  {data.inputs.drive.note}
                </p>
              ) : null}
            </>
          ) : (
            <BreakdownRow
              icon="🚗"
              label="Drive to airport"
              minutes={data.inputs.drive.minutes}
              estimated={!data.inputs.drive.isLive}
            />
          )}
          <BreakdownRow
            icon="🛡️"
            label="Security"
            minutes={data.inputs.tsa.minutes}
            estimated={data.inputs.tsa.source !== "live"}
            live={data.inputs.tsa.source === "live"}
          />
          <BreakdownRow icon="🚶" label="Walk to gate" minutes={data.inputs.walkToGate.minutes} />
          <BreakdownRow icon="⏱"  label="Buffer"       minutes={data.inputs.buffer.minutes}     />
        </div>
      )}

      {/* ── Location footer ────────────────────────────────────── */}
      {permissionState === "denied" && (
        <div
          className="px-5 py-3 flex items-center gap-2"
          style={{ borderTop: "1px solid #F0EDE8" }}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "#B5A89A" }} />
          <p className="text-xs" style={{ color: "#B5A89A" }}>
            Drive time is estimated — enable location for live traffic
          </p>
        </div>
      )}

      {permissionState === "prompt" && lat === null && (
        <div
          className="px-5 py-3 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid #F0EDE8" }}
        >
          <div className="flex items-center gap-2">
            <Navigation className="h-3.5 w-3.5 shrink-0" style={{ color: "#8B8070" }} />
            <p className="text-xs" style={{ color: "#8B8070" }}>
              Share location for live traffic
            </p>
          </div>
          <button
            onClick={requestPermission}
            className="text-xs font-bold px-3 py-1 rounded-full shrink-0"
            style={{ backgroundColor: "#F0EDE8", color: "#1A1A2E" }}
          >
            Allow
          </button>
        </div>
      )}
    </div>
  );
}
