"use client";

import { useEffect, useState } from "react";
import { useLocationStore } from "@/src/store/locationStore";

export function LocationDebugCard() {
  const coords = useLocationStore((s) => s.coords);
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Reset and tick whenever coords.updatedAt changes
  useEffect(() => {
    if (!coords) return;
    setSecondsAgo(0);
    const id = setInterval(() => setSecondsAgo((s) => s + 1), 1_000);
    return () => clearInterval(id);
  }, [coords?.updatedAt]);

  if (!coords) return null;

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E1D8",
        borderLeftWidth: 3,
        borderLeftColor: "#4F46E5",
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: "#1A1A2E", fontFamily: "var(--font-inter)" }}
          >
            📍 Your Location
          </span>
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: "#10B981" }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ backgroundColor: "#10B981" }}
            />
          </span>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: "rgba(245,158,11,0.12)",
            color: "#B45309",
          }}
        >
          DEV
        </span>
      </div>

      {/* Data grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <CoordCell label="Latitude"     value={coords.lat.toFixed(4)} />
        <CoordCell label="Longitude"    value={coords.lng.toFixed(4)} />
        <CoordCell label="Accuracy"     value={`±${Math.round(coords.accuracy)}m`} />
        <CoordCell
          label="Last updated"
          value={secondsAgo < 3 ? "Just now" : `${secondsAgo}s ago`}
        />
      </div>
    </div>
  );
}

function CoordCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="text-[10px] font-medium uppercase tracking-wide mb-0.5"
        style={{ color: "#9CA3AF" }}
      >
        {label}
      </p>
      <p
        className="text-sm font-semibold"
        style={{ color: "#1A1A2E", fontFamily: "var(--font-inter)", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}
