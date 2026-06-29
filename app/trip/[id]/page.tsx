"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft, Plane, Clock, Shield, Navigation,
  BarChart2, Bell, RefreshCw, Loader2, AlertCircle,
  MapPin, ChevronRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store/useStore";
import { useTsaWaitTime } from "@/src/hooks/useTsaWaitTime";
import { BottomNav } from "@/components/dashboard/BottomNav";
import { LeaveNowCard } from "@/components/dashboard/LeaveNowCard";
import { MilestonePanel } from "@/components/trip/MilestonePanel";
import { SharePanel } from "@/components/trip/SharePanel";
import { BoardingPass } from "@/components/trip/BoardingPass";
import { TripReadinessCard } from "@/components/trip/TripReadinessCard";
import type { Database } from "@/lib/supabase/types";
import { resolveFlightTime, fmtFlightTime } from "@/lib/utils/time";
import { getAirlineTheme } from "@/lib/airlineThemes";

type Trip = Database["public"]["Tables"]["trips"]["Row"];

// ─── Design tokens (warm off-white palette) ───────────────────────────────────

const C = {
  bg:      "#FAF7F2",   // page background
  card:    "#FFFFFF",   // card surfaces
  text:    "#1A1A2E",   // primary ink
  muted:   "#8B8070",   // secondary text / labels
  border:  "#E8E0D5",   // card borders
  divider: "#F0EDE8",   // intra-card dividers
  danger:  "#DC2626",
  warning: "#D97706",
  success: "#059669",
} as const;

const SHADOW = "0 2px 20px rgba(0,0,0,0.06)";

// ─── Lazy map ─────────────────────────────────────────────────────────────────

const RouteMapLazy = dynamic(
  () => import("@/src/components/RouteMap").then((m) => ({ default: m.RouteMap })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full animate-pulse rounded-2xl" style={{ backgroundColor: "#E8E0D5" }} />
    ),
  },
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string, tz?: string | null) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
    ...(tz ? { timeZone: tz } : {}),
  });
}

function fmtDate(iso: string, tz?: string | null) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    ...(tz ? { timeZone: tz } : {}),
  });
}

function leaveByTime(depIso: string) {
  return new Date(new Date(depIso).getTime() - 2.5 * 60 * 60_000);
}

// ─── Smart Buffer ring ────────────────────────────────────────────────────────

function SmartBuffer({ depIso, tz, accent }: { depIso: string | null; tz?: string | null; accent: string }) {
  const [pct, setPct] = useState(85);

  useEffect(() => {
    if (!depIso) return;
    function calc() {
      const leaveAt = leaveByTime(depIso!);
      const raw = (leaveAt.getTime() - Date.now()) / (45 * 60_000) * 100;
      setPct(Math.max(0, Math.min(100, raw)));
    }
    calc();
    const id = setInterval(calc, 30_000);
    return () => clearInterval(id);
  }, [depIso]);

  const color = pct >= 85 ? C.success : pct >= 50 ? C.warning : C.danger;
  const label = pct >= 85 ? "Comfortable" : pct >= 50 ? "Getting Close" : "Leave Now";
  const r     = 52;
  const circ  = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ position: "relative", width: 128, height: 128 }}>
        <svg width={128} height={128} style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle cx={64} cy={64} r={r} fill="none" stroke={C.divider} strokeWidth={10} />
          <circle cx={64} cy={64} r={r} fill="none" stroke={color} strokeWidth={10}
            strokeDasharray={`${circ}`} strokeDashoffset={`${offset}`}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span className="text-2xl font-bold" style={{ color }}>{Math.round(pct)}%</span>
          <span className="text-[11px] font-semibold mt-0.5" style={{ color: C.muted }}>buffer</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold" style={{ color }}>{label}</p>
        {depIso && (
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            Leave by {fmtTime(leaveByTime(depIso).toISOString(), tz)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Journey step types ───────────────────────────────────────────────────────

interface JStep { time: Date; label: string; detail: string; icon: React.ReactNode; done: boolean }

function buildJourneySteps(trip: Trip, tsaMin: number, driveMin: number): JStep[] {
  if (!trip.departure_time) return [];

  const dep    = new Date(trip.departure_time);
  const board  = new Date(dep.getTime()  - 30 * 60_000);
  const gate   = new Date(board.getTime() - 8  * 60_000);
  const tsaEnd = new Date(gate.getTime()  - tsaMin * 60_000);
  const arrive = new Date(tsaEnd.getTime() - 10 * 60_000);
  const leave  = new Date(arrive.getTime() - driveMin * 60_000 - 10 * 60_000);

  const now = new Date();

  return [
    { time: leave,  label: "Leave Home",        detail: `${driveMin} min drive`,               icon: "🚗", done: now > leave  },
    { time: arrive, label: "Arrive at Airport",  detail: "+10 min parking",                      icon: "🅿️", done: now > arrive },
    { time: tsaEnd, label: "Through Security",   detail: `~${tsaMin} min wait`,                  icon: "🛡️", done: now > tsaEnd },
    { time: gate,   label: "Walk to Gate",       detail: `Gate ${trip.gate ?? "—"}`,             icon: "🚶", done: now > gate   },
    { time: board,  label: "Boarding",           detail: `${trip.airline ?? ""} ${trip.flight_number ?? ""}`, icon: "🎫", done: now > board },
    { time: dep,    label: "Departure",          detail: `Terminal ${trip.terminal ?? "—"}`,     icon: "✈️", done: now > dep   },
  ];
}

// ─── Journey step row ─────────────────────────────────────────────────────────

function StepRow({ step, isLast, tz, accent }: { step: JStep; isLast: boolean; tz?: string | null; accent: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-base shrink-0"
          style={{
            backgroundColor: step.done ? `${accent}15` : "#F5F3F0",
            border: step.done ? `1.5px solid ${accent}40` : `1px solid ${C.border}`,
          }}
        >
          {step.icon}
        </div>
        {!isLast && (
          <div className="w-px flex-1 mt-1" style={{ backgroundColor: C.border, minHeight: 24 }} />
        )}
      </div>
      <div className="flex-1 pb-5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold" style={{ color: step.done ? C.muted : C.text }}>
            {step.label}
          </p>
          <span className="text-sm font-bold shrink-0" style={{ color: step.done ? C.muted : accent }}>
            {fmtTime(step.time.toISOString(), tz)}
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: C.muted }}>{step.detail}</p>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ["Itinerary", "Live Route", "Details"] as const;
type TabKey = (typeof TABS)[number];

// ─── Flight info row (Details tab) ────────────────────────────────────────────

function FlightInfoRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2" style={{ borderBottom: `1px solid ${C.divider}` }}>
      <span className="text-xs font-medium" style={{ color: C.muted }}>{label}</span>
      <span
        className="text-sm font-semibold text-right"
        style={{ color: C.text, fontFamily: mono ? "monospace" : undefined }}
      >
        {value}
      </span>
    </div>
  );
}

function DepartureInfoRow({ trip, accent }: { trip: Trip; accent: string }) {
  const tz = trip.departure_timezone;
  const { effectiveStr, scheduledStr, deltaLabel } = resolveFlightTime(
    trip.departure_scheduled ?? trip.departure_time,
    trip.departure_estimated,
    trip.departure_actual,
    tz,
  );
  const dateStr = trip.departure_time ? fmtDate(trip.departure_time, tz) : null;
  return (
    <FlightInfoRow
      label="Departure"
      value={
        dateStr ? (
          <span>
            {dateStr}, {effectiveStr}
            {scheduledStr && (
              <> <s style={{ opacity: 0.45 }}>{scheduledStr}</s></>
            )}
            {deltaLabel && (
              <span className="ml-1 text-[11px] font-semibold" style={{ color: accent }}>
                {deltaLabel}
              </span>
            )}
          </span>
        ) : "—"
      }
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [trip, setTripLocal]     = useState<Trip | null>(null);
  const [loading, setLoading]    = useState(true);
  const [error, setError]        = useState("");
  const [tab, setTab]            = useState<TabKey>("Itinerary");
  const [driveMin]               = useState(45);
  const [routeIdx, setRouteIdx]  = useState(0);
  const [routeKey, setRouteKey]  = useState(0);

  const setTripStore   = useStore((s) => s.setTrip);
  const setTripIdStore = useStore((s) => s.setTripId);
  const storeTrip      = useStore((s) => s.trip);

  const { data: tsaData } = useTsaWaitTime(trip?.origin ?? null);
  const tsaMin = tsaData?.lanes?.[0]?.waitMinutes ?? 15;

  // Derive airline theme from flight number prefix
  const airlineCode = trip?.flight_number?.match(/^([A-Z]{2,3})/)?.[1] ?? null;
  const theme       = getAirlineTheme(airlineCode);

  // Load trip from Supabase
  useEffect(() => {
    if (!params.id) return;

    if (storeTrip?.id === params.id) {
      setTripLocal(storeTrip);
      setLoading(false);
      return;
    }

    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const { data, error: err } = await supabase
        .from("trips")
        .select("*")
        .eq("id", params.id)
        .eq("user_id", user.id)
        .single();

      if (err || !data) {
        setError(err?.message ?? "Trip not found");
        setLoading(false);
        return;
      }

      setTripLocal(data);
      setTripIdStore(data.id);
      setTripStore(data);
      setLoading(false);
    }

    load();
  }, [params.id, router, storeTrip, setTripStore, setTripIdStore]);

  const journeySteps = trip ? buildJourneySteps(trip, tsaMin, driveMin) : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bg }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.primary }} />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: C.bg }}>
        <div className="text-center">
          <AlertCircle className="h-10 w-10 mx-auto mb-3" style={{ color: C.danger }} />
          <p className="text-base font-bold mb-4" style={{ color: C.text }}>{error || "Trip not found"}</p>
          <Link href="/dashboard" className="text-sm font-semibold" style={{ color: theme.primary }}>
            Back to Trips
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen pb-28" style={{ backgroundColor: C.bg }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6">

          {/* ── Header ────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 pt-8 pb-5">
            <Link
              href="/dashboard"
              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.muted, boxShadow: SHADOW }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold leading-tight truncate" style={{ color: C.text }}>
                {trip.origin} → {trip.destination}
              </h1>
              <p className="text-xs truncate" style={{ color: C.muted }}>
                {[trip.airline, trip.flight_number].filter(Boolean).join(" ")}
                {trip.departure_time && ` · ${fmtDate(trip.departure_time, trip.departure_timezone)}`}
              </p>
            </div>
          </div>

          {/* ── Tab bar ───────────────────────────────────────────── */}
          <div
            className="flex rounded-2xl p-1 gap-1 mb-6"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, boxShadow: SHADOW }}
          >
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                style={
                  tab === t
                    ? { backgroundColor: theme.primary, color: theme.onPrimary, boxShadow: `0 2px 8px ${theme.primary}30` }
                    : { color: C.muted }
                }
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── Tab: Itinerary ────────────────────────────────────── */}
          {tab === "Itinerary" && (
            <div className="space-y-5">
              {/* Boarding pass */}
              <BoardingPass
                trip={trip}
                airlineCode={airlineCode}
                isSample={false}
              />

              {/* Trip readiness */}
              <TripReadinessCard
                origin={trip.origin}
                destination={trip.destination}
                tripId={trip.id}
              />

              {/* Leave Now Engine */}
              <LeaveNowCard />

              {/* Travel day progress */}
              <MilestonePanel tripId={trip.id} />

              {/* Journey timeline */}
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider mb-5" style={{ color: C.muted }}>
                  Journey Timeline
                </p>
                {journeySteps.length === 0 ? (
                  <p className="text-sm" style={{ color: C.muted }}>No departure time set</p>
                ) : (
                  journeySteps.map((step, i) => (
                    <StepRow
                      key={i}
                      step={step}
                      isLast={i === journeySteps.length - 1}
                      tz={trip.departure_timezone}
                      accent={theme.primary}
                    />
                  ))
                )}
              </div>

              {/* Food stops placeholder */}
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                    Food & Coffee Stops
                  </p>
                  <Link href="/food" className="flex items-center gap-1 text-xs font-semibold" style={{ color: theme.primary }}>
                    View All <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ backgroundColor: C.bg, border: `1.5px dashed ${C.border}` }}>
                  <p className="text-sm" style={{ color: C.muted }}>
                    Food recommendations near {trip.origin ?? "your airport"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Live Route ───────────────────────────────────── */}
          {tab === "Live Route" && (
            <div className="space-y-4">
              {/* Map */}
              <div className="rounded-2xl overflow-hidden" style={{ height: "55vh", position: "relative" }}>
                <RouteMapLazy
                  selectedRouteIndex={routeIdx}
                  airportCode={trip.origin ?? undefined}
                  refreshKey={routeKey}
                  onRoutesLoaded={() => {}}
                />
                <div
                  className="absolute top-4 left-4 rounded-2xl px-4 py-3 flex items-center gap-2"
                  style={{ backgroundColor: C.card, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
                >
                  <Clock className="h-4 w-4" style={{ color: theme.primary }} />
                  <span className="text-base font-bold" style={{ color: C.text }}>{driveMin} min</span>
                  <span className="text-xs" style={{ color: C.muted }}>drive</span>
                </div>
              </div>

              {/* Traffic info */}
              <div
                className="rounded-2xl p-4 flex items-center gap-3"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <BarChart2 className="h-5 w-5 shrink-0" style={{ color: theme.primary }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: C.text }}>Traffic is normal</p>
                  <p className="text-xs" style={{ color: C.muted }}>Last updated just now</p>
                </div>
                <button
                  onClick={() => setRouteKey((k) => k + 1)}
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: C.bg, color: C.muted }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Route options */}
              <div
                className="rounded-2xl p-4"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: C.muted }}>
                  Route Options
                </p>
                <div className="flex gap-2 flex-wrap">
                  {["Fastest", "No Tolls", "Less Traffic"].map((opt, i) => (
                    <button
                      key={opt}
                      onClick={() => setRouteIdx(i)}
                      className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
                      style={
                        routeIdx === i
                          ? { backgroundColor: theme.primary, color: theme.onPrimary }
                          : { backgroundColor: C.bg, color: C.muted, border: `1px solid ${C.border}` }
                      }
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <Link
                href="/routes"
                className="flex items-center justify-between rounded-2xl p-4"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center gap-3">
                  <Navigation className="h-5 w-5" style={{ color: theme.primary }} />
                  <span className="text-sm font-semibold" style={{ color: C.text }}>Full Routes & Timeline</span>
                </div>
                <ChevronRight className="h-4 w-4" style={{ color: C.muted }} />
              </Link>
            </div>
          )}

          {/* ── Tab: Details ──────────────────────────────────────── */}
          {tab === "Details" && (
            <div className="space-y-4">
              {/* Flight info */}
              <div
                className="rounded-2xl p-5 space-y-1"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: C.muted }}>
                  Flight Info
                </p>
                <FlightInfoRow label="Flight"    value={[trip.airline, trip.flight_number].filter(Boolean).join(" ") || "—"} />
                <FlightInfoRow label="Route"     value={[trip.origin, trip.destination].filter(Boolean).join(" → ") || "—"} />
                <DepartureInfoRow trip={trip} accent={theme.primary} />
                <FlightInfoRow label="Boarding"  value={trip.boarding_time ? fmtTime(trip.boarding_time, trip.departure_timezone) : "—"} />
                <FlightInfoRow label="Terminal"  value={trip.terminal ?? "—"} mono />
                <FlightInfoRow label="Gate"      value={trip.gate ?? "—"} mono />
                <FlightInfoRow label="Seat"      value={trip.seat ?? "—"} mono />
                {trip.confirmation_code && (
                  <FlightInfoRow label="Confirmation" value={trip.confirmation_code} mono />
                )}
              </div>

              {/* Live updates */}
              <div
                className="rounded-2xl p-5 space-y-1"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: C.muted }}>
                  Live Updates
                </p>

                {/* TSA */}
                <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${C.divider}` }}>
                  <Shield className="h-4 w-4 shrink-0" style={{ color: theme.primary }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: C.text }}>TSA Wait · {trip.origin}</p>
                    <p className="text-xs" style={{ color: C.muted }}>
                      {tsaData ? `~${tsaMin} min` : "Loading…"}
                    </p>
                  </div>
                  <Link href="/tsa" className="text-xs font-semibold" style={{ color: theme.primary }}>Details</Link>
                </div>

                {/* Status */}
                <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${C.divider}` }}>
                  <Plane className="h-4 w-4 shrink-0" style={{ color: theme.primary }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: C.text }}>Flight Status</p>
                    <p className="text-xs capitalize" style={{ color: C.muted }}>{trip.status}</p>
                  </div>
                  <Link href="/flight-status" className="text-xs font-semibold" style={{ color: theme.primary }}>Track</Link>
                </div>

                {/* Gate */}
                <div className="flex items-center gap-3 py-2.5">
                  <MapPin className="h-4 w-4 shrink-0" style={{ color: theme.primary }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: C.text }}>Gate</p>
                    <p className="text-xs" style={{ color: C.muted }}>
                      {trip.gate ? `Gate ${trip.gate}` : "Not assigned yet"}
                      {trip.terminal ? ` · Terminal ${trip.terminal}` : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Smart Buffer */}
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: C.muted }}>
                  Smart Buffer
                </p>
                <SmartBuffer depIso={trip.departure_time} tz={trip.departure_timezone} accent={theme.primary} />
              </div>

              {/* Share */}
              <SharePanel
                tripId={trip.id}
                initialShareEnabled={trip.share_enabled ?? false}
                initialToken={trip.share_token ?? ""}
              />

              {/* Alerts */}
              <button
                className="w-full flex items-center gap-3 rounded-2xl p-4 transition-all active:scale-[0.98]"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <Bell className="h-5 w-5" style={{ color: theme.primary }} />
                <span className="text-sm font-semibold" style={{ color: C.text }}>Manage Alerts</span>
                <ChevronRight className="h-4 w-4 ml-auto" style={{ color: C.muted }} />
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}
