"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, SlidersHorizontal, X, Search, Loader2,
  AlertCircle, Plane, LogOut, ScanLine, ChevronRight,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store/useStore";
import { useFamilyStore } from "@/src/store/familyStore";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function leaveByTime(depIso: string): Date {
  return new Date(new Date(depIso).getTime() - 2.5 * 60 * 60_000);
}

function dateLabel(depIso: string): string {
  const dep = new Date(depIso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const d = new Date(dep); d.setHours(0, 0, 0, 0);
  const dayStr  = dep.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const dateStr = dep.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  if (d.getTime() === today.getTime())    return `TODAY • ${dateStr}`;
  if (d.getTime() === tomorrow.getTime()) return `TOMORROW • ${dateStr}`;
  return `${dayStr} • ${dateStr}`;
}

function bufferChip(leaveAt: Date): { label: string; color: string; bg: string } {
  const mins = (leaveAt.getTime() - Date.now()) / 60_000;
  if (mins > 30) return { label: "Comfortable",    color: C.success, bg: `${C.success}18` };
  if (mins > 10) return { label: "Getting Close",  color: C.warning, bg: `${C.warning}18` };
  return         { label: "Leave Now",             color: C.danger,  bg: `${C.danger}18`  };
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: "Scheduled",    color: C.primary,  bg: `${C.primary}18`  },
  boarding:  { label: "Boarding Now", color: C.warning,  bg: `${C.warning}18`  },
  departed:  { label: "In Flight",    color: C.success,  bg: `${C.success}18`  },
  landed:    { label: "Landed",       color: C.success,  bg: `${C.success}18`  },
  delayed:   { label: "Delayed",      color: C.danger,   bg: `${C.danger}18`   },
  cancelled: { label: "Cancelled",    color: C.danger,   bg: `${C.danger}18`   },
  on_time:   { label: "On Time",      color: C.success,  bg: `${C.success}18`  },
};

// ─── Looked-up flight shape ───────────────────────────────────────────────────

interface LookedUpFlight {
  flightNumber:  string;
  airline:       string;
  airlineName:   string;
  origin:        string;
  destination:   string;
  departureTime: string;
  arrivalTime:   string;
  terminal:      string | null;
  gate:          string | null;
  duration:      string;
  isMock:        boolean;
}

// ─── Pill chip ────────────────────────────────────────────────────────────────

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ color, backgroundColor: bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// ─── Trip card ────────────────────────────────────────────────────────────────

function TripCard({ trip, onSelect }: { trip: Trip; onSelect: (t: Trip) => void }) {
  const status  = STATUS_CFG[trip.status] ?? STATUS_CFG["scheduled"];
  const hasDep  = !!trip.departure_time;
  const leaveAt = hasDep ? leaveByTime(trip.departure_time!) : null;
  const buffer  = leaveAt ? bufferChip(leaveAt) : null;

  return (
    <button
      onClick={() => onSelect(trip)}
      className="w-full text-left transition-all active:scale-[0.985]"
    >
      {hasDep && (
        <p className="text-[11px] font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: C.secondary }}>
          {dateLabel(trip.departure_time!)}
        </p>
      )}
      <div
        className="rounded-2xl p-5 flex items-start gap-4"
        style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
      >
        <div className="flex-1 min-w-0">
          {/* Route row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[22px] font-bold leading-none" style={{ color: C.text }}>{trip.origin ?? "—"}</span>
            <Plane className="h-4 w-4 shrink-0" style={{ color: C.primary }} />
            <span className="text-[22px] font-bold leading-none" style={{ color: C.text }}>{trip.destination ?? "—"}</span>
          </div>

          {/* Airline + flight */}
          <p className="text-sm mb-1" style={{ color: C.secondary }}>
            {[trip.airline, trip.flight_number].filter(Boolean).join(" ")}
          </p>

          {/* Time */}
          {hasDep && (
            <p className="text-sm mb-3" style={{ color: C.secondary }}>
              {fmtTime(trip.departure_time!)}
              {trip.boarding_time ? ` – ${fmtTime(trip.boarding_time)}` : ""}
            </p>
          )}

          {/* Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <Pill label={status.label} color={status.color} bg={status.bg} />
          </div>

          {/* Leave by */}
          {leaveAt && buffer && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[12px] font-semibold" style={{ color: C.primary }}>
                Leave by {fmtTime(leaveAt.toISOString())}
              </span>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ color: buffer.color, backgroundColor: buffer.bg }}
              >
                {buffer.label}
              </span>
            </div>
          )}
        </div>

        {/* Thumbnail */}
        <div
          className="shrink-0 rounded-xl flex items-center justify-center"
          style={{ width: 72, height: 72, backgroundColor: `${C.primary}10`, border: `1px solid ${C.border}` }}
        >
          <Plane className="h-7 w-7" style={{ color: C.primary, opacity: 0.55 }} />
        </div>
      </div>
    </button>
  );
}

// ─── Widget preview ───────────────────────────────────────────────────────────

function WidgetPreview({ trip }: { trip: Trip | null }) {
  const leaveAt  = trip?.departure_time ? leaveByTime(trip.departure_time) : null;
  const bufPct   = leaveAt ? Math.max(0, Math.min(100, (leaveAt.getTime() - Date.now()) / (45 * 60_000) * 100)) : 85;
  const r        = 22;
  const circ     = 2 * Math.PI * r;
  const offset   = circ * (1 - bufPct / 100);

  return (
    <div
      className="rounded-2xl p-5 mt-4"
      style={{ backgroundColor: "#0D1B2A", border: "1px solid #1E2D3D" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#4A90E2" }}>
        Travel Screen Widget
      </p>
      {trip ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-base font-bold" style={{ color: "#FFFFFF" }}>
              {trip.origin} → {trip.destination}
            </p>
            <p className="text-sm mt-0.5" style={{ color: "#6B8DB0" }}>
              {trip.airline} {trip.flight_number}
            </p>
            {leaveAt && (
              <p className="text-xl font-bold mt-2" style={{ color: C.primary }}>
                Leave by {fmtTime(leaveAt.toISOString())}
              </p>
            )}
          </div>
          <div className="shrink-0" style={{ position: "relative", width: 56, height: 56 }}>
            <svg width={56} height={56} style={{ transform: "rotate(-90deg)", display: "block" }}>
              <circle cx={28} cy={28} r={r} fill="none" stroke="#1E2D3D" strokeWidth={6} />
              <circle cx={28} cy={28} r={r} fill="none" stroke={C.success} strokeWidth={6}
                strokeDasharray={`${circ}`} strokeDashoffset={`${offset}`} strokeLinecap="round" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="text-[11px] font-bold" style={{ color: C.success }}>{Math.round(bufPct)}%</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm" style={{ color: "#6B8DB0" }}>No active trip</p>
      )}
    </div>
  );
}

// ─── Travel Companion sidebar ─────────────────────────────────────────────────

function TravelCompanion() {
  const members = useFamilyStore((s) => s.members);
  const bufPct  = 85;
  const r       = 28;
  const circ    = 2 * Math.PI * r;
  const offset  = circ * (1 - bufPct / 100);

  return (
    <aside
      className="hidden lg:flex flex-col gap-6 shrink-0"
      style={{ width: 252, paddingTop: 32 }}
    >
      {/* Family members */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: C.secondary }}>
          Travel Companion
        </p>
        <div className="space-y-3">
          {members.length === 0 ? (
            <p className="text-xs" style={{ color: C.secondary }}>No family members yet</p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: m.avatarColor }}
                >
                  {m.avatarInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{m.name}</p>
                  <p className="text-[11px] truncate" style={{ color: C.secondary }}>
                    {m.flights.length > 0 ? `${m.flights[0].origin} → ${m.flights[0].destination}` : "No flight"}
                  </p>
                </div>
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: C.success }} />
              </div>
            ))
          )}
        </div>
        <Link
          href="/family"
          className="mt-4 flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: C.primary }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Person
        </Link>
      </div>

      {/* Smart Buffer ring */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: C.secondary }}>
          Smart Buffer
        </p>
        <div className="flex flex-col items-center gap-2">
          <div className="shrink-0" style={{ position: "relative", width: 72, height: 72 }}>
            <svg width={72} height={72} style={{ transform: "rotate(-90deg)", display: "block" }}>
              <circle cx={36} cy={36} r={r} fill="none" stroke={C.border} strokeWidth={7} />
              <circle cx={36} cy={36} r={r} fill="none" stroke={C.success} strokeWidth={7}
                strokeDasharray={`${circ}`} strokeDashoffset={`${offset}`} strokeLinecap="round" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="text-sm font-bold" style={{ color: C.success }}>{bufPct}%</span>
            </div>
          </div>
          <p className="text-sm font-semibold" style={{ color: C.text }}>Comfortable</p>
          <p className="text-xs text-center" style={{ color: C.secondary }}>Plenty of time before departure</p>
        </div>
      </div>
    </aside>
  );
}

// ─── Add Flight Modal ─────────────────────────────────────────────────────────

interface AddModalProps {
  user: User;
  onClose: () => void;
  onSaved: (trip: Trip) => void;
}

function AddFlightModal({ user, onClose, onSaved }: AddModalProps) {
  const [tab, setTab]         = useState<"enter" | "scan">("enter");
  const [flight, setFlight]   = useState("");
  const [date, setDate]       = useState(todayISO());
  const [seat, setSeat]       = useState("");
  const [looking, setLooking] = useState(false);
  const [found, setFound]     = useState<LookedUpFlight | null>(null);
  const [lookErr, setLookErr] = useState("");
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const setTripInStore = useStore((s) => s.setTrip);
  const setTripId      = useStore((s) => s.setTripId);

  async function lookup() {
    if (!flight.trim() || !date) return;
    setLooking(true); setLookErr(""); setFound(null);
    const r = await fetch(`/api/flight-lookup?flight=${encodeURIComponent(flight.trim())}&date=${date}`);
    const d = await r.json();
    setLooking(false);
    if (!r.ok) { setLookErr(d.error ?? "Lookup failed"); return; }
    setFound(d as LookedUpFlight);
  }

  async function save() {
    if (!found) return;
    setSaving(true); setSaveErr("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_id:        user.id,
        flight_number:  found.flightNumber,
        airline:        found.airline,
        origin:         found.origin,
        destination:    found.destination,
        departure_time: found.departureTime,
        terminal:       found.terminal ?? null,
        gate:           found.gate ?? null,
        seat:           seat.trim() || null,
        status:         "scheduled",
      })
      .select()
      .single();
    if (error || !data) { setSaveErr(error?.message ?? "Save failed"); setSaving(false); return; }
    setTripId(data.id);
    setTripInStore(data);
    onSaved(data);
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 12, fontSize: 14,
    border: `1.5px solid ${C.border}`, backgroundColor: "#F7F9FC",
    color: C.text, outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(13,27,42,0.55)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-md rounded-3xl overflow-hidden"
        style={{ backgroundColor: C.card, boxShadow: "0 32px 80px rgba(0,0,0,0.22)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-bold" style={{ color: C.text }}>Add Flight</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#F0F3FA", color: C.secondary }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex mx-6 mb-5 rounded-2xl p-1 gap-1" style={{ backgroundColor: "#F0F3FA" }}>
          {(["enter", "scan"] as const).map((t) => (
            <button
              key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
              style={
                tab === t
                  ? { backgroundColor: C.card, color: C.text, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                  : { color: C.secondary }
              }
            >
              {t === "enter" ? "Enter Flight" : "Scan Pass"}
            </button>
          ))}
        </div>

        <div className="px-6 pb-6 space-y-4">
          {tab === "enter" ? (
            <>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.secondary }}>
                  Flight Number
                </label>
                <input
                  value={flight}
                  onChange={(e) => setFlight(e.target.value.toUpperCase())}
                  placeholder="e.g. AA1234"
                  style={inp}
                  onFocus={(e) => (e.target.style.borderColor = C.primary)}
                  onBlur={(e)  => (e.target.style.borderColor = C.border)}
                  onKeyDown={(e) => e.key === "Enter" && lookup()}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.secondary }}>
                  Date
                </label>
                <input
                  type="date" value={date} min={todayISO()}
                  onChange={(e) => setDate(e.target.value)}
                  style={inp}
                  onFocus={(e) => (e.target.style.borderColor = C.primary)}
                  onBlur={(e)  => (e.target.style.borderColor = C.border)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.secondary }}>
                  Seat <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  value={seat}
                  onChange={(e) => setSeat(e.target.value.toUpperCase())}
                  placeholder="e.g. 22A"
                  style={inp}
                  onFocus={(e) => (e.target.style.borderColor = C.primary)}
                  onBlur={(e)  => (e.target.style.borderColor = C.border)}
                />
              </div>

              {lookErr && (
                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"
                  style={{ backgroundColor: `${C.danger}10`, color: C.danger, border: `1px solid ${C.danger}25` }}
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />{lookErr}
                </div>
              )}

              {!found && (
                <button
                  onClick={lookup}
                  disabled={!flight.trim() || !date || looking}
                  className="w-full rounded-full py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ backgroundColor: `${C.primary}12`, color: C.primary, border: `1.5px solid ${C.primary}30` }}
                >
                  {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {looking ? "Looking up…" : "Look up flight"}
                </button>
              )}

              {found && (
                <div
                  className="rounded-2xl p-4 space-y-2"
                  style={{ backgroundColor: "#F7F9FC", border: `1px solid ${C.border}` }}
                >
                  {found.isMock && (
                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.warning }}>
                      Mock data — live lookup coming soon
                    </p>
                  )}
                  <div className="flex justify-between items-start">
                    <span className="text-base font-bold" style={{ color: C.text }}>
                      {found.origin} → {found.destination}
                    </span>
                    <span className="text-sm font-bold" style={{ color: C.primary }}>{found.flightNumber}</span>
                  </div>
                  <p className="text-sm" style={{ color: C.secondary }}>
                    {new Date(found.departureTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    {" · "}{fmtTime(found.departureTime)}
                    {found.duration && ` · ${found.duration}`}
                  </p>
                  {saveErr && (
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
                      style={{ backgroundColor: `${C.danger}10`, color: C.danger }}
                    >
                      <AlertCircle className="h-3.5 w-3.5" />{saveErr}
                    </div>
                  )}
                  <button
                    onClick={save} disabled={saving}
                    className="w-full rounded-full py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 mt-1"
                    style={{ backgroundColor: C.primary, color: "#FFFFFF" }}
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saving ? "Saving…" : "Save Flight"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ backgroundColor: "#F7F9FC", border: `1.5px dashed ${C.border}` }}
            >
              <ScanLine className="h-10 w-10 mx-auto mb-3" style={{ color: "#D1D9E6" }} />
              <p className="text-sm font-semibold mb-1" style={{ color: C.secondary }}>Coming soon</p>
              <p className="text-xs" style={{ color: "#9BA8B8" }}>
                Snap your boarding pass — we&apos;ll fill everything in automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTERS = ["All Trips", "Flights", "Trains", "Buses"] as const;
type FilterKey = (typeof FILTERS)[number];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser]               = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [trips, setTrips]             = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [filter, setFilter]           = useState<FilterKey>("All Trips");
  const [showModal, setShowModal]     = useState(false);

  const setTripId = useStore((s) => s.setTripId);
  const setTrip   = useStore((s) => s.setTrip);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.replace("/login"); return; }
      setUser(u);
      setAuthLoading(false);
      loadTrips(u.id);
    });
  }, [router]);

  async function loadTrips(uid: string) {
    setTripsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("trips")
      .select("*")
      .eq("user_id", uid)
      .order("departure_time", { ascending: true });
    setTrips(data ?? []);
    setTripsLoading(false);
  }

  function handleSelect(trip: Trip) {
    setTripId(trip.id);
    setTrip(trip);
    router.push(`/trip/${trip.id}`);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const filteredTrips = useMemo(() => {
    if (filter === "All Trips") return trips;
    if (filter === "Flights")   return trips.filter((t) => !!t.airline);
    return [];
  }, [trips, filter]);

  const activeTrip = trips[0] ?? null;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bg }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: C.primary }} />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen pb-28" style={{ backgroundColor: C.bg }}>
        <div className="max-w-5xl mx-auto flex gap-8 px-4 sm:px-6">

          {/* Travel Companion sidebar (lg+) */}
          <TravelCompanion />

          {/* Main content */}
          <div className="flex-1 min-w-0 pt-8">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-[22px] font-bold" style={{ color: C.text }}>Upcoming Trips</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowModal(true)}
                  className="h-9 w-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: C.primary, color: "#FFFFFF", boxShadow: `0 4px 12px ${C.primary}40` }}
                  aria-label="Add flight"
                >
                  <Plus className="h-5 w-5" />
                </button>
                <button
                  className="h-9 w-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: C.card, color: C.secondary, border: `1px solid ${C.border}` }}
                  aria-label="Filter"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-none">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-all"
                  style={
                    filter === f
                      ? { backgroundColor: C.primary, color: "#FFFFFF", boxShadow: `0 2px 8px ${C.primary}30` }
                      : { backgroundColor: C.card, color: C.secondary, border: `1px solid ${C.border}` }
                  }
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Trip list */}
            {tripsLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: "#E0E5F0" }} />
                ))}
              </div>
            ) : filteredTrips.length === 0 ? (
              <div
                className="rounded-2xl p-10 text-center"
                style={{ backgroundColor: C.card, border: `1.5px dashed ${C.border}`, boxShadow: SHADOW }}
              >
                <Plane className="h-10 w-10 mx-auto mb-4" style={{ color: C.border }} />
                <p className="text-base font-bold mb-1" style={{ color: C.text }}>
                  {filter === "All Trips" ? "No trips yet" : `No ${filter.toLowerCase()} found`}
                </p>
                <p className="text-sm mb-6" style={{ color: C.secondary }}>
                  {filter === "All Trips" ? "Add your first flight to get started" : "Try switching to All Trips"}
                </p>
                {filter === "All Trips" && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold"
                    style={{ backgroundColor: C.primary, color: "#FFFFFF" }}
                  >
                    <Plus className="h-4 w-4" />
                    Add your first flight
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} onSelect={handleSelect} />
                ))}
              </div>
            )}

            {/* Widget preview */}
            <WidgetPreview trip={activeTrip} />

            {/* Past trips */}
            <button
              className="mt-6 flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: C.primary }}
            >
              View Past Trips
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Sign out */}
            <div className="mt-8 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={signOut}
                className="flex items-center gap-2 text-sm"
                style={{ color: C.secondary }}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />

      {showModal && user && (
        <AddFlightModal
          user={user}
          onClose={() => setShowModal(false)}
          onSaved={(t) => {
            setTrips((prev) =>
              [...prev, t].sort(
                (a, b) =>
                  new Date(a.departure_time ?? 0).getTime() -
                  new Date(b.departure_time ?? 0).getTime(),
              ),
            );
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}
