"use client";

import type { ReactNode } from "react";
import { Plane } from "lucide-react";
import type { Database } from "@/lib/supabase/types";
import { getAirlineTheme } from "@/lib/airlineThemes";
import { fmtFlightTime, resolveFlightTime } from "@/lib/utils/time";

type Trip = Database["public"]["Tables"]["trips"]["Row"];

interface Props {
  trip:      Trip;
  /** IATA airline code extracted from the flight number, e.g. "AA" */
  airlineCode: string | null;
  isSample?: boolean;
}

// ── Small label + value block used in the data grid ──────────────────────────

function DataBlock({
  label, value, mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p
        className="text-[10px] font-bold uppercase tracking-widest mb-1"
        style={{ color: "#B5A89A" }}
      >
        {label}
      </p>
      <p
        className="text-sm font-bold leading-snug"
        style={{ color: "#1A1A2E", fontFamily: mono ? "monospace" : undefined }}
      >
        {value}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BoardingPass({ trip, airlineCode, isSample }: Props) {
  const theme = getAirlineTheme(airlineCode);
  const tz    = trip.departure_timezone;

  const { effectiveStr, scheduledStr, deltaLabel } = resolveFlightTime(
    trip.departure_scheduled ?? trip.departure_time,
    trip.departure_estimated,
    trip.departure_actual,
    tz,
    { showTzLabel: true },
  );

  const statusLabel = (() => {
    switch (trip.status) {
      case "boarding":  return "Boarding";
      case "departed":  return "Departed";
      case "delayed":   return "Delayed";
      case "cancelled": return "Cancelled";
      case "landed":    return "Landed";
      default:          return "Scheduled";
    }
  })();

  const statusColor = (() => {
    switch (trip.status) {
      case "delayed":
      case "cancelled": return "#E01933";
      case "landed":
      case "departed":  return "#00C48C";
      case "boarding":  return "#F5A623";
      default:          return "#1A1A2E";
    }
  })();

  const dateStr = trip.departure_time
    ? new Date(trip.departure_time).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
        ...(tz ? { timeZone: tz } : {}),
      })
    : "—";

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{
        backgroundColor: "#FFFFFF",
        boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
      }}
    >
      {/* ── Sample data banner ─────────────────────────────────── */}
      {isSample && (
        <div
          className="px-5 py-2 text-center text-[11px] font-semibold"
          style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
        >
          Sample data — details may not match your actual flight
        </div>
      )}

      {/* ── Airline band ───────────────────────────────────────── */}
      <div
        className="px-6 pt-5 pb-4 flex items-center justify-between"
        style={{ backgroundColor: theme.primary }}
      >
        <p
          className="text-sm font-bold tracking-wide"
          style={{ color: theme.onPrimary, opacity: 0.92 }}
        >
          {/* Use the trip's stored airline name if available; fall back to theme */}
          {trip.airline ?? theme.displayName}
        </p>
        <p
          className="text-base font-bold tracking-widest"
          style={{ color: theme.onPrimary, fontFamily: "monospace" }}
        >
          {trip.flight_number ?? "—"}
        </p>
      </div>

      {/* ── Hero: Origin → Destination ─────────────────────────── */}
      <div className="px-6 pt-6 pb-5 flex items-center gap-3">
        {/* Origin */}
        <div className="flex-1 min-w-0">
          <p
            className="text-[52px] font-black leading-none tracking-tight"
            style={{ color: "#1A1A2E", fontFamily: "monospace" }}
          >
            {trip.origin ?? "—"}
          </p>
          <p className="text-xs mt-1.5 font-medium" style={{ color: "#B5A89A" }}>
            {trip.origin ?? ""}
          </p>
        </div>

        {/* Plane glyph */}
        <div className="flex flex-col items-center shrink-0 gap-1 px-1">
          <div className="h-px w-10" style={{ backgroundColor: theme.primary, opacity: 0.25 }} />
          <Plane className="h-5 w-5" style={{ color: theme.primary, transform: "rotate(90deg)" }} />
          <div className="h-px w-10" style={{ backgroundColor: theme.primary, opacity: 0.25 }} />
        </div>

        {/* Destination */}
        <div className="flex-1 min-w-0 text-right">
          <p
            className="text-[52px] font-black leading-none tracking-tight"
            style={{ color: "#1A1A2E", fontFamily: "monospace" }}
          >
            {trip.destination ?? "—"}
          </p>
          <p className="text-xs mt-1.5 font-medium" style={{ color: "#B5A89A" }}>
            {trip.destination ?? ""}
          </p>
        </div>
      </div>

      {/* ── Data grid ──────────────────────────────────────────── */}
      <div
        className="mx-6 mb-5 pt-4 grid grid-cols-2 gap-y-5 gap-x-6"
        style={{ borderTop: "1px solid #F0EAE2" }}
      >
        <DataBlock label="Date" value={dateStr} />
        <DataBlock
          label="Departs"
          value={
            <span>
              {effectiveStr}
              {scheduledStr && (
                <> <s style={{ opacity: 0.45, fontSize: "0.875em" }}>{scheduledStr}</s></>
              )}
              {deltaLabel && (
                <span
                  className="block text-[11px] font-bold mt-0.5"
                  style={{ color: "#E01933" }}
                >
                  {deltaLabel}
                </span>
              )}
            </span>
          }
        />
        <DataBlock label="Gate"     value={trip.gate     ?? "—"} mono />
        <DataBlock label="Terminal" value={trip.terminal ?? "—"} mono />
        <DataBlock
          label="Seat"
          value={
            trip.seat
              ? <span style={{ color: theme.primary }}>{trip.seat}</span>
              : "—"
          }
          mono
        />
        <DataBlock
          label="Status"
          value={<span style={{ color: statusColor }}>{statusLabel}</span>}
        />
      </div>

      {/* ── Perforated tear-line ───────────────────────────────── */}
      <div className="relative" style={{ overflow: "visible" }}>
        <div
          style={{
            position: "absolute", left: -12, top: "50%",
            transform: "translateY(-50%)",
            width: 24, height: 24, borderRadius: "50%",
            backgroundColor: "#FAF7F2", zIndex: 10,
          }}
        />
        <div style={{ margin: "0 12px", borderTop: "2px dashed #E8E0D5" }} />
        <div
          style={{
            position: "absolute", right: -12, top: "50%",
            transform: "translateY(-50%)",
            width: 24, height: 24, borderRadius: "50%",
            backgroundColor: "#FAF7F2", zIndex: 10,
          }}
        />
      </div>

      {/* ── Stub (below tear-line) ──────────────────────────────── */}
      <div
        className="px-6 py-4 flex items-center justify-between gap-4"
        style={{ backgroundColor: "#FAF7F2" }}
      >
        {/* Passenger + boarding time */}
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: "#B5A89A" }}
          >
            Boarding
          </p>
          <p
            className="text-sm font-bold"
            style={{ color: "#1A1A2E", fontFamily: "monospace" }}
          >
            {trip.boarding_time
              ? fmtFlightTime(trip.boarding_time, tz)
              : trip.departure_time
                ? fmtFlightTime(trip.departure_time, tz)
                : "—"}
          </p>
        </div>

        {/* Decorative barcode (CSS only, not scannable) */}
        <div className="flex items-center gap-px shrink-0 overflow-hidden" style={{ maxWidth: 140 }}>
          {Array.from({ length: 30 }, (_, i) => (
            <div
              key={i}
              style={{
                width:           i % 4 === 0 ? 3 : i % 7 === 0 ? 1 : 2,
                height:          38,
                backgroundColor: "#1A1A2E",
                opacity:         0.08 + (i % 8) * 0.055,
                borderRadius:    1,
                flexShrink:      0,
              }}
            />
          ))}
        </div>

        {/* Seat */}
        <div className="text-right">
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: "#B5A89A" }}
          >
            Seat
          </p>
          <p
            className="text-sm font-bold"
            style={{ color: trip.seat ? theme.primary : "#1A1A2E", fontFamily: "monospace" }}
          >
            {trip.seat ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
