"use client";

import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, RefreshCw, Plane, Clock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { BottomNav } from "@/components/dashboard/BottomNav";
import type { FlightStatusData } from "@/app/api/flight-status/route";

const STATUS_META: Record<FlightStatusData["status"], { label: string; color: string; bg: string; icon: React.ElementType }> = {
  scheduled: { label: "On Time",   color: "#10B981", bg: "rgba(16,185,129,0.08)",  icon: CheckCircle },
  active:    { label: "In Flight", color: "#4F46E5", bg: "rgba(79,70,229,0.08)",   icon: Plane },
  landed:    { label: "Landed",    color: "#10B981", bg: "rgba(16,185,129,0.08)",  icon: CheckCircle },
  delayed:   { label: "Delayed",   color: "#F59E0B", bg: "rgba(245,158,11,0.08)",  icon: AlertTriangle },
  cancelled: { label: "Cancelled", color: "#EF4444", bg: "rgba(239,68,68,0.08)",   icon: XCircle },
  diverted:  { label: "Diverted",  color: "#F59E0B", bg: "rgba(245,158,11,0.08)",  icon: AlertTriangle },
  unknown:   { label: "Unknown",   color: "#9CA3AF", bg: "rgba(156,163,175,0.08)", icon: Clock },
};

const STAGES = ["Gate", "Departed", "In Air", "Landing", "Landed"] as const;
type Stage = typeof STAGES[number];

function flightStage(status: FlightStatusData["status"]): Stage {
  switch (status) {
    case "scheduled": case "delayed": return "Gate";
    case "active":    return "In Air";
    case "landed":    return "Landed";
    default:          return "Gate";
  }
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function countdown(iso: string | null): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "Departed";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function FlightStatusPage() {
  const [flightNum, setFlightNum] = useState("AA100");
  const [inputVal, setInputVal]   = useState("AA100");
  const [data, setData]           = useState<FlightStatusData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStatus = useCallback(async (fn: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/flight-status?flight=${encodeURIComponent(fn)}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Request failed");
      }
      setData(await res.json());
      setLastUpdated(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus(flightNum);
    const interval = setInterval(() => fetchStatus(flightNum), 60_000);
    return () => clearInterval(interval);
  }, [flightNum, fetchStatus]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fn = inputVal.trim().toUpperCase().replace(/\s+/g, "");
    if (fn) setFlightNum(fn);
  }

  const meta  = data ? STATUS_META[data.status] : null;
  const stage = data ? flightStage(data.status) : "Gate";
  const si    = STAGES.indexOf(stage);

  return (
    <>
      <main className="flex flex-col min-h-screen max-w-md mx-auto px-4 pt-6 pb-28" style={{ backgroundColor: "#F7F5F0" }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="p-2 rounded-xl" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", color: "#6B7280" }}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: "#1A1A2E" }}>Flight Tracker</h1>
            {lastUpdated && (
              <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
                Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            )}
          </div>
          <button
            onClick={() => fetchStatus(flightNum)}
            disabled={loading}
            className="p-2 rounded-xl"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", color: loading ? "#D1D5DB" : "#4F46E5" }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Search */}
        <form onSubmit={submit} className="flex gap-2 mb-6">
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="AA100, UA234…"
            className="flex-1 rounded-2xl px-4 py-2.5 text-sm outline-none"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", color: "#1A1A2E" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#4F46E5")}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "#E5E1D8")}
          />
          <button type="submit" className="rounded-2xl px-5 py-2.5 text-sm font-semibold" style={{ backgroundColor: "#4F46E5", color: "#FFFFFF" }}>
            Track
          </button>
        </form>

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
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ backgroundColor: "#E5E1D8" }} />)}
          </div>
        )}

        {data && meta && (
          <div className="space-y-4">
            {/* Status + route */}
            <div
              className="rounded-3xl p-5"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <p
                    className="text-2xl font-bold"
                    style={{ fontFamily: "var(--font-playfair), serif", color: "#1A1A2E" }}
                  >
                    {data.flightNumber}
                  </p>
                  {data.airline && (
                    <p className="text-sm mt-0.5" style={{ color: "#9CA3AF" }}>{data.airline}</p>
                  )}
                </div>
                <div
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                  style={{ backgroundColor: meta.bg, border: `1px solid ${meta.color}33` }}
                >
                  <meta.icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                  <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                  {data.delayMinutes && (
                    <span className="text-xs" style={{ color: meta.color }}>+{data.delayMinutes}m</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair), serif", color: "#1A1A2E" }}>
                    {data.depIata ?? "—"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{data.depAirport?.split(" ")[0] ?? ""}</p>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1">
                  <Plane className="h-4 w-4 rotate-90" style={{ color: "#4F46E5" }} />
                  <div className="w-full h-px" style={{ backgroundColor: "#E5E1D8" }} />
                  {data.aircraft && (
                    <p className="text-[10px]" style={{ color: "#9CA3AF" }}>{data.aircraft}</p>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair), serif", color: "#1A1A2E" }}>
                    {data.arrIata ?? "—"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{data.arrAirport?.split(" ")[0] ?? ""}</p>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div
              className="rounded-2xl p-4"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center justify-between mb-3">
                {STAGES.map((s, i) => (
                  <div key={s} className="flex flex-col items-center gap-1 relative" style={{ flex: 1 }}>
                    {i < STAGES.length - 1 && (
                      <div
                        className="absolute top-3 left-1/2 w-full h-0.5 transition-all duration-700"
                        style={{ backgroundColor: i < si ? "#4F46E5" : "#E5E1D8" }}
                      />
                    )}
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center relative z-10 transition-all duration-500"
                      style={{
                        backgroundColor: i <= si ? "#4F46E5" : "#F3F4F6",
                        border: `2px solid ${i <= si ? "#4F46E5" : "#E5E1D8"}`,
                      }}
                    >
                      {i < si && <div className="w-2 h-2 rounded-full bg-white" />}
                      {i === si && <div className="w-2 h-2 rounded-full animate-pulse bg-white" />}
                    </div>
                    <p className="text-[9px] font-medium text-center" style={{ color: i <= si ? "#4F46E5" : "#9CA3AF" }}>
                      {s}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Departure + arrival */}
            <div className="grid grid-cols-2 gap-3">
              <TimeCard
                label="Departure"
                scheduled={data.depScheduled} estimated={data.depEstimated} actual={data.depActual}
                gate={data.depGate} terminal={data.depTerminal} delayMinutes={data.delayMinutes}
              />
              <TimeCard
                label="Arrival"
                scheduled={data.arrScheduled} estimated={data.arrEstimated} actual={data.arrActual}
                gate={data.arrGate} terminal={data.arrTerminal}
              />
            </div>

            {/* Live data */}
            {data.live && (
              <div
                className="rounded-2xl p-4"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(79,70,229,0.20)", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
              >
                <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "#4F46E5" }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ backgroundColor: "#4F46E5" }} />
                  Live Tracking
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <LiveStat label="Altitude" value={`${data.live.altitude?.toLocaleString() ?? "—"} ft`} />
                  <LiveStat label="Speed"    value={`${Math.round(data.live.speed ?? 0)} kts`} />
                  <LiveStat label="Position" value={`${data.live.lat?.toFixed(1) ?? "?"}°, ${data.live.lng?.toFixed(1) ?? "?"}°`} />
                </div>
              </div>
            )}

            {/* Countdown */}
            {(data.status === "scheduled" || data.status === "delayed") && data.depEstimated && (
              <div
                className="rounded-2xl p-4 text-center"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8" }}
              >
                <p className="text-xs font-medium mb-1" style={{ color: "#9CA3AF" }}>Departs in</p>
                <p className="text-3xl font-bold" style={{ fontFamily: "var(--font-playfair), serif", color: "#4F46E5" }}>
                  {countdown(data.depEstimated ?? data.depScheduled)}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}

function TimeCard({ label, scheduled, estimated, actual, gate, terminal, delayMinutes }: {
  label: string;
  scheduled: string | null; estimated: string | null; actual: string | null;
  gate: string | null; terminal: string | null; delayMinutes?: number | null;
}) {
  const displayTime = actual ?? estimated ?? scheduled;
  const isDelayed   = delayMinutes && delayMinutes > 5 && !actual;

  return (
    <div
      className="rounded-2xl p-3"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#9CA3AF" }}>
        {label}
      </p>
      <p
        className="text-xl font-bold"
        style={{ fontFamily: "var(--font-playfair), serif", color: isDelayed ? "#F59E0B" : "#1A1A2E" }}
      >
        {fmtTime(displayTime)}
      </p>
      {scheduled && estimated && estimated !== scheduled && !actual && (
        <p className="text-[10px] line-through mt-0.5" style={{ color: "#9CA3AF" }}>
          {fmtTime(scheduled)}
        </p>
      )}
      <div className="flex gap-2 mt-2">
        {terminal && (
          <span className="text-[10px] font-medium rounded-md px-1.5 py-0.5" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
            T{terminal}
          </span>
        )}
        {gate && (
          <span className="text-[10px] font-semibold rounded-md px-1.5 py-0.5" style={{ backgroundColor: "rgba(79,70,229,0.08)", color: "#4F46E5" }}>
            Gate {gate}
          </span>
        )}
      </div>
    </div>
  );
}

function LiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "#9CA3AF" }}>{label}</p>
      <p className="text-xs font-semibold" style={{ color: "#1A1A2E" }}>{value}</p>
    </div>
  );
}
