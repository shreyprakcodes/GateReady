"use client";

import { useEffect, useState } from "react";
import { Plane } from "lucide-react";

interface Props {
  flightNumber?:      string;
  origin?:            string;
  destination?:       string;
  departureTime?:     string;
  departureTimezone?: string | null;
  currentStep?:       string;
  leaveInMinutes?:    number;
  compact?:           boolean;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function fmtTime(d: Date, tz?: string | null): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
    ...(tz ? { timeZone: tz } : {}),
  });
}

function leaveColor(mins: number): string {
  if (mins > 60) return "#10B981";
  if (mins > 20) return "#F59E0B";
  return "#EF4444";
}

export function FlightWidget({ flightNumber, origin, destination, departureTime, departureTimezone, currentStep, leaveInMinutes, compact = false }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const depDate = departureTime ? new Date(departureTime) : null;
  const minsToLeave = leaveInMinutes ?? (depDate ? Math.max(0, Math.floor((depDate.getTime() - now.getTime() - 3600000) / 60000)) : null);
  const color = minsToLeave !== null ? leaveColor(minsToLeave) : "#4F46E5";

  const h = Math.floor((minsToLeave ?? 0) / 60);
  const m = (minsToLeave ?? 0) % 60;

  if (compact) {
    return (
      <div
        className="rounded-2xl px-4 py-3 inline-flex items-center gap-3 w-full"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E1D8",
          boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}10` }}
        >
          <Plane className="h-4 w-4 rotate-45" style={{ color }} />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color }}>
            {minsToLeave !== null
              ? h > 0 ? `Leave in ${h}h ${pad2(m)}m` : `Leave in ${m}m`
              : "—"}
          </p>
          <p className="text-[10px]" style={{ color: "#9CA3AF" }}>
            {flightNumber ?? "—"} · {origin ?? "?"} → {destination ?? "?"}
            {depDate ? ` · ${fmtTime(depDate, departureTimezone)}` : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-3xl p-6 flex flex-col gap-5"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E1D8",
        boxShadow: "0 2px 20px rgba(0,0,0,0.07)",
        minWidth: 280,
        maxWidth: 340,
      }}
    >
      <div className="flex items-baseline justify-between">
        <p
          className="text-5xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-playfair), serif", color: "#1A1A2E" }}
        >
          {pad2(now.getHours())}:{pad2(now.getMinutes())}
        </p>
        <p className="text-sm" style={{ color: "#9CA3AF" }}>
          {now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
        </p>
      </div>

      {minsToLeave !== null && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#9CA3AF" }}>
            Leave in
          </p>
          <p className="text-3xl font-bold" style={{ color }}>
            {h > 0 ? `${h}h ${pad2(m)}m` : `${m}m`}
          </p>
        </div>
      )}

      <div className="h-px" style={{ backgroundColor: "#E5E1D8" }} />

      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}10` }}
        >
          <Plane className="h-5 w-5 rotate-45" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>
            {flightNumber ?? "—"} · {origin ?? "?"} → {destination ?? "?"}
          </p>
          {depDate && (
            <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>Departs {fmtTime(depDate, departureTimezone)}</p>
          )}
        </div>
      </div>

      {currentStep && (
        <div
          className="rounded-xl px-3 py-2"
          style={{ backgroundColor: `${color}08`, border: `1px solid ${color}20` }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "#9CA3AF" }}>
            Next step
          </p>
          <p className="text-xs font-medium" style={{ color }}>
            {currentStep}
          </p>
        </div>
      )}
    </div>
  );
}
