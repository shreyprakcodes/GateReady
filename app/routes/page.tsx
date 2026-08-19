"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Zap, DollarSign, Shield, Coffee, Settings2,
  Car, Bus, Navigation, Loader2, AlertCircle, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { BottomNav } from "@/components/dashboard/BottomNav";
import { useStore } from "@/lib/store/useStore";
import { useLocationStore } from "@/src/store/locationStore";
import { useTsaWaitTime } from "@/src/hooks/useTsaWaitTime";
import { AIRPORT_COORDS } from "@/src/components/RouteMap";
import { formatDuration } from "@/lib/utils/time";
import type { JourneyStep } from "@/src/components/JourneyTimeline";
import type { LoadedRoute } from "@/src/components/RouteMap";
import type { RouteMode } from "@/app/api/routes/route";

// ─── Lazy-loaded client components ────────────────────────────────────────────

const RouteMapLazy = dynamic(
  () => import("@/src/components/RouteMap").then((m) => ({ default: m.RouteMap })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center" style={{ background: "#E8E4DC" }}>
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#4F46E5" }} />
      </div>
    ),
  },
);

const JourneyTimelineLazy = dynamic(
  () => import("@/src/components/JourneyTimeline").then((m) => ({ default: m.JourneyTimeline })),
  { ssr: false },
);

// ─── Geo helpers ──────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R     = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLon  = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Raw drive time — no parking added here
function estimateDriveMin(
  userLat: number, userLng: number,
  aptLat:  number, aptLng:  number,
): number {
  const km = haversineKm(userLat, userLng, aptLat, aptLng);
  return Math.max(5, Math.round((km / 64.37) * 60));
}

function sub(d: Date, minutes: number): Date {
  return new Date(d.getTime() - minutes * 60_000);
}

function fmt12(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

// ─── Traffic condition ────────────────────────────────────────────────────────

type TrafficCondition = "light" | "moderate" | "heavy" | "unknown";

function trafficCondition(durationSec: number, inTrafficSec: number | null): TrafficCondition {
  if (!inTrafficSec) return "unknown";
  const r = inTrafficSec / durationSec;
  if (r < 1.2) return "light";
  if (r < 1.5) return "moderate";
  return "heavy";
}

const TRAFFIC_STYLE: Record<TrafficCondition, { bg: string; text: string; label: string }> = {
  light:    { bg: "rgba(16,185,129,0.10)", text: "#059669", label: "Light"    },
  moderate: { bg: "rgba(245,158,11,0.10)", text: "#D97706", label: "Moderate" },
  heavy:    { bg: "rgba(239,68,68,0.10)",  text: "#DC2626", label: "Heavy"    },
  unknown:  { bg: "rgba(107,114,128,0.08)", text: "#9CA3AF", label: "—"       },
};

const ROUTE_LABELS = ["Fastest", "Less Traffic", "Scenic"];

// ─── Journey step builder ─────────────────────────────────────────────────────

const WALK_MIN      = 8;
const BOARD_BUFF    = 30;
const PARK_MIN      = 10;
const AIRPORT_BUFF  = 10;

function buildJourneySteps(params: {
  departureISO: string;
  origin:       string;
  destination:  string;
  gate:         string;
  driveMin:     number;
  tsaWaitMin:   number;
  currentTime:  Date;
}): JourneyStep[] {
  const { departureISO, origin, destination, gate, driveMin, tsaWaitMin, currentTime } = params;

  const t_depart    = new Date(departureISO);
  const t_board     = sub(t_depart,    BOARD_BUFF);
  const t_gate_walk = sub(t_board,     WALK_MIN);
  const t_tsa_start = sub(t_gate_walk, tsaWaitMin);
  const t_arrive    = sub(t_tsa_start, AIRPORT_BUFF);
  const t_leave     = sub(t_arrive,    driveMin + PARK_MIN);

  const times         = [t_leave, t_arrive, t_tsa_start, t_gate_walk, t_board, t_depart];
  const firstFutureIdx = times.findIndex((t) => t > currentTime);

  function status(i: number): JourneyStep["status"] {
    if (firstFutureIdx === -1) return "done";
    if (i < firstFutureIdx)   return "done";
    if (i === firstFutureIdx) return "current";
    return "future";
  }

  return [
    {
      icon:           "🏠",
      label:          "Leave Home",
      time:           t_leave,
      durationToNext: `→ ${driveMin} min drive + ${PARK_MIN} min parking`,
      status:         status(0),
    },
    {
      icon:           "🚗",
      label:          "Arrive at Airport",
      time:           t_arrive,
      durationToNext: `→ ${AIRPORT_BUFF} min to checkpoint`,
      status:         status(1),
    },
    {
      icon:           "🔒",
      label:          "Clear TSA",
      time:           t_tsa_start,
      durationToNext: `→ ~${tsaWaitMin} min TSA wait`,
      status:         status(2),
    },
    {
      icon:           "🚶",
      label:          `Walk to Gate ${gate}`,
      time:           t_gate_walk,
      durationToNext: `→ ${WALK_MIN} min walk`,
      status:         status(3),
    },
    {
      icon:           "✈️",
      label:          "Board Flight",
      time:           t_board,
      durationToNext: "→ departs in 30 min",
      status:         status(4),
    },
    {
      icon:   "🛫",
      label:  `Depart ${origin} → ${destination}`,
      time:   t_depart,
      status: status(5),
    },
  ];
}

// ─── Status chip ──────────────────────────────────────────────────────────────

type TripStatus = "on_track" | "leave_soon" | "running_late";

function getTripStatus(now: Date, leaveTime: Date | null): TripStatus {
  if (!leaveTime) return "on_track";
  const diffMin = (leaveTime.getTime() - now.getTime()) / 60_000;
  if (diffMin > 15) return "on_track";
  if (diffMin >= 0) return "leave_soon";
  return "running_late";
}

const STATUS_STYLE: Record<TripStatus, { bg: string; text: string; label: string; icon: string }> = {
  on_track:     { bg: "rgba(16,185,129,0.10)", text: "#059669", label: "On Track",   icon: "⚡" },
  leave_soon:   { bg: "rgba(245,158,11,0.10)", text: "#D97706", label: "Leave Soon",  icon: "⚠️" },
  running_late: { bg: "rgba(239,68,68,0.10)",  text: "#DC2626", label: "Leave Now",   icon: "🔴" },
};

// ─── Route modes (existing) ───────────────────────────────────────────────────

interface ApiRouteData {
  origin:      string;
  destination: string;
  driving:     RouteMode;
  transit:     RouteMode | null;
}

interface RouteStep { icon: string; label: string; detail?: string; time?: string }

interface Mode {
  id:            string;
  label:         string;
  Icon:          React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent:        string;
  duration:      string;
  buffer:        string;
  tag:           string | null;
  steps:         RouteStep[];
  uberDeepLink?: string | null;
  mapsLink?:     string;
}

interface CustomOpts {
  transport: "drive" | "rideshare" | "transit";
  foodStop:  boolean;
  parking:   boolean;
  pool:      boolean;
  scenic:    boolean;
}

function buildModes(data: ApiRouteData | null): Mode[] {
  const drv = data?.driving;
  const trs = data?.transit;
  const drvDuration = drv ? formatDuration(drv.durationMinutes) : "—";
  const trsDuration = trs ? formatDuration(trs.durationMinutes) : "—";
  const drvBuffer   = drv ? `~${drv.distanceMiles ?? "?"} mi · real-time traffic` : "Calculating…";
  const trsBuffer   = trs ? `${trs.cost ?? "~$3"} · ${trs.transfers ?? 0} transfer${(trs.transfers ?? 0) !== 1 ? "s" : ""}` : "—";

  function drvSteps(): RouteStep[] {
    if (!drv?.steps?.length)
      return [{ icon: "🏠", label: "Leave home" }, { icon: "🚗", label: "Drive to airport", detail: drvDuration }, { icon: "🛫", label: "Arrive at terminal" }];
    return [{ icon: "🏠", label: "Leave home" }, ...drv.steps.slice(0, 3).map((s) => ({ icon: "🚗", label: s.instruction, detail: `${s.durationMinutes} min` })), { icon: "🛫", label: `Arrive at ${data?.destination?.split(" ")[0] ?? "airport"}` }];
  }
  function trsSteps(): RouteStep[] {
    if (!trs?.steps?.length)
      return [{ icon: "🏠", label: "Leave home" }, { icon: "🚇", label: "Take transit", detail: trsDuration }, { icon: "🛫", label: "Arrive at airport" }];
    return [{ icon: "🏠", label: "Leave home" }, ...trs.steps.slice(0, 4).map((s) => ({ icon: s.mode === "transit" ? "🚇" : "🚶", label: s.instruction, detail: `${s.durationMinutes} min` })), { icon: "🛫", label: "Arrive at airport" }];
  }

  return [
    { id: "buffer",   label: "With Buffer", Icon: Shield,    accent: "#F59E0B", duration: drvDuration, buffer: "60+ min buffer · Recommended", tag: "Recommended", uberDeepLink: drv?.uberDeepLink ?? null, mapsLink: drv?.mapsDeepLink, steps: drvSteps() },
    { id: "fastest",  label: "Fastest",     Icon: Zap,       accent: "#4F46E5", duration: drvDuration, buffer: drvBuffer,                       tag: null,          uberDeepLink: drv?.uberDeepLink ?? null, mapsLink: drv?.mapsDeepLink, steps: drvSteps() },
    { id: "cheapest", label: "Cheapest",    Icon: DollarSign, accent: "#10B981", duration: trsDuration, buffer: trsBuffer,                       tag: trs ? `${trs.cost ?? "~$3"} fare` : null, mapsLink: trs?.mapsDeepLink ?? drv?.mapsDeepLink, steps: trsSteps() },
    { id: "food",     label: "Food Stop",   Icon: Coffee,    accent: "#F97316", duration: drv ? formatDuration(drv.durationMinutes + 5) : "—", buffer: "☕ coffee on the way", tag: null, uberDeepLink: drv?.uberDeepLink ?? null, mapsLink: drv?.mapsDeepLink, steps: [{ icon: "🏠", label: "Leave home" }, { icon: "☕", label: "Grab coffee", detail: "+5 min detour" }, { icon: "🚗", label: "Drive to airport", detail: drvDuration }, { icon: "🛫", label: "Arrive at terminal" }] },
    { id: "custom",   label: "Custom",      Icon: Settings2, accent: "#6B7280", duration: "—",         buffer: "Build your own route",           tag: null,          uberDeepLink: drv?.uberDeepLink ?? null, mapsLink: drv?.mapsDeepLink, steps: [] },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoutesPage() {
  // ── Clock ──
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  // ── Flight data from store ──
  const trip = useStore((s) => s.trip);

  // ── Airport coordinates for active trip ──
  const airportCoords = useMemo(
    () => (trip?.origin ? (AIRPORT_COORDS[trip.origin] ?? null) : null),
    [trip?.origin],
  );

  // ── Location & drive time ──
  const coords             = useLocationStore((s) => s.coords);
  const driveTimeMinutes   = useLocationStore((s) => s.driveTimeMinutes);
  const setDriveTimeMinutes = useLocationStore((s) => s.setDriveTimeMinutes);

  // Raw drive time: from Directions API (preferred) or Haversine estimate
  const haversineMin = useMemo(() => {
    if (!coords || !airportCoords) return 25;
    return estimateDriveMin(coords.lat, coords.lng, airportCoords.lat, airportCoords.lng);
  }, [coords, airportCoords]);
  const driveMin    = driveTimeMinutes ?? haversineMin;
  const driveSource = driveTimeMinutes !== null ? "google" : "estimated";

  // ── TSA wait ──
  const { data: tsaData } = useTsaWaitTime(trip?.origin ?? null);
  const tsaWaitMin = useMemo(() => {
    if (!tsaData) return 20;
    const terminal = trip?.terminal ?? "";
    return (
      (terminal ? tsaData.lanes.find((l) => l.name.includes(`Terminal ${terminal}`))?.waitMinutes : undefined)
      ?? tsaData.lanes.find((l) => l.type === "standard")?.waitMinutes
      ?? 20
    );
  }, [tsaData, trip?.terminal]);

  // ── Google Maps routes (multi-route) ──
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [loadedRoutes, setLoadedRoutes]             = useState<LoadedRoute[]>([]);
  const [refreshKey, setRefreshKey]                 = useState(0);
  const [fastestIndex, setFastestIndex]             = useState(0);
  const [toast, setToast]                           = useState<string | null>(null);
  const prevRouteSecsRef                            = useRef<number[]>([]);
  const selectedRouteIndexRef                       = useRef(selectedRouteIndex);
  useEffect(() => { selectedRouteIndexRef.current = selectedRouteIndex; }, [selectedRouteIndex]);

  // Update driveTimeMinutes when routes or selected route changes
  useEffect(() => {
    if (!loadedRoutes.length) return;
    const route = loadedRoutes[selectedRouteIndex] ?? loadedRoutes[0];
    const effectiveSecs = route.durationInTrafficSeconds ?? route.durationSeconds;
    setDriveTimeMinutes(Math.ceil(effectiveSecs / 60));
  }, [selectedRouteIndex, loadedRoutes, setDriveTimeMinutes]);

  const handleRoutesLoaded = useCallback(
    (routes: LoadedRoute[]) => {
      setLoadedRoutes(routes);

      // Detect significant change (> 2 min on any route)
      const prevSecs = prevRouteSecsRef.current;
      if (prevSecs.length > 0) {
        const changed = routes.some((r, i) => {
          const p = prevSecs[i];
          if (p === undefined) return false;
          const newSecs = r.durationInTrafficSeconds ?? r.durationSeconds;
          return Math.abs(newSecs - p) > 120;
        });
        if (changed) {
          setToast("🚦 Route updated — traffic conditions changed");
        }
        // Update "now faster" badge
        const fastestIdx = routes.reduce(
          (min, r, i) =>
            (r.durationInTrafficSeconds ?? r.durationSeconds) <
            (routes[min].durationInTrafficSeconds ?? routes[min].durationSeconds)
              ? i
              : min,
          0,
        );
        setFastestIndex(fastestIdx);
      }
      prevRouteSecsRef.current = routes.map((r) => r.durationInTrafficSeconds ?? r.durationSeconds);
    },
    [],
  );

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4_000);
    return () => clearTimeout(id);
  }, [toast]);

  // 60-second route refresh
  useEffect(() => {
    const id = setInterval(() => setRefreshKey((k) => k + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Journey steps ──
  const journeySteps: JourneyStep[] = useMemo(() => {
    if (!trip?.departure_time) return [];
    return buildJourneySteps({
      departureISO: trip.departure_time,
      origin:       trip.origin ?? "",
      destination:  trip.destination ?? "",
      gate:         trip.gate ?? "",
      driveMin,
      tsaWaitMin,
      currentTime,
    });
  }, [trip, driveMin, tsaWaitMin, currentTime]);

  const leaveHomeTime = journeySteps[0]?.time ?? null;
  const tripStatus    = getTripStatus(currentTime, leaveHomeTime);
  const statusStyle   = STATUS_STYLE[tripStatus];

  // ── Existing route-mode API ──
  const [selected, setSelected]     = useState("buffer");
  const [custom, setCustom]         = useState<CustomOpts>({ transport: "drive", foodStop: false, parking: false, pool: false, scenic: false });
  const [apiData, setApiData]       = useState<ApiRouteData | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError]     = useState("");

  useEffect(() => {
    fetch("/api/routes")
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "failed"); setApiData(j); })
      .catch((e) => setApiError((e as Error).message))
      .finally(() => setApiLoading(false));
  }, []);

  const MODES      = buildModes(apiData);
  const activeMode = MODES.find((m) => m.id === selected)!;

  function launchUber() { window.open(activeMode.uberDeepLink ?? "https://m.uber.com", "_blank"); }
  function openMaps()   { window.open(activeMode.mapsLink     ?? "https://maps.google.com", "_blank"); }

  return (
    <>
      <main className="flex flex-col min-h-screen max-w-md mx-auto pb-28" style={{ backgroundColor: "#F7F5F0" }}>

        {/* ── Live Header ─────────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-4 sticky top-0 z-20" style={{ backgroundColor: "#F7F5F0" }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="p-1.5 rounded-xl -ml-1 mr-1"
                  style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", color: "#6B7280" }}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#9CA3AF" }}>
                    📍 Live Navigation
                  </p>
                  <h1 className="text-xl font-bold leading-tight" style={{ color: "#1A1A2E" }}>
                    {trip
                      ? `${trip.flight_number ?? ""} · ${trip.origin ?? ""} → ${trip.destination ?? ""}`
                      : "Route Planner"}
                  </h1>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 ml-3">
              <p
                className="text-2xl font-bold leading-none"
                style={{ color: "#1A1A2E", fontFamily: "var(--font-playfair), serif", fontVariantNumeric: "tabular-nums" }}
              >
                {fmt12(currentTime)}
              </p>
              <span
                className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1"
                style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
              >
                {statusStyle.icon} {statusStyle.label}
              </span>
            </div>
          </div>

          {leaveHomeTime && (
            <p className="text-xs mt-2 ml-12" style={{ color: "#9CA3AF" }}>
              {tripStatus === "running_late"
                ? `Suggested departure was ${fmt12(leaveHomeTime)}`
                : `Leave by ${fmt12(leaveHomeTime)} · ${formatDuration(driveMin)} drive${driveSource === "google" ? "" : " (est.)"}`}
              {coords ? "" : " · (enable location for precise timing)"}
            </p>
          )}
        </div>

        {/* ── Toast ───────────────────────────────────────────────── */}
        {toast && (
          <div
            className="mx-4 mb-2 px-4 py-2.5 rounded-2xl flex items-center gap-2"
            style={{
              background: "rgba(79,70,229,0.08)",
              border: "1px solid rgba(79,70,229,0.20)",
              animation: "timeUpdate 0.3s ease",
            }}
          >
            <p className="text-xs font-semibold" style={{ color: "#4F46E5" }}>{toast}</p>
          </div>
        )}

        {/* ── Map ─────────────────────────────────────────────────── */}
        <div className="px-4 mb-3">
          <div
            className="rounded-3xl overflow-hidden"
            style={{ height: 360, border: "1px solid #E5E1D8", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
          >
            <RouteMapLazy
              selectedRouteIndex={selectedRouteIndex}
              airportCode={trip?.origin ?? undefined}
              refreshKey={refreshKey}
              onRoutesLoaded={handleRoutesLoaded}
            />
          </div>

          {/* Map legend */}
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-3">
              <LegendDot color="#4F46E5" label="You" />
              {trip?.origin && <LegendDot color="#4F46E5" label={trip.origin} />}
            </div>
            {coords && airportCoords ? (
              <p className="text-[10px]" style={{ color: "#9CA3AF" }}>
                ~{(haversineKm(coords.lat, coords.lng, airportCoords.lat, airportCoords.lng) * 0.621371).toFixed(1)} mi away
              </p>
            ) : (
              <p className="text-[10px]" style={{ color: "#D1D5DB" }}>Enable location for distance</p>
            )}
          </div>
        </div>

        {/* ── Route Cards ─────────────────────────────────────────── */}
        {loadedRoutes.length > 0 && (
          <div className="mb-4">
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-0 px-4 scrollbar-none">
              {loadedRoutes.map((route, i) => (
                <RouteCard
                  key={i}
                  index={i}
                  route={route}
                  isSelected={selectedRouteIndex === i}
                  showNowFaster={i === fastestIndex && fastestIndex !== selectedRouteIndex && loadedRoutes.length > 1}
                  onSelect={() => setSelectedRouteIndex(i)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Journey Timeline ─────────────────────────────────────── */}
        <div className="px-4 mb-4">
          {trip ? (
            <>
              {tripStatus === "running_late" && (
                <div
                  className="rounded-2xl px-4 py-3 mb-3 flex items-center gap-2"
                  style={{
                    background: "rgba(239,68,68,0.06)",
                    border: "1px solid rgba(239,68,68,0.20)",
                  }}
                >
                  <span>🚨</span>
                  <p className="text-xs font-semibold" style={{ color: "#DC2626" }}>
                    You should have left already — head to the airport now
                  </p>
                </div>
              )}
              <JourneyTimelineLazy
                steps={journeySteps}
                origin={trip.origin ?? ""}
                destination={trip.destination ?? ""}
                urgentLeave={tripStatus === "running_late"}
                driveTimeSource={driveSource}
              />
            </>
          ) : (
            <div
              className="rounded-3xl p-6 text-center"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8" }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: "#1A1A2E" }}>No upcoming flight</p>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>Add a flight from the dashboard to see your journey timeline.</p>
            </div>
          )}
        </div>

        {/* ── Route Options (existing) ──────────────────────────── */}
        <div className="px-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#9CA3AF" }}>
            Route Options
          </p>

          {apiError && (
            <div
              className="flex items-start gap-2 rounded-2xl px-4 py-3 mb-4"
              style={{ backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: "#92400E" }}>Using estimated times</p>
                <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>{apiError}</p>
              </div>
            </div>
          )}

          {/* Mode chips */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 mb-4 scrollbar-none">
            {MODES.map((mode) => (
              <ModeChip key={mode.id} mode={mode} selected={selected === mode.id} onSelect={() => setSelected(mode.id)} />
            ))}
            {apiLoading && <Loader2 className="h-4 w-4 animate-spin self-center shrink-0" style={{ color: "#4F46E5" }} />}
          </div>

          {/* Active mode detail */}
          <div
            className="rounded-3xl p-5 mb-4"
            style={{
              backgroundColor: "#FFFFFF",
              border: `1px solid ${activeMode.accent}33`,
              boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${activeMode.accent}12` }}>
                  <activeMode.Icon className="h-4 w-4" style={{ color: activeMode.accent }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: "#1A1A2E" }}>{activeMode.label}</p>
                  {activeMode.tag && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${activeMode.accent}12`, color: activeMode.accent }}>
                      {activeMode.tag}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair), serif", color: "#1A1A2E" }}>{activeMode.duration}</p>
                <p className="text-[11px]" style={{ color: "#9CA3AF" }}>{activeMode.buffer}</p>
              </div>
            </div>

            {activeMode.id !== "custom" && activeMode.steps.length > 0 && (
              <div className="space-y-0">
                {activeMode.steps.map((step, i) => (
                  <RouteStepItem key={i} step={step} isLast={i === activeMode.steps.length - 1} accent={activeMode.accent} />
                ))}
              </div>
            )}
            {activeMode.id === "custom" && <CustomBuilder custom={custom} setCustom={setCustom} />}
          </div>

          {/* CTAs */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={launchUber} className="rounded-2xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2" style={{ backgroundColor: "#4F46E5", color: "#FFFFFF" }}>
              <Car className="h-4 w-4" /> Book Uber
            </button>
            <button onClick={openMaps} className="rounded-2xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", color: "#6B7280" }}>
              <Navigation className="h-4 w-4" /> Open Maps
            </button>
          </div>

          <button
            onClick={() => window.location.href = "/agent?prompt=" + encodeURIComponent("Calculate the best route to my airport right now with live traffic")}
            className="mt-3 w-full rounded-2xl py-3 text-sm font-medium flex items-center justify-center gap-2"
            style={{ backgroundColor: "transparent", border: "1px solid #E5E1D8", color: "#9CA3AF" }}
          >
            <ChevronRight className="h-4 w-4" />
            Ask GateReady to recalculate with live traffic
          </button>
        </div>
      </main>
      <BottomNav />
    </>
  );
}

// ─── Route card ───────────────────────────────────────────────────────────────

function RouteCard({
  index, route, isSelected, showNowFaster, onSelect,
}: {
  index:          number;
  route:          LoadedRoute;
  isSelected:     boolean;
  showNowFaster:  boolean;
  onSelect:       () => void;
}) {
  const label    = ROUTE_LABELS[index] ?? `Route ${index + 1}`;
  const durSec   = route.durationInTrafficSeconds ?? route.durationSeconds;
  const durMin   = Math.ceil(durSec / 60);
  const tc       = trafficCondition(route.durationSeconds, route.durationInTrafficSeconds);
  const traffic  = TRAFFIC_STYLE[tc];

  return (
    <button
      onClick={onSelect}
      style={{
        minWidth: 134,
        flexShrink: 0,
        backgroundColor: "#FFFFFF",
        border:       isSelected ? "1.5px solid #4F46E5" : "1.5px solid #E5E1D8",
        borderLeft:   isSelected ? "4px solid #4F46E5"   : "1.5px solid #E5E1D8",
        borderRadius: 16,
        padding:      "11px 14px",
        textAlign:    "left",
        boxShadow:    isSelected
          ? "0 2px 16px rgba(79,70,229,0.12)"
          : "0 1px 4px rgba(0,0,0,0.05)",
        transition:   "all 200ms ease",
      }}
    >
      <div className="flex items-center justify-between mb-1.5 gap-1.5">
        <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? "#4F46E5" : "#6B7280" }}>
          {label}
        </span>
        {showNowFaster && (
          <span style={{ fontSize: 9, fontWeight: 700, color: "#D97706", background: "rgba(245,158,11,0.10)", padding: "1px 5px", borderRadius: 4, whiteSpace: "nowrap" }}>
            FASTER ↑
          </span>
        )}
        {isSelected && (
          <span style={{ fontSize: 9, fontWeight: 700, color: "white", background: "#4F46E5", padding: "1px 5px", borderRadius: 4 }}>
            ✓
          </span>
        )}
      </div>

      <p
        key={durMin}
        style={{
          fontSize: 22, fontWeight: 700, color: "#1A1A2E", lineHeight: 1.1,
          fontFamily: "var(--font-playfair), serif",
          fontVariantNumeric: "tabular-nums",
          animation: "timeUpdate 0.3s ease",
        }}
      >
        {formatDuration(durMin)}
      </p>

      <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
        {route.distanceMiles} mi
      </p>

      {tc !== "unknown" && (
        <span
          style={{
            display: "inline-flex", marginTop: 6, fontSize: 10, fontWeight: 600,
            color: traffic.text, background: traffic.bg, padding: "2px 6px", borderRadius: 6,
          }}
        >
          {traffic.label} traffic
        </span>
      )}
    </button>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full border-2 border-white" style={{ backgroundColor: color, boxShadow: `0 0 0 1px ${color}` }} />
      <span className="text-[10px] font-medium" style={{ color: "#9CA3AF" }}>{label}</span>
    </div>
  );
}

function ModeChip({ mode, selected, onSelect }: { mode: Mode; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl shrink-0 transition-all"
      style={{
        backgroundColor: selected ? `${mode.accent}10` : "#FFFFFF",
        border: `1px solid ${selected ? mode.accent : "#E5E1D8"}`,
        minWidth: 76,
      }}
    >
      <mode.Icon className="h-4 w-4" style={{ color: selected ? mode.accent : "#9CA3AF" }} />
      <span className="text-[11px] font-semibold" style={{ color: selected ? mode.accent : "#9CA3AF" }}>
        {mode.label}
      </span>
    </button>
  );
}

function RouteStepItem({ step, isLast, accent }: { step: RouteStep; isLast: boolean; accent: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
        {!isLast && <div className="w-px flex-1 mt-1" style={{ backgroundColor: "#E5E1D8", minHeight: 20 }} />}
      </div>
      <div className={`pb-4 min-w-0 ${isLast ? "pb-0" : ""}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{step.icon}</span>
          <p className="text-sm font-medium" style={{ color: "#1A1A2E" }}>{step.label}</p>
          {step.time && <span className="ml-auto text-xs font-bold shrink-0" style={{ color: accent }}>{step.time}</span>}
        </div>
        {step.detail && <p className="text-xs mt-0.5 ml-6" style={{ color: "#9CA3AF" }}>{step.detail}</p>}
      </div>
    </div>
  );
}

function CustomBuilder({ custom, setCustom }: { custom: CustomOpts; setCustom: (v: CustomOpts) => void }) {
  const transports = [
    { id: "drive",     label: "Drive",     Icon: Car },
    { id: "rideshare", label: "Rideshare", Icon: Car },
    { id: "transit",   label: "Transit",   Icon: Bus },
  ] as const;
  const toggles = [
    { key: "foodStop", label: "Food stop", emoji: "☕" },
    { key: "parking",  label: "Parking",   emoji: "🅿️" },
    { key: "pool",     label: "Carpool",   emoji: "👥" },
    { key: "scenic",   label: "Scenic",    emoji: "🌿" },
  ] as const;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#9CA3AF" }}>Transport</p>
        <div className="flex gap-2">
          {transports.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setCustom({ ...custom, transport: id })}
              className="flex-1 rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              style={{ backgroundColor: custom.transport === id ? "rgba(79,70,229,0.08)" : "#F7F5F0", border: `1px solid ${custom.transport === id ? "#4F46E5" : "#E5E1D8"}`, color: custom.transport === id ? "#4F46E5" : "#6B7280" }}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {toggles.map(({ key, label, emoji }) => {
          const on = custom[key as keyof typeof custom] as boolean;
          return (
            <button key={key} onClick={() => setCustom({ ...custom, [key]: !on })}
              className="flex items-center gap-2 rounded-xl p-3 text-xs font-medium transition-all"
              style={{ backgroundColor: on ? "rgba(79,70,229,0.06)" : "#F7F5F0", border: `1px solid ${on ? "rgba(79,70,229,0.25)" : "#E5E1D8"}`, color: on ? "#4F46E5" : "#6B7280" }}
            >
              <span>{emoji}</span><span>{label}</span>
              <div className="ml-auto w-7 h-4 rounded-full relative" style={{ backgroundColor: on ? "#4F46E5" : "#E5E1D8" }}>
                <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: on ? "calc(100% - 14px)" : "2px" }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
