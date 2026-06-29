"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Circle, Loader2, Plane, RefreshCw } from "lucide-react";
import { resolveFlightTime } from "@/lib/utils/time";

// ─── Design tokens ────────────────────────────────────────────────

const NAVY = "#07101F";
const TEAL = "#00D4B8";

// ─── Types ────────────────────────────────────────────────────────

interface TripPublic {
  flightNumber:       string | null;
  airline:            string | null;
  origin:             string | null;
  destination:        string | null;
  departureTime:      string | null;
  departureScheduled: string | null;
  departureEstimated: string | null;
  departureActual:    string | null;
  departureTz:        string | null;
  destinationTz:      string | null;
  status:             string | null;
  gate:               string | null;
  terminal:           string | null;
  displayName:        string;
}

interface MilestonePublic {
  type:      string;
  reachedAt: string;
}

interface StatusData {
  active:     true;
  trip:       TripPublic;
  milestones: MilestonePublic[];
}

interface InactiveData {
  active: false;
  reason: "not_found" | "disabled";
}

type ApiResponse = StatusData | InactiveData;

// ─── Milestone definitions ────────────────────────────────────────

const MILESTONE_STEPS: Array<{ type: string; label: string; icon: string }> = [
  { type: "left_home",        label: "Left Home",        icon: "🏠" },
  { type: "cleared_security", label: "Cleared Security", icon: "✅" },
  { type: "at_gate",          label: "At Gate",          icon: "🚪" },
  { type: "boarded",          label: "Boarded",          icon: "✈️" },
];

// ─── Helpers ──────────────────────────────────────────────────────

function fmtTime(iso: string, tz?: string | null) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
    ...(tz ? { timeZone: tz, timeZoneName: "short" } : {}),
  });
}

function fmtDate(iso: string, tz?: string | null) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    ...(tz ? { timeZone: tz } : {}),
  });
}

function statusLabel(status: string | null) {
  if (!status) return "Scheduled";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusColor(status: string | null) {
  if (status === "cancelled") return "#FF4444";
  if (status === "active")    return TEAL;
  if (status === "landed")    return "#00C48C";
  return "#94A3B8";
}

// ─── Page ─────────────────────────────────────────────────────────

export default function PublicStatusPage() {
  const { token } = useParams<{ token: string }>();

  const [data, setData]     = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/share/${token}`);
      const json = await res.json() as ApiResponse;
      setData(json);
      setLastUpdated(new Date());
    } catch {
      // keep previous data on error
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchStatus]);

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: NAVY }}
      >
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: TEAL }} />
      </div>
    );
  }

  // ── Inactive / not found ─────────────────────────────────────────
  if (!data || !data.active) {
    const reason = !data ? "not_found" : data.reason;
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ backgroundColor: NAVY }}
      >
        <div className="text-center max-w-xs">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: "#0D1B2E", border: "1px solid #162030" }}
          >
            <AlertCircle className="h-7 w-7" style={{ color: "#4A6580" }} />
          </div>
          <p
            className="text-lg font-bold mb-2"
            style={{ color: "#E2E8F0", fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {reason === "disabled" ? "Status sharing is off" : "Link not found"}
          </p>
          <p className="text-sm" style={{ color: "#4A6580" }}>
            {reason === "disabled"
              ? "The traveler has turned off status sharing for this trip."
              : "This link doesn't exist or has expired."}
          </p>
        </div>
      </div>
    );
  }

  const { trip, milestones } = data;
  const reachedMap = Object.fromEntries(milestones.map((m) => [m.type, m.reachedAt]));
  const latestMilestone = MILESTONE_STEPS.filter((s) => reachedMap[s.type]).at(-1);

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: NAVY }}>
      <div className="max-w-md mx-auto px-4">

        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="pt-10 pb-6 text-center">
          <p
            className="text-[11px] font-bold uppercase tracking-widest mb-4"
            style={{ color: `${TEAL}80` }}
          >
            Live Status
          </p>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `${TEAL}18`, border: `1px solid ${TEAL}30` }}
          >
            <Plane className="h-6 w-6" style={{ color: TEAL }} />
          </div>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: "#E2E8F0", fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {trip.displayName}{trip.destination ? ` → ${trip.destination}` : ""}
          </h1>
          {latestMilestone ? (
            <p className="text-sm" style={{ color: TEAL }}>
              {latestMilestone.icon} {latestMilestone.label}
            </p>
          ) : (
            <p className="text-sm" style={{ color: "#4A6580" }}>
              Journey not yet started
            </p>
          )}
        </div>

        {/* ── Flight info ────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ backgroundColor: "#0D1B2E", border: "1px solid #162030" }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-4"
            style={{ color: `${TEAL}60` }}
          >
            Flight Info
          </p>
          <div className="space-y-3">
            {((): Array<{ label: string; value: ReactNode; color?: string } | false> => {
              const { effectiveStr, scheduledStr, deltaLabel } = resolveFlightTime(
                trip.departureScheduled ?? trip.departureTime,
                trip.departureEstimated,
                trip.departureActual,
                trip.departureTz,
              );
              const depNode: ReactNode = trip.departureTime ? (
                <span>
                  {fmtDate(trip.departureTime, trip.departureTz)}, {effectiveStr}
                  {scheduledStr && <> <s style={{ opacity: 0.45 }}>{scheduledStr}</s></>}
                  {deltaLabel && (
                    <span className="ml-1 text-[11px] font-semibold" style={{ color: "#F59E0B" }}>
                      {deltaLabel}
                    </span>
                  )}
                </span>
              ) : null;
              return [
                {
                  label: "Flight",
                  value: [trip.airline, trip.flightNumber].filter(Boolean).join(" ") || "—",
                },
                {
                  label: "Route",
                  value: [trip.origin, trip.destination].filter(Boolean).join(" → ") || "—",
                },
                !!trip.departureTime && {
                  label: "Departure",
                  value: depNode,
                },
                !!(trip.gate || trip.terminal) && {
                  label: "Gate",
                  value: [
                    trip.gate ? `Gate ${trip.gate}` : null,
                    trip.terminal ? `Terminal ${trip.terminal}` : null,
                  ].filter(Boolean).join(" · ") || "—",
                },
                {
                  label: "Status",
                  value: statusLabel(trip.status),
                  color: statusColor(trip.status),
                },
              ];
            })()
              .filter(Boolean)
              .map((row) => {
                if (!row) return null;
                const r = row as { label: string; value: ReactNode; color?: string };
                return (
                  <div
                    key={r.label}
                    className="flex items-center justify-between gap-4 pb-3"
                    style={{ borderBottom: "1px solid #162030" }}
                  >
                    <span className="text-xs" style={{ color: "#4A6580" }}>
                      {r.label}
                    </span>
                    <span
                      className="text-sm font-semibold text-right"
                      style={{ color: r.color ?? "#E2E8F0" }}
                    >
                      {r.value}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* ── Milestone timeline ─────────────────────────────────── */}
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ backgroundColor: "#0D1B2E", border: "1px solid #162030" }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-4"
            style={{ color: `${TEAL}60` }}
          >
            Travel Progress
          </p>

          <div className="space-y-0">
            {MILESTONE_STEPS.map((step, idx) => {
              const reachedAt = reachedMap[step.type];
              const isReached = Boolean(reachedAt);
              const isLast    = idx === MILESTONE_STEPS.length - 1;

              return (
                <div key={step.type} className="flex gap-4">
                  {/* Timeline spine */}
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                      style={{
                        backgroundColor: isReached ? `${TEAL}20` : "#162030",
                        border: isReached ? `1.5px solid ${TEAL}50` : "1.5px solid #1E2A3E",
                      }}
                    >
                      {isReached
                        ? <CheckCircle2 className="h-4 w-4" style={{ color: TEAL }} />
                        : <Circle className="h-3.5 w-3.5" style={{ color: "#1E2A3E", strokeWidth: 1.5 }} />
                      }
                    </div>
                    {!isLast && (
                      <div
                        className="w-px flex-1 my-1"
                        style={{
                          backgroundColor: isReached ? `${TEAL}30` : "#162030",
                          minHeight: 24,
                        }}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">{step.icon}</span>
                      <p
                        className="text-sm font-semibold"
                        style={{ color: isReached ? "#E2E8F0" : "#4A6580" }}
                      >
                        {step.label}
                      </p>
                    </div>
                    {isReached && reachedAt && (
                      <p className="text-[11px] mt-0.5 ml-6" style={{ color: TEAL }}>
                        {fmtTime(reachedAt)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "#4A6580" }}>
            {lastUpdated ? `Updated ${fmtTime(lastUpdated.toISOString())}` : ""}
          </p>
          <button
            onClick={fetchStatus}
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "#4A6580" }}
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>

        <p
          className="text-center text-[10px] mt-6"
          style={{ color: "#162030" }}
        >
          Powered by GateReady
        </p>
      </div>
    </div>
  );
}
