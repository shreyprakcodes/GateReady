"use client";

import { useState, useEffect } from "react";

interface Window {
  comfortable: string;
  tight: string;
  cutoff: string;
}

interface Props {
  departureWindow: Window | null;
  boardingTime:    string | null;
  departureTz?:    string | null;
}

function fmt(iso: string, tz?: string | null) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
    ...(tz ? { timeZone: tz } : {}),
  });
}

function classify(window: Window): "comfortable" | "tight" | "cutting" {
  const now = Date.now();
  if (now <= new Date(window.comfortable).getTime()) return "comfortable";
  if (now <= new Date(window.tight).getTime()) return "tight";
  return "cutting";
}

export function DepartureWindow({ departureWindow, boardingTime, departureTz }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!departureWindow) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#9CA3AF" }}>
          Departure Window
        </p>
        <p className="text-sm" style={{ color: "#9CA3AF" }}>
          Ask GateReady to calculate your departure window.
        </p>
      </div>
    );
  }

  // classify() uses Date.now() and fmt() uses the local timezone — both unsafe on SSR.
  // Defer both until the component is mounted on the client.
  const f     = mounted ? (iso: string) => fmt(iso, departureTz) : (_: string) => "—";
  const state = mounted ? classify(departureWindow) : "comfortable";

  const segments = [
    { key: "comfortable", label: "Comfortable", time: f(departureWindow.comfortable), barColor: "#10B981", textColor: "#10B981", flex: 3, active: state === "comfortable" },
    { key: "tight",       label: "Tight",       time: f(departureWindow.tight),       barColor: "#F59E0B", textColor: "#F59E0B", flex: 2, active: state === "tight"       },
    { key: "cutting",     label: "Cutting It",  time: f(departureWindow.cutoff),      barColor: "#EF4444", textColor: "#EF4444", flex: 1, active: state === "cutting"     },
  ];

  const activeColor = state === "comfortable" ? "#10B981" : state === "tight" ? "#F59E0B" : "#EF4444";

  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: "#9CA3AF" }}>
        Departure Window
      </p>

      <div className="flex rounded-full overflow-hidden h-2 gap-px">
        {segments.map((s) => (
          <div
            key={s.key}
            className="transition-all"
            style={{ flex: s.flex, backgroundColor: s.barColor, opacity: s.active ? 1 : 0.18 }}
          />
        ))}
      </div>

      <div className="flex mt-3.5 gap-2">
        {segments.map((s) => (
          <div key={s.key} className="flex-1">
            <p className="text-[10px] font-semibold" style={{ color: s.active ? s.textColor : "#D1D5DB" }}>
              {s.label}
            </p>
            <p
              className="text-xs font-bold mt-0.5"
              style={{ color: s.active ? "#1A1A2E" : "#D1D5DB" }}
            >
              {s.time}
            </p>
          </div>
        ))}
      </div>

      {boardingTime && (
        <p className="mt-4 text-[11px]" style={{ color: "#9CA3AF" }}>
          Boards {f(boardingTime)} · Leave by{" "}
          <span className="font-semibold" style={{ color: activeColor }}>
            {state === "comfortable"
              ? f(departureWindow.comfortable)
              : state === "tight"
              ? f(departureWindow.tight)
              : f(departureWindow.cutoff)}
          </span>
        </p>
      )}
    </div>
  );
}
