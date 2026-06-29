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
import { fmtFlightTime, fmtFlightDate, fmtDayLabel, resolveFlightTime } from "@/lib/utils/time";

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

function leaveByTime(depIso: string): Date {
  return new Date(new Date(depIso).getTime() - 2.5 * 60 * 60_000);
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

// ─── Normalized flight shape (mirrors app/api/flights/lookup) ─────────────────

interface NormalizedFlight {
  flightNumber:        string;
  airline:             string;
  airlineName:         string | null;
  departure_airport:   string | null;
  departure_time:      string | null;
  departure_scheduled: string | null;
  departure_estimated: string | null;
  departure_actual:    string | null;
  departure_timezone:  string | null;
  arrival_airport:     string | null;
  arrival_time:        string | null;
  arrival_scheduled:   string | null;
  arrival_estimated:   string | null;
  arrival_actual:      string | null;
  arrival_timezone:    string | null;
  status:              string;
  gate:                string | null;
  terminal:            string | null;
  raw:                 unknown;
}

const TEAL = "#00D4B8";

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
          {fmtDayLabel(trip.departure_time!, trip.departure_timezone)}
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
          {hasDep && (() => {
            const { effectiveStr, scheduledStr, deltaLabel } = resolveFlightTime(
              trip.departure_scheduled ?? trip.departure_time,
              trip.departure_estimated,
              trip.departure_actual,
              trip.departure_timezone,
              { showTzLabel: true },
            );
            return (
              <p className="text-sm mb-3" style={{ color: C.secondary }}>
                {effectiveStr}
                {scheduledStr && (
                  <> <s style={{ opacity: 0.45 }}>{scheduledStr}</s></>
                )}
                {deltaLabel && (
                  <span className="ml-1 text-[11px] font-semibold" style={{ color: C.danger }}> {deltaLabel}</span>
                )}
                {trip.boarding_time ? ` – ${fmtFlightTime(trip.boarding_time, trip.departure_timezone)}` : ""}
              </p>
            );
          })()}

          {/* Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <Pill label={status.label} color={status.color} bg={status.bg} />
          </div>

          {/* Leave by */}
          {leaveAt && buffer && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[12px] font-semibold" style={{ color: C.primary }}>
                Leave by {fmtFlightTime(leaveAt.toISOString(), trip.departure_timezone)}
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
                Leave by {fmtFlightTime(leaveAt.toISOString(), trip.departure_timezone)}
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
  onClose: () => void;
  onSaved: (trip: Trip) => void;
}

function AddFlightModal({ onClose, onSaved }: AddModalProps) {
  const [tab, setTab]             = useState<"enter" | "scan">("enter");
  const [flight, setFlight]       = useState("");
  const [date, setDate]           = useState(todayISO());
  const [seat, setSeat]           = useState("");
  const [looking, setLooking]     = useState(false);
  const [results, setResults]     = useState<NormalizedFlight[]>([]);
  const [selected, setSelected]   = useState<NormalizedFlight | null>(null);
  const [lookErr, setLookErr]     = useState("");
  const [isSample, setIsSample]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveErr, setSaveErr]     = useState("");

  const setTripInStore = useStore((s) => s.setTrip);
  const setTripId      = useStore((s) => s.setTripId);

  async function lookup() {
    if (!flight.trim() || !date) return;
    setLooking(true); setLookErr(""); setResults([]); setSelected(null); setIsSample(false);
    const r = await fetch(
      `/api/flights/lookup?flight=${encodeURIComponent(flight.trim())}&date=${date}`
    );
    const d = await r.json();
    setLooking(false);
    if (!r.ok) { setLookErr(d.error ?? "Lookup failed"); return; }
    setIsSample(!!d.isSample);
    if (d.multiple) {
      setResults(d.flights as NormalizedFlight[]);
    } else {
      const single = d.flight as NormalizedFlight;
      setResults([single]);
      setSelected(single);
    }
  }

  async function save() {
    if (!selected) return;
    setSaving(true); setSaveErr("");
    const r = await fetch("/api/flights/save", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ flight: { ...selected, seat: seat.trim() || null } }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { setSaveErr(d.error ?? "Save failed"); return; }
    const trip = d.trip as Trip;
    setTripId(trip.id);
    setTripInStore(trip);
    onSaved(trip);
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 12, fontSize: 14,
    border: `1.5px solid ${C.border}`, backgroundColor: "#F7F9FC",
    color: C.text, outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(7,16,31,0.65)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-md rounded-3xl overflow-hidden"
        style={{ backgroundColor: C.card, boxShadow: "0 32px 80px rgba(0,0,0,0.28)" }}
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
                  onFocus={(e) => (e.target.style.borderColor = TEAL)}
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
                  onFocus={(e) => (e.target.style.borderColor = TEAL)}
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
                  onFocus={(e) => (e.target.style.borderColor = TEAL)}
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

              {/* Look-up button — hidden once results arrive */}
              {results.length === 0 && (
                <button
                  onClick={lookup}
                  disabled={!flight.trim() || !date || looking}
                  className="w-full rounded-full py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ backgroundColor: `${TEAL}18`, color: TEAL, border: `1.5px solid ${TEAL}40` }}
                >
                  {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {looking ? "Looking up…" : "Look up flight"}
                </button>
              )}

              {/* Multiple-match picker */}
              {results.length > 1 && !selected && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold" style={{ color: C.secondary }}>
                    Multiple flights found — select yours:
                  </p>
                  {results.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => setSelected(f)}
                      className="w-full text-left rounded-2xl px-4 py-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
                      style={{ border: `1.5px solid ${C.border}`, backgroundColor: "#F7F9FC" }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: C.text }}>
                          {f.departure_airport ?? "—"} → {f.arrival_airport ?? "—"}
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TEAL}18`, color: TEAL }}>
                          {f.flightNumber}
                        </span>
                      </div>
                      {f.departure_time && (
                        <p className="text-xs mt-1" style={{ color: C.secondary }}>
                          {fmtFlightDate(f.departure_time, f.departure_timezone)}
                          {" · "}{fmtFlightTime(f.departure_time, f.departure_timezone, { showTzLabel: true })}
                          {f.arrival_time ? ` → ${fmtFlightTime(f.arrival_time, f.arrival_timezone, { showTzLabel: true })}` : ""}
                        </p>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => { setResults([]); setSelected(null); setFlight(""); }}
                    className="text-xs"
                    style={{ color: C.secondary }}
                  >
                    ← Search again
                  </button>
                </div>
              )}

              {/* Selected flight confirmation card */}
              {selected && (
                <div
                  className="rounded-2xl p-4 space-y-2"
                  style={{ backgroundColor: "#F7F9FC", border: `1.5px solid ${TEAL}40` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-base font-bold" style={{ color: C.text }}>
                      {selected.departure_airport ?? "—"} → {selected.arrival_airport ?? "—"}
                    </span>
                    <span className="text-sm font-bold shrink-0 px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TEAL}18`, color: TEAL }}>
                      {selected.flightNumber}
                    </span>
                  </div>
                  {selected.airlineName && (
                    <p className="text-sm" style={{ color: C.secondary }}>{selected.airlineName}</p>
                  )}
                  {selected.departure_time && (
                    <p className="text-sm" style={{ color: C.secondary }}>
                      {fmtFlightDate(selected.departure_time, selected.departure_timezone)}
                      {" · "}{fmtFlightTime(selected.departure_time, selected.departure_timezone, { showTzLabel: true })}
                      {selected.arrival_time ? ` → ${fmtFlightTime(selected.arrival_time, selected.arrival_timezone, { showTzLabel: true })}` : ""}
                    </p>
                  )}
                  {results.length > 1 && (
                    <button
                      onClick={() => setSelected(null)}
                      className="text-xs"
                      style={{ color: C.secondary }}
                    >
                      ← Choose different flight
                    </button>
                  )}
                  {isSample && (
                    <p className="text-[11px] text-center py-1" style={{ color: C.secondary }}>
                      Using sample data — flight details may not reflect your actual flight
                    </p>
                  )}
                  {saveErr && (
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
                      style={{ backgroundColor: `${C.danger}10`, color: C.danger }}
                    >
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />{saveErr}
                    </div>
                  )}
                  <button
                    onClick={save}
                    disabled={saving}
                    className="w-full rounded-full py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 mt-1"
                    style={{ backgroundColor: TEAL, color: "#FFFFFF", boxShadow: `0 4px 14px ${TEAL}50` }}
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saving ? "Saving…" : "Confirm & Save Flight"}
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
            router.push(`/trip/${t.id}`);
          }}
        />
      )}
    </>
  );
}
