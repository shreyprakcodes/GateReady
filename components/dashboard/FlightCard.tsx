"use client";

import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Plane, X, Users, Check, Luggage, Ticket, ChevronRight } from "lucide-react";
import type { Database } from "@/lib/supabase/types";
import { useFamilyStore } from "@/src/store/familyStore";
import { resolveFlightTime } from "@/lib/utils/time";

type Trip = Database["public"]["Tables"]["trips"]["Row"];

// ── Status config ─────────────────────────────────────────────────

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: "On Time",   color: "#10B981", bg: "rgba(16,185,129,0.10)" },
  boarding:  { label: "Boarding",  color: "#10B981", bg: "rgba(16,185,129,0.10)" },
  active:    { label: "In Flight", color: "#4F46E5", bg: "rgba(79,70,229,0.10)"  },
  delayed:   { label: "Delayed",   color: "#F59E0B", bg: "rgba(245,158,11,0.10)" },
  cancelled: { label: "Cancelled", color: "#EF4444", bg: "rgba(239,68,68,0.10)"  },
  departed:  { label: "Departed",  color: "#6B7280", bg: "rgba(107,114,128,0.10)"},
  landed:    { label: "Landed",    color: "#6B7280", bg: "rgba(107,114,128,0.10)"},
};

// ── Helpers ───────────────────────────────────────────────────────

function fmtTime(iso: string | null, tz?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: tz ?? undefined });
}

function fmtDuration(depIso: string, arrIso: string) {
  const mins = Math.round((new Date(arrIso).getTime() - new Date(depIso).getTime()) / 60_000);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Small sub-components ──────────────────────────────────────────

function StatusChip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
      style={{ backgroundColor: bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

function AvatarDot({ initials, color, size = 26, active }: { initials: string; color: string; size?: number; active?: boolean }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold select-none shrink-0"
      style={{
        width: size, height: size,
        backgroundColor: active ? `${color}22` : `${color}12`,
        border: `2px solid ${active ? color : `${color}33`}`,
        color,
        fontSize: size * 0.33,
        fontFamily: "var(--font-inter), sans-serif",
      }}
    >
      {initials}
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold whitespace-nowrap pointer-events-none"
      style={{
        backgroundColor: "#1A1A2E",
        color: "#FFFFFF",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      }}
    >
      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
      {message}
    </div>
  );
}

// ── Flight detail bottom sheet ────────────────────────────────────

interface SheetProps {
  trip: Trip;
  open: boolean;
  dragY: number;
  isDragging: boolean;
  onClose: () => void;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  onHandlePointerMove: (e: React.PointerEvent) => void;
  onHandlePointerUp:   (e: React.PointerEvent) => void;
  members: ReturnType<typeof useFamilyStore.getState>["members"];
  sharedIds: Set<string>;
  onShare: (id: string, name: string) => void;
  tz: string | null;
  arrivalTz: string | null;
  arrivalTime: string | null;
  duration: string | null;
  baggageClaim: string | null;
  status: typeof STATUS[string];
}

function SheetDivider() {
  return <div style={{ height: 1, backgroundColor: "#F3F4F6" }} />;
}

function SheetRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#9CA3AF" }}>{label}</span>
      <span className="text-sm font-semibold text-right" style={{ color: "#1A1A2E" }}>{value}</span>
    </div>
  );
}

function FlightDetailSheet({
  trip, open, dragY, isDragging,
  onClose, onHandlePointerDown, onHandlePointerMove, onHandlePointerUp,
  members, sharedIds, onShare,
  tz, arrivalTz, arrivalTime, duration, baggageClaim, status,
}: SheetProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 transition-opacity duration-300"
        style={{
          backgroundColor: "rgba(26,26,46,0.45)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
        style={{
          maxWidth: "28rem",
          margin: "0 auto",
          maxHeight: "90vh",
          backgroundColor: "#FFFFFF",
          borderTop: "1px solid #E5E1D8",
          borderLeft: "1px solid #E5E1D8",
          borderRight: "1px solid #E5E1D8",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
          transform: open ? `translateY(${dragY}px)` : "translateY(100%)",
          transition: isDragging ? "none" : "transform 300ms cubic-bezier(0.34,1.56,0.64,1)",
          willChange: "transform",
        }}
      >
        {/* Drag handle */}
        <div
          className="flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: "#E5E1D8" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-1 pb-4 shrink-0">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "#9CA3AF" }}>
              {trip.airline ?? "Airline"}
            </p>
            <p className="text-xl font-bold" style={{ color: "#1A1A2E" }}>
              {trip.flight_number ?? "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip label={status.label} color={status.color} bg={status.bg} />
            <button
              onClick={onClose}
              className="p-2 rounded-xl"
              style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
          {/* Route hero */}
          <div
            className="flex items-center gap-3 rounded-2xl p-4 mb-5"
            style={{ backgroundColor: "#F7F5F0" }}
          >
            <div className="flex-1">
              <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 40, fontWeight: 700, color: "#1A1A2E", lineHeight: 1 }}>
                {trip.origin ?? "—"}
              </p>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{fmtTime(trip.departure_time, tz)} depart</p>
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0 px-2">
              <Plane className="h-5 w-5 rotate-90" style={{ color: "#4F46E5" }} />
              {duration && <span className="text-[10px]" style={{ color: "#9CA3AF" }}>{duration}</span>}
              <div className="h-px w-8" style={{ backgroundColor: "#E5E1D8" }} />
            </div>
            <div className="flex-1 text-right">
              <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 40, fontWeight: 700, color: "#1A1A2E", lineHeight: 1 }}>
                {trip.destination ?? "—"}
              </p>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{fmtTime(arrivalTime, arrivalTz)} arrive</p>
            </div>
          </div>

          {/* Times */}
          <div className="mb-4">
            {(() => {
              const { effectiveStr, scheduledStr, deltaLabel } = resolveFlightTime(
                trip.departure_scheduled ?? trip.departure_time,
                trip.departure_estimated,
                trip.departure_actual,
                tz,
              );
              return (
                <SheetRow
                  label="Departure"
                  value={
                    <span>
                      {effectiveStr}
                      {scheduledStr && (
                        <> <s style={{ opacity: 0.45 }}>{scheduledStr}</s></>
                      )}
                      {deltaLabel && (
                        <span className="ml-1 text-[11px] font-semibold" style={{ color: "#F59E0B" }}>
                          {deltaLabel}
                        </span>
                      )}
                    </span>
                  }
                />
              );
            })()}
            <SheetRow label="Arrival"   value={fmtTime(arrivalTime, arrivalTz)} />
            {duration && <SheetRow label="Duration"  value={duration} />}
          </div>

          {/* Gate / Terminal / Seat */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Gate",     value: trip.gate ?? "TBD",   accent: !!trip.gate },
              { label: "Terminal", value: trip.terminal ?? "—", accent: false },
              { label: "Seat",     value: trip.seat ?? "—",     accent: !!trip.seat },
            ].map(({ label, value, accent }) => (
              <div
                key={label}
                className="rounded-2xl px-3 py-4 text-center"
                style={{
                  backgroundColor: accent ? "rgba(79,70,229,0.06)" : "#F7F5F0",
                  border: `1px solid ${accent ? "rgba(79,70,229,0.20)" : "#E5E1D8"}`,
                }}
              >
                <p className="text-[10px] font-medium uppercase tracking-wide mb-1.5" style={{ color: "#9CA3AF" }}>
                  {label}
                </p>
                <p
                  className="text-xl font-bold"
                  style={{ fontFamily: "var(--font-playfair), serif", color: accent ? "#4F46E5" : "#1A1A2E" }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Baggage claim */}
          {(trip.status === "landed" || baggageClaim) && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-5"
              style={{ backgroundColor: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.18)" }}
            >
              <Luggage className="h-5 w-5 shrink-0" style={{ color: "#10B981" }} />
              <div>
                <p className="text-xs font-bold" style={{ color: "#10B981" }}>Baggage Claim</p>
                <p className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>{baggageClaim ?? "Check airport displays"}</p>
              </div>
            </div>
          )}

          {/* Share with Family */}
          {members.length > 0 && (
            <div className="mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: "#9CA3AF" }}>
                Share with Family
              </p>
              <div className="flex gap-2 flex-wrap">
                {members.map((m) => {
                  const shared = sharedIds.has(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => onShare(m.id, m.name)}
                      className="flex items-center gap-2 rounded-2xl px-3 py-2 transition-all"
                      style={{
                        backgroundColor: shared ? `${m.avatarColor}12` : "#F7F5F0",
                        border: `1px solid ${shared ? m.avatarColor + "44" : "#E5E1D8"}`,
                      }}
                    >
                      <AvatarDot initials={m.avatarInitials} color={m.avatarColor} size={22} active={shared} />
                      <span className="text-xs font-semibold" style={{ color: shared ? m.avatarColor : "#6B7280" }}>
                        {m.name}
                      </span>
                      {shared && <Check className="h-3 w-3" style={{ color: m.avatarColor }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="space-y-2.5">
            <Link
              href="/boarding-passes"
              className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 text-sm font-semibold transition-opacity active:opacity-80"
              style={{ backgroundColor: "#4F46E5", color: "#FFFFFF" }}
            >
              <Ticket className="h-4 w-4" />
              View Boarding Pass
            </Link>
            <Link
              href="/flight-status"
              className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 text-sm font-semibold"
              style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8", color: "#6B7280" }}
            >
              <Plane className="h-4 w-4 rotate-90" />
              Track Flight
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main card ─────────────────────────────────────────────────────

export function FlightCard({ trip }: { trip: Trip }) {
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [dragY, setDragY]           = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef               = useRef(false);
  const dragStartY                  = useRef(0);
  const [sharedIds, setSharedIds]   = useState<Set<string>>(new Set());
  const [toast, setToast]           = useState<string | null>(null);

  const members = useFamilyStore((s) => s.members);

  // departure_timezone / destination_timezone are first-class DB columns.
  // raw_boarding_pass only carries non-columnar extras like baggage_claim.
  const raw = trip.raw_boarding_pass as { baggage_claim?: string } | null;

  const tz           = trip.departure_timezone   ?? null;
  const arrivalTz    = trip.destination_timezone ?? null;
  const arrivalTime  = trip.arrival_time         ?? null;
  const baggageClaim = raw?.baggage_claim        ?? null;
  const duration     = trip.departure_time && arrivalTime
    ? fmtDuration(trip.departure_time, arrivalTime) : null;

  const status        = STATUS[trip.status ?? "scheduled"] ?? STATUS.scheduled;
  const sharedMembers = members.filter((m) => sharedIds.has(m.id));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  function closeSheet() {
    setSheetOpen(false);
    setTimeout(() => setDragY(0), 310);
  }

  function onHandlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartY.current    = e.clientY;
    isDraggingRef.current = true;
    setIsDragging(true);
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (!isDraggingRef.current) return;
    setDragY(Math.max(0, e.clientY - dragStartY.current));
  }

  function onHandlePointerUp() {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    const snap = dragY > 80;
    setDragY(0);
    if (snap) closeSheet();
  }

  function handleShare(id: string, name: string) {
    setSharedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); setToast(`Removed share for ${name}`); }
      else              { next.add(id);    setToast(`Flight shared with ${name}`); }
      return next;
    });
  }

  return (
    <>
      {/* ── Boarding pass card ── */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 20,
          boxShadow: "0 2px 20px rgba(0,0,0,0.08)",
          overflow: "visible",
          position: "relative",
        }}
      >
        {/* Tappable body */}
        <button
          className="w-full text-left transition-opacity active:opacity-80"
          onClick={() => setSheetOpen(true)}
          aria-label="View flight details"
          style={{ WebkitTapHighlightColor: "transparent", display: "block" }}
        >
          {/* Top strip: airline + status */}
          <div
            className="flex items-center justify-between px-6 pt-5 pb-4"
            style={{ borderRadius: "20px 20px 0 0", backgroundColor: "#FFFFFF" }}
          >
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "#9CA3AF" }}>
                {trip.airline ?? "Airline"}
              </p>
              <p className="text-base font-bold" style={{ color: "#1A1A2E" }}>
                {trip.flight_number ?? "—"}
              </p>
            </div>
            <StatusChip label={status.label} color={status.color} bg={status.bg} />
          </div>

          {/* Route: large airport codes + dashed vertical divider */}
          <div className="flex items-stretch px-6 pb-5 pt-1">
            {/* Origin */}
            <div className="flex-1 flex flex-col justify-center">
              <p
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontSize: 52,
                  fontWeight: 700,
                  color: "#1A1A2E",
                  lineHeight: 1,
                  letterSpacing: "-0.01em",
                }}
              >
                {trip.origin ?? "—"}
              </p>
              <p className="text-xs mt-2" style={{ color: "#6B7280" }}>
                {fmtTime(trip.departure_time, tz)} depart
              </p>
            </div>

            {/* Dashed vertical divider + plane icon */}
            <div className="flex flex-col items-center mx-5 py-2" style={{ width: 20 }}>
              <div style={{ flex: 1, width: 0, borderLeft: "2px dashed #E5E1D8" }} />
              <div className="py-2">
                <Plane className="h-4 w-4 rotate-90" style={{ color: "#4F46E5" }} />
              </div>
              <div style={{ flex: 1, width: 0, borderLeft: "2px dashed #E5E1D8" }} />
            </div>

            {/* Destination */}
            <div className="flex-1 flex flex-col justify-center items-end">
              <p
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontSize: 52,
                  fontWeight: 700,
                  color: "#1A1A2E",
                  lineHeight: 1,
                  letterSpacing: "-0.01em",
                }}
              >
                {trip.destination ?? "—"}
              </p>
              <p className="text-xs mt-2" style={{ color: "#6B7280" }}>
                boards {fmtTime(trip.boarding_time, tz)}
              </p>
            </div>
          </div>

          {/* Tear-line divider with notch circles */}
          <div className="relative" style={{ overflow: "visible" }}>
            <div
              style={{
                position: "absolute",
                left: -10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 20,
                height: 20,
                borderRadius: "50%",
                backgroundColor: "#F7F5F0",
                zIndex: 10,
              }}
            />
            <div style={{ borderTop: "2px dashed #E5E1D8", margin: "0 8px" }} />
            <div
              style={{
                position: "absolute",
                right: -10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 20,
                height: 20,
                borderRadius: "50%",
                backgroundColor: "#F7F5F0",
                zIndex: 10,
              }}
            />
          </div>

          {/* Gate / Terminal / Seat strip */}
          <div className="grid grid-cols-3 px-6 py-5">
            {[
              { label: "GATE",     value: trip.gate ?? "TBD",   accent: !!trip.gate },
              { label: "TERMINAL", value: trip.terminal ?? "—", accent: false },
              { label: "SEAT",     value: trip.seat ?? "—",     accent: !!trip.seat },
            ].map(({ label, value, accent }, i) => (
              <div key={label} className={`flex flex-col ${i === 1 ? "items-center border-x" : i === 2 ? "items-end" : ""}`}
                   style={{ borderColor: "#F3F4F6" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>
                  {label}
                </p>
                <p
                  className="text-xl font-bold"
                  style={{
                    fontFamily: "var(--font-playfair), serif",
                    color: accent ? "#4F46E5" : "#1A1A2E",
                  }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Shared family members strip */}
          {sharedMembers.length > 0 && (
            <div className="flex items-center gap-2 px-6 pb-4 pt-0">
              <div className="flex -space-x-1.5">
                {sharedMembers.map((m) => (
                  <AvatarDot key={m.id} initials={m.avatarInitials} color={m.avatarColor} size={22} active />
                ))}
              </div>
              <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
                Shared with {sharedMembers.length} {sharedMembers.length === 1 ? "member" : "members"}
              </p>
            </div>
          )}
        </button>

        {/* Action buttons — outside tappable area */}
        <div style={{ borderTop: "1px solid #F3F4F6", padding: "12px 16px", borderRadius: "0 0 20px 20px", backgroundColor: "#FFFFFF" }}>
          <div className="grid grid-cols-2 gap-3">
            <button
              className="rounded-2xl py-3 text-sm font-semibold"
              style={{ border: "1.5px solid #4F46E5", color: "#4F46E5", backgroundColor: "transparent" }}
              onClick={() => setSheetOpen(true)}
            >
              Boarding Pass
            </button>
            <Link
              href="/flight-status"
              className="flex items-center justify-center rounded-2xl py-3 text-sm font-semibold"
              style={{ backgroundColor: "#4F46E5", color: "#FFFFFF" }}
            >
              Track Flight
            </Link>
          </div>
        </div>
      </div>

      {/* ── Sheet ── */}
      <FlightDetailSheet
        trip={trip}
        open={sheetOpen}
        dragY={dragY}
        isDragging={isDragging}
        onClose={closeSheet}
        onHandlePointerDown={onHandlePointerDown}
        onHandlePointerMove={onHandlePointerMove}
        onHandlePointerUp={onHandlePointerUp}
        members={members}
        sharedIds={sharedIds}
        onShare={handleShare}
        tz={tz}
        arrivalTz={arrivalTz}
        arrivalTime={arrivalTime}
        duration={duration}
        baggageClaim={baggageClaim}
        status={status}
      />

      {/* ── Toast ── */}
      {toast && <Toast message={toast} />}
    </>
  );
}
