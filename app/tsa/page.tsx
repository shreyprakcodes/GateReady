"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ArrowLeft, RefreshCw, Shield, CheckCircle, AlertTriangle, XCircle, Star, Info } from "lucide-react";
import Link from "next/link";
import { BottomNav } from "@/components/dashboard/BottomNav";
import { useStore } from "@/lib/store/useStore";
import type { TsaWaitData } from "@/app/api/tsa/route";

type ColorKey = "green" | "amber" | "red";

const COLOR: Record<ColorKey, { text: string; bg: string; border: string }> = {
  green: { text: "#10B981", bg: "rgba(16,185,129,0.08)",   border: "rgba(16,185,129,0.22)"  },
  amber: { text: "#F59E0B", bg: "rgba(245,158,11,0.08)",   border: "rgba(245,158,11,0.22)"  },
  red:   { text: "#EF4444", bg: "rgba(239,68,68,0.08)",    border: "rgba(239,68,68,0.22)"   },
};

const ICON: Record<ColorKey, React.ElementType> = {
  green: CheckCircle,
  amber: AlertTriangle,
  red:   XCircle,
};

function waitColor(min: number): ColorKey {
  if (min < 10) return "green";
  if (min <= 20) return "amber";
  return "red";
}

const COMMON_AIRPORTS = ["PHX", "JFK", "LAX", "ORD", "ATL", "DFW", "SFO", "LGA", "EWR", "BOS", "MIA"];

export default function TsaPage() {
  const activeOrigin = useStore((s) => s.trip?.origin ?? "");
  const [airport, setAirport]         = useState(activeOrigin || "JFK");
  const [inputVal, setInputVal]       = useState(activeOrigin || "JFK");
  const [data, setData]               = useState<TsaWaitData | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo]   = useState(0);
  const [precheck, setPrecheck]       = useState(false);
  const [clear, setClear]             = useState(false);

  const secondsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (ap: string) => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/tsa?airport=${encodeURIComponent(ap)}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json as TsaWaitData);
      setLastUpdated(new Date());
      setSecondsAgo(0);
      if (secondsRef.current) clearInterval(secondsRef.current);
      secondsRef.current = setInterval(() => setSecondsAgo((s) => s + 1), 1_000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => () => { if (secondsRef.current) clearInterval(secondsRef.current); }, []);

  // Sync to active trip's origin if it loads after initial render
  useEffect(() => {
    if (activeOrigin && activeOrigin !== airport) {
      setAirport(activeOrigin);
      setInputVal(activeOrigin);
    }
  // intentionally run only when activeOrigin changes, not airport
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrigin]);

  useEffect(() => {
    fetchData(airport);
    const interval = setInterval(() => fetchData(airport), 60_000);
    return () => clearInterval(interval);
  }, [airport, fetchData]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ap = inputVal.trim().toUpperCase();
    if (ap.length >= 3) setAirport(ap.slice(0, 3));
  }

  const isHistorical = data?.source === "historical";
  const isLive       = data?.source === "live";

  const bestLane = data?.lanes.slice().sort((a, b) => {
    if (precheck && a.type === "precheck") return -1;
    if (clear    && a.type === "clear")    return -1;
    return a.waitMinutes - b.waitMinutes;
  })[0];

  return (
    <>
      <main
        className="flex flex-col min-h-screen max-w-md mx-auto px-4 pt-6 pb-28"
        style={{ backgroundColor: "#F7F5F0" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="p-2 rounded-xl"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", color: "#6B7280" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ color: "#1A1A2E" }}>
              TSA Wait Times
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {data && (
                <span className="relative flex h-2 w-2 shrink-0">
                  {isLive && (
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ backgroundColor: "#10B981" }}
                    />
                  )}
                  <span
                    className="relative inline-flex rounded-full h-2 w-2"
                    style={{ backgroundColor: isLive ? "#10B981" : "#F59E0B" }}
                  />
                </span>
              )}
              {lastUpdated ? (
                <p className="text-[11px] truncate" style={{ color: "#9CA3AF" }}>
                  {isLive ? "Live · " : "Historical · "}
                  {secondsAgo < 5 ? "Just updated" : `Updated ${secondsAgo}s ago`}
                  {" · "}Refreshes in {Math.max(0, 60 - secondsAgo)}s
                </p>
              ) : (
                <p className="text-[11px]" style={{ color: "#9CA3AF" }}>Checking…</p>
              )}
            </div>
          </div>
          <button
            onClick={() => fetchData(airport)}
            disabled={loading}
            className="p-2 rounded-xl shrink-0"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E1D8",
              color: loading ? "#D1D5DB" : "#4F46E5",
            }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Historical disclaimer */}
        {data && isHistorical && (
          <div
            className="rounded-2xl px-4 py-3 mb-5 flex items-start gap-3"
            style={{ backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}
          >
            <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
            <p className="text-[12px] leading-relaxed" style={{ color: "#B45309" }}>
              {data.historicalNote ?? `Live data unavailable · Estimates based on historical averages for ${airport} at this time of day`}
            </p>
          </div>
        )}

        {/* Airport search */}
        <form onSubmit={submit} className="flex gap-2 mb-4">
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="JFK"
            maxLength={3}
            className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-mono outline-none uppercase"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E1D8",
              color: "#1A1A2E",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#4F46E5")}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "#E5E1D8")}
          />
          <button
            type="submit"
            className="rounded-2xl px-5 text-sm font-semibold"
            style={{ backgroundColor: "#4F46E5", color: "#FFFFFF" }}
          >
            Check
          </button>
        </form>

        {/* Quick airports */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-5 scrollbar-none">
          {COMMON_AIRPORTS.map((ap) => (
            <button
              key={ap}
              onClick={() => { setAirport(ap); setInputVal(ap); }}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold shrink-0 font-mono transition-all"
              style={{
                backgroundColor: airport === ap ? "rgba(79,70,229,0.08)" : "#FFFFFF",
                border: `1px solid ${airport === ap ? "#4F46E5" : "#E5E1D8"}`,
                color: airport === ap ? "#4F46E5" : "#6B7280",
              }}
            >
              {ap}
            </button>
          ))}
        </div>

        {/* Status toggles */}
        <div className="flex gap-2 mb-5">
          <Toggle label="TSA PreCheck" on={precheck} onChange={setPrecheck} color="#4F46E5" icon={Shield} />
          <Toggle label="CLEAR"        on={clear}    onChange={setClear}    color="#10B981" icon={Star}   />
        </div>

        {error && (
          <div
            className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-2"
            style={{ backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", color: "#EF4444" }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading && !data && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ backgroundColor: "#E5E1D8" }} />
            ))}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {bestLane && (
              <div
                className="rounded-2xl p-4"
                style={{ backgroundColor: "rgba(79,70,229,0.05)", border: "1px solid rgba(79,70,229,0.18)" }}
              >
                <p className="text-xs font-semibold mb-1" style={{ color: "#4F46E5" }}>
                  ✦ Recommended lane
                </p>
                <p className="text-lg font-bold" style={{ color: "#1A1A2E" }}>
                  {bestLane.name}
                </p>
                <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
                  {isHistorical ? "~" : ""}{bestLane.waitMinutes} min wait ·{" "}
                  {bestLane.waitMinutes < 10 ? "Short line" : bestLane.waitMinutes < 20 ? "Moderate" : "Long line"}
                </p>
              </div>
            )}

            <div className="space-y-3">
              {data.lanes.map((lane, i) => {
                const c       = waitColor(lane.waitMinutes);
                const style   = COLOR[c];
                const Icon    = ICON[c];
                const isUserLane = (precheck && lane.type === "precheck") || (clear && lane.type === "clear");

                return (
                  <div
                    key={i}
                    className="rounded-2xl p-4 flex items-center gap-4"
                    style={{
                      backgroundColor: isUserLane ? style.bg : "#FFFFFF",
                      border: `1px solid ${isUserLane ? style.border : "#E5E1D8"}`,
                      boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: style.bg }}
                    >
                      <Icon className="h-5 w-5" style={{ color: style.text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold" style={{ color: "#1A1A2E" }}>{lane.name}</p>
                        {isUserLane && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: "rgba(79,70,229,0.08)", color: "#4F46E5" }}
                          >
                            Your lane
                          </span>
                        )}
                        {isHistorical && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: "rgba(245,158,11,0.08)", color: "#F59E0B" }}
                          >
                            est.
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <WaitBar minutes={lane.waitMinutes} color={style.text} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className="text-xl font-bold"
                        style={{ fontFamily: "var(--font-playfair), serif", color: style.text }}
                      >
                        {isHistorical ? "~" : ""}{lane.waitMinutes}
                      </p>
                      <p className="text-[10px]" style={{ color: "#9CA3AF" }}>min</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}

function WaitBar({ minutes, color }: { minutes: number; color: string }) {
  const pct = Math.min((minutes / 45) * 100, 100);
  return (
    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E1D8" }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function Toggle({ label, on, onChange, color, icon: Icon }: {
  label: string; on: boolean; onChange: (v: boolean) => void; color: string; icon: React.ElementType;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all"
      style={{
        backgroundColor: on ? `${color}10` : "#FFFFFF",
        border: `1px solid ${on ? color + "44" : "#E5E1D8"}`,
        color: on ? color : "#6B7280",
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
