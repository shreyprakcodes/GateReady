"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft, Plane, Clock, Shield, Navigation,
  BarChart2, Share2, Bell, RefreshCw, Loader2, AlertCircle,
  MapPin, ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store/useStore";
import { useTsaWaitTime } from "@/src/hooks/useTsaWaitTime";
import { BottomNav } from "@/components/dashboard/BottomNav";
import type { Database } from "@/lib/supabase/types";

type Trip = Database["public"]["Tables"]["trips"]["Row"];

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  primary:   "#1B6EF3",
  success:   "#00C48C",
  warning:   "#F5A623",
  danger:    "#FF4444",
  bg:        "#F4F6FA",
  card:      "#FFFFFF",
  text:      "#0D1B2A",
  secondary: "#6B7A90",
  border:    "#E8ECF4",
} as const;

const SHADOW = "0 2px 16px rgba(0,0,0,0.07)";

// ─── Lazy map ─────────────────────────────────────────────────────────────────

const RouteMapLazy = dynamic(
  () => import("@/src/components/RouteMap").then((m) => ({ default: m.RouteMap })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full animate-pulse rounded-2xl" style={{ backgroundColor: "#E0E5F0" }} />
    ),
  },
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function leaveByTime(depIso: string) {
  return new Date(new Date(depIso).getTime() - 2.5 * 60 * 60_000);
}

// ─── Smart Buffer ring ────────────────────────────────────────────────────────

function SmartBuffer({ depIso }: { depIso: string | null }) {
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
          <circle cx={64} cy={64} r={r} fill="none" stroke={C.border} strokeWidth={10} />
          <circle cx={64} cy={64} r={r} fill="none" stroke={color} strokeWidth={10}
            strokeDasharray={`${circ}`} strokeDashoffset={`${offset}`}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span className="text-2xl font-bold" style={{ color }}>{Math.round(pct)}%</span>
          <span className="text-[11px] font-semibold mt-0.5" style={{ color: C.secondary }}>buffer</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold" style={{ color }}>{label}</p>
        {depIso && (
          <p className="text-xs mt-0.5" style={{ color: C.secondary }}>
            Leave by {fmtTime(leaveByTime(depIso).toISOString())}
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

  const steps: JStep[] = [
    { time: leave,  label: "Leave Home",          detail: `${driveMin} min drive`,               icon: "🚗", done: now > leave  },
    { time: arrive, label: "Arrive at Airport",   detail: "+10 min parking",                      icon: "🅿️", done: now > arrive },
    { time: tsaEnd, label: "Through Security",    detail: `~${tsaMin} min wait`,                  icon: "🛡️", done: now > tsaEnd },
    { time: gate,   label: "Walk to Gate",        detail: `Gate ${trip.gate ?? "—"}`,             icon: "🚶", done: now > gate   },
    { time: board,  label: "Boarding",            detail: `${trip.airline ?? ""} ${trip.flight_number ?? ""}`, icon: "🎫", done: now > board },
    { time: dep,    label: "Departure",           detail: `Terminal ${trip.terminal ?? "—"}`,     icon: "✈️", done: now > dep   },
  ];

  return steps;
}

// ─── Journey step row ─────────────────────────────────────────────────────────

function StepRow({ step, isLast }: { step: JStep; isLast: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-base shrink-0"
          style={{
            backgroundColor: step.done ? `${C.primary}15` : "#F0F3FA",
            border: step.done ? `1.5px solid ${C.primary}40` : `1px solid ${C.border}`,
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
          <p className="text-sm font-semibold" style={{ color: step.done ? C.secondary : C.text }}>
            {step.label}
          </p>
          <span className="text-sm font-bold shrink-0" style={{ color: step.done ? C.secondary : C.primary }}>
            {fmtTime(step.time.toISOString())}
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: C.secondary }}>{step.detail}</p>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ["Itinerary", "Live Route", "Details"] as const;
type TabKey = (typeof TABS)[number];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [trip, setTripLocal] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [tab, setTab]         = useState<TabKey>("Itinerary");
  const [driveMin]             = useState(45);
  const [routeIdx, setRouteIdx] = useState(0);
  const [routeKey, setRouteKey] = useState(0);

  const setTripStore  = useStore((s) => s.setTrip);
  const setTripIdStore = useStore((s) => s.setTripId);
  const storeTrip     = useStore((s) => s.trip);

  const { data: tsaData } = useTsaWaitTime(trip?.origin ?? null);
  const tsaMin = tsaData?.lanes?.[0]?.waitMinutes ?? 15;

  // Load trip from Supabase
  useEffect(() => {
    if (!params.id) return;

    // Optimistically use store trip if id matches
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
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: C.primary }} />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: C.bg }}>
        <div className="text-center">
          <AlertCircle className="h-10 w-10 mx-auto mb-3" style={{ color: C.danger }} />
          <p className="text-base font-bold mb-4" style={{ color: C.text }}>{error || "Trip not found"}</p>
          <Link href="/dashboard" className="text-sm font-semibold" style={{ color: C.primary }}>
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

          {/* Header */}
          <div className="flex items-center gap-3 pt-8 pb-5">
            <Link
              href="/dashboard"
              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: C.secondary }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold leading-tight truncate" style={{ color: C.text }}>
                {trip.origin} → {trip.destination}
              </h1>
              <p className="text-xs truncate" style={{ color: C.secondary }}>
                {[trip.airline, trip.flight_number].filter(Boolean).join(" ")}
                {trip.departure_time && ` · ${fmtDate(trip.departure_time)}`}
              </p>
            </div>
          </div>

          {/* Tab bar */}
          <div
            className="flex rounded-2xl p-1 gap-1 mb-6"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
          >
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                style={
                  tab === t
                    ? { backgroundColor: C.primary, color: "#FFFFFF", boxShadow: `0 2px 8px ${C.primary}30` }
                    : { color: C.secondary }
                }
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── Tab: Itinerary ────────────────────────────────────────────── */}
          {tab === "Itinerary" && (
            <div className="space-y-5">
              {/* Hero card */}
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center justify-between gap-6 flex-wrap">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: C.secondary }}>
                      Leave by
                    </p>
                    {trip.departure_time ? (
                      <p className="text-3xl font-bold" style={{ color: C.primary }}>
                        {fmtTime(leaveByTime(trip.departure_time).toISOString())}
                      </p>
                    ) : (
                      <p className="text-xl font-bold" style={{ color: C.secondary }}>—</p>
                    )}
                    <p className="text-xs mt-1" style={{ color: C.secondary }}>
                      Departure at {trip.departure_time ? fmtTime(trip.departure_time) : "—"}
                    </p>
                  </div>
                  <SmartBuffer depIso={trip.departure_time} />
                </div>
              </div>

              {/* Journey timeline */}
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider mb-5" style={{ color: C.secondary }}>
                  Journey Timeline
                </p>
                {journeySteps.length === 0 ? (
                  <p className="text-sm" style={{ color: C.secondary }}>No departure time set</p>
                ) : (
                  journeySteps.map((step, i) => (
                    <StepRow key={i} step={step} isLast={i === journeySteps.length - 1} />
                  ))
                )}
              </div>

              {/* Food stops placeholder */}
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.secondary }}>
                    Food & Coffee Stops
                  </p>
                  <Link href="/food" className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.primary }}>
                    View All <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "#F7F9FC", border: `1.5px dashed ${C.border}` }}>
                  <p className="text-sm" style={{ color: C.secondary }}>
                    Food recommendations near {trip.origin ?? "your airport"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Live Route ───────────────────────────────────────────── */}
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
                {/* Floating drive time card */}
                <div
                  className="absolute top-4 left-4 rounded-2xl px-4 py-3 flex items-center gap-2"
                  style={{ backgroundColor: C.card, boxShadow: "0 4px 20px rgba(0,0,0,0.14)" }}
                >
                  <Clock className="h-4 w-4" style={{ color: C.primary }} />
                  <span className="text-base font-bold" style={{ color: C.text }}>{driveMin} min</span>
                  <span className="text-xs" style={{ color: C.secondary }}>drive</span>
                </div>
              </div>

              {/* Traffic info row */}
              <div
                className="rounded-2xl p-4 flex items-center gap-3"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <BarChart2 className="h-5 w-5 shrink-0" style={{ color: C.primary }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: C.text }}>Traffic is normal</p>
                  <p className="text-xs" style={{ color: C.secondary }}>Last updated just now</p>
                </div>
                <button
                  onClick={() => setRouteKey((k) => k + 1)}
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "#F0F3FA", color: C.secondary }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Route option pills */}
              <div
                className="rounded-2xl p-4"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: C.secondary }}>
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
                          ? { backgroundColor: C.primary, color: "#FFFFFF" }
                          : { backgroundColor: "#F0F3FA", color: C.secondary }
                      }
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full routes page link */}
              <Link
                href="/routes"
                className="flex items-center justify-between rounded-2xl p-4"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center gap-3">
                  <Navigation className="h-5 w-5" style={{ color: C.primary }} />
                  <span className="text-sm font-semibold" style={{ color: C.text }}>Full Routes & Timeline</span>
                </div>
                <ChevronRight className="h-4 w-4" style={{ color: C.secondary }} />
              </Link>
            </div>
          )}

          {/* ── Tab: Details ──────────────────────────────────────────────── */}
          {tab === "Details" && (
            <div className="space-y-4">
              {/* Flight info card */}
              <div
                className="rounded-2xl p-5 space-y-3"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.secondary }}>
                  Flight Info
                </p>
                <FlightInfoRow label="Flight"     value={[trip.airline, trip.flight_number].filter(Boolean).join(" ") || "—"} />
                <FlightInfoRow label="Route"      value={[trip.origin, trip.destination].filter(Boolean).join(" → ") || "—"} />
                <FlightInfoRow label="Departure"  value={trip.departure_time ? `${fmtDate(trip.departure_time)}, ${fmtTime(trip.departure_time)}` : "—"} />
                <FlightInfoRow label="Boarding"   value={trip.boarding_time ? fmtTime(trip.boarding_time) : "—"} />
                <FlightInfoRow label="Terminal"   value={trip.terminal ?? "—"} />
                <FlightInfoRow label="Gate"       value={trip.gate ?? "—"} />
                <FlightInfoRow label="Seat"       value={trip.seat ?? "—"} />
                {trip.confirmation_code && (
                  <FlightInfoRow label="Confirmation" value={trip.confirmation_code} mono />
                )}
              </div>

              {/* Real-time updates */}
              <div
                className="rounded-2xl p-5 space-y-3"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.secondary }}>
                  Live Updates
                </p>

                {/* TSA wait */}
                <div className="flex items-center gap-3 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <Shield className="h-4 w-4 shrink-0" style={{ color: C.primary }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: C.text }}>TSA Wait · {trip.origin}</p>
                    <p className="text-xs" style={{ color: C.secondary }}>
                      {tsaData ? `~${tsaMin} min` : "Loading…"}
                    </p>
                  </div>
                  <Link href="/tsa" className="text-xs font-semibold" style={{ color: C.primary }}>
                    Details
                  </Link>
                </div>

                {/* Flight status */}
                <div className="flex items-center gap-3 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <Plane className="h-4 w-4 shrink-0" style={{ color: C.primary }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: C.text }}>Flight Status</p>
                    <p className="text-xs capitalize" style={{ color: C.secondary }}>{trip.status}</p>
                  </div>
                  <Link href="/flight-status" className="text-xs font-semibold" style={{ color: C.primary }}>
                    Track
                  </Link>
                </div>

                {/* Gate */}
                <div className="flex items-center gap-3 py-2">
                  <MapPin className="h-4 w-4 shrink-0" style={{ color: C.primary }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: C.text }}>Gate</p>
                    <p className="text-xs" style={{ color: C.secondary }}>
                      {trip.gate ? `Gate ${trip.gate}` : "Not assigned yet"}
                      {trip.terminal ? ` · Terminal ${trip.terminal}` : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Buffer status */}
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: C.secondary }}>
                  Smart Buffer
                </p>
                <SmartBuffer depIso={trip.departure_time} />
              </div>

              {/* Share trip */}
              <button
                className="w-full flex items-center gap-3 rounded-2xl p-4 transition-all active:scale-[0.98]"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <Share2 className="h-5 w-5" style={{ color: C.primary }} />
                <span className="text-sm font-semibold" style={{ color: C.text }}>Share Trip Details</span>
                <ChevronRight className="h-4 w-4 ml-auto" style={{ color: C.secondary }} />
              </button>

              {/* Alerts link */}
              <button
                className="w-full flex items-center gap-3 rounded-2xl p-4 transition-all active:scale-[0.98]"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <Bell className="h-5 w-5" style={{ color: C.primary }} />
                <span className="text-sm font-semibold" style={{ color: C.text }}>Manage Alerts</span>
                <ChevronRight className="h-4 w-4 ml-auto" style={{ color: C.secondary }} />
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}

// ─── Flight info row ──────────────────────────────────────────────────────────

function FlightInfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <span className="text-xs" style={{ color: C.secondary }}>{label}</span>
      <span
        className="text-sm font-semibold text-right"
        style={{ color: C.text, fontFamily: mono ? "var(--font-geist-mono, monospace)" : undefined }}
      >
        {value}
      </span>
    </div>
  );
}
