"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Plane, Car, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type ItineraryStep = Database["public"]["Tables"]["itinerary_steps"]["Row"];

interface Metrics {
  tsaWait: string;
  flightStatus: string;
  traffic: string;
}

function deriveMetrics(steps: ItineraryStep[]): Metrics {
  const tsa     = steps.find((s) => s.step_type === "tsa");
  const flight  = steps.find((s) => s.step_type === "flight");
  const traffic = steps.find((s) => s.step_type === "transport");
  return {
    tsaWait:      tsa?.detail    ?? "—",
    flightStatus: flight?.detail ?? "On time",
    traffic:      traffic?.detail ?? "—",
  };
}

interface Props {
  tripId: string;
  initialSteps?: ItineraryStep[];
}

export function LiveStrip({ tripId, initialSteps = [] }: Props) {
  const [steps, setSteps]             = useState<ItineraryStep[]>(initialSteps);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-strip-${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "itinerary_steps", filter: `trip_id=eq.${tripId}` },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            setSteps((prev) => {
              const idx = prev.findIndex((s) => s.id === (payload.new as ItineraryStep).id);
              return idx >= 0
                ? prev.map((s) => s.id === (payload.new as ItineraryStep).id ? payload.new as ItineraryStep : s)
                : [...prev, payload.new as ItineraryStep];
            });
            setLastUpdated(new Date());
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tripId]);

  const metrics = deriveMetrics(steps);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <MetricTile icon={<ShieldCheck className="h-4 w-4" />} label="TSA"     value={metrics.tsaWait}      accent="#4F46E5" />
        <MetricTile icon={<Plane      className="h-4 w-4" />} label="Flight"   value={metrics.flightStatus} accent="#10B981" />
        <MetricTile icon={<Car        className="h-4 w-4" />} label="Traffic"  value={metrics.traffic}      accent="#F59E0B" />
      </div>
      <div className="flex items-center gap-1.5 px-0.5">
        <RefreshCw className="h-3 w-3" style={{ color: "#9CA3AF" }} />
        <span className="text-[10px] font-medium" style={{ color: "#9CA3AF" }}>
          Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

function MetricTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div
      className="rounded-2xl p-3.5"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center gap-1.5 mb-2.5">
        <span style={{ color: accent }}>{icon}</span>
        <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "#9CA3AF" }}>
          {label}
        </span>
      </div>
      <p className="text-sm font-bold truncate" style={{ color: "#1A1A2E" }}>
        {value}
      </p>
    </div>
  );
}
