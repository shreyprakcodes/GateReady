"use client";

import { useLocationStore } from "@/src/store/locationStore";

export function LocationLiveChip() {
  const coords = useLocationStore((s) => s.coords);
  if (!coords) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
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
      <span
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "#10B981" }}
      >
        Live
      </span>
    </span>
  );
}
