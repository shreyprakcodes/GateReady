"use client";

import { RefreshCw } from "lucide-react";
import { useTsaWaitTime } from "@/src/hooks/useTsaWaitTime";

export interface TsaWaitCardProps {
  airportCode: string;
  airportName: string;
  terminalHint?: string;
}

export function TsaWaitCard({ airportCode, airportName, terminalHint }: TsaWaitCardProps) {
  const { data, loadState, fetching, error, secondsAgo, refresh } = useTsaWaitTime(airportCode);

  const standardLane = data?.lanes.find((l) => l.type === "standard") ?? data?.lanes[0] ?? null;
  const waitMinutes  = standardLane?.waitMinutes ?? null;

  const isHistorical = loadState === "historical";
  const isLoading    = fetching && !data;

  const waitColor =
    waitMinutes === null ? "#4F46E5"
    : waitMinutes < 10  ? "#10B981"
    : waitMinutes <= 20 ? "#F59E0B"
    : "#EF4444";

  return (
    <div
      className="relative rounded-2xl p-5"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E1D8",
        borderLeftWidth: 3,
        borderLeftColor: "#4F46E5",
        boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>
            TSA Wait · {airportCode}
          </p>
          <p className="text-sm font-medium truncate" style={{ color: "#1A1A2E" }}>{airportName}</p>
          {terminalHint && (
            <p className="text-[11px]" style={{ color: "#9CA3AF" }}>{terminalHint}</p>
          )}
        </div>

        {!isLoading && (
          <div className="flex items-center gap-1.5 shrink-0">
            {isHistorical ? (
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
            ) : (
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: "#10B981" }}
                />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: "#10B981" }} />
              </span>
            )}
            <span
              className="text-[10px] font-semibold"
              style={{ color: isHistorical ? "#F59E0B" : "#10B981" }}
            >
              {isHistorical ? "Est." : "Live"}
            </span>
          </div>
        )}
      </div>

      {/* Main wait time */}
      <div aria-live="polite" aria-atomic="true" className="mb-3">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-10 w-28 rounded-xl animate-pulse" style={{ backgroundColor: "#F3F4F6" }} />
            <div className="h-3 w-40 rounded-full animate-pulse" style={{ backgroundColor: "#F3F4F6" }} />
          </div>
        ) : error ? (
          <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>
        ) : (
          <>
            <p
              className="text-4xl font-bold leading-none"
              style={{ color: waitColor, letterSpacing: "-0.02em" }}
            >
              {isHistorical ? "~" : ""}{waitMinutes ?? "—"}
              <span className="text-base font-normal ml-1.5" style={{ color: "#9CA3AF" }}>min</span>
            </p>
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
              Standard lane
              {waitMinutes !== null && (
                <> · {waitMinutes < 10 ? "Short" : waitMinutes < 20 ? "Moderate" : "Long"}</>
              )}
            </p>
          </>
        )}
      </div>

      {/* Historical disclaimer */}
      {isHistorical && data?.historicalNote && (
        <div
          className="rounded-xl px-3 py-2 mb-3"
          style={{ backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}
        >
          <p className="text-[11px] leading-relaxed" style={{ color: "#B45309" }}>
            {data.historicalNote}
          </p>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
          {isLoading
            ? "Fetching…"
            : secondsAgo < 5
            ? "Just updated"
            : `Updated ${secondsAgo}s ago`}
        </p>
        <button
          onClick={refresh}
          disabled={fetching}
          aria-label="Refresh TSA wait times"
          className="p-1.5 rounded-lg transition-opacity"
          style={{
            backgroundColor: "transparent",
            border: "1px solid #E5E1D8",
            color: fetching ? "#D1D5DB" : "#4F46E5",
            opacity: fetching ? 0.5 : 1,
          }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}
