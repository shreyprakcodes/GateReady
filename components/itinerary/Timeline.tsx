"use client";

import { useEffect, useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StepCard } from "./StepCard";
import type { Database } from "@/lib/supabase/types";

type Step = Database["public"]["Tables"]["itinerary_steps"]["Row"];

interface Props {
  tripId: string;
  userId: string;
  initialSteps: Step[];
  onAskAgent: (prompt: string) => void;
}

export function Timeline({ tripId, userId, initialSteps, onAskAgent }: Props) {
  const [steps, setSteps]           = useState<Step[]>(
    [...initialSteps].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  );
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError]     = useState("");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`timeline-${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "itinerary_steps", filter: `trip_id=eq.${tripId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setSteps((prev) =>
              [...prev, payload.new as Step].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            );
          } else if (payload.eventType === "UPDATE") {
            setSteps((prev) =>
              prev.map((s) => s.id === (payload.new as Step).id ? (payload.new as Step) : s)
            );
          } else if (payload.eventType === "DELETE") {
            setSteps((prev) => prev.filter((s) => s.id !== (payload.old as Step).id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tripId]);

  const activeIndex = steps.findIndex((s) => s.status === "upcoming");

  async function handleCompleted(step: Step) {
    setSteps((prev) =>
      prev.map((s) => s.id === step.id ? { ...s, status: "done" } : s)
    );
    const supabase = createClient();
    await supabase.from("trip_events").insert({
      user_id: userId,
      trip_id: tripId,
      event_type: "step_completed",
      data: { step_id: step.id, actual_time: new Date().toISOString() },
    });
  }

  async function generateItinerary() {
    if (!tripId || generating) return;
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/itinerary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Generation failed");
      }
      const data = await res.json();
      setSteps(data.steps ?? []);
    } catch (e) {
      setGenError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: "rgba(79,70,229,0.06)", border: "1px solid rgba(79,70,229,0.15)" }}
        >
          <Sparkles className="h-6 w-6" style={{ color: "#4F46E5" }} />
        </div>
        <p className="text-sm font-semibold mb-1" style={{ color: "#1A1A2E" }}>No itinerary yet</p>
        <p className="text-xs mb-5" style={{ color: "#9CA3AF" }}>
          GateReady calculates your step-by-step timeline using real traffic, TSA wait times, and gate info.
        </p>
        {genError && (
          <p className="text-xs mb-3 px-4 py-2 rounded-xl" style={{ color: "#EF4444", backgroundColor: "rgba(239,68,68,0.06)" }}>
            {genError}
          </p>
        )}
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            onClick={generateItinerary}
            disabled={generating}
            className="flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: "#4F46E5", color: "#FFFFFF" }}
          >
            {generating ? (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? "Generating…" : "Generate from real data"}
          </button>
          <button
            onClick={() => onAskAgent("Plan my complete travel day itinerary with all steps.")}
            className="flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium"
            style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8", color: "#6B7280" }}
          >
            <Bot className="h-4 w-4" />
            Ask AI instead
          </button>
        </div>
      </div>
    );
  }

  const done  = steps.filter((s) => s.status === "done").length;
  const total = steps.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-1">
      {/* Progress bar */}
      <div className="flex items-center gap-3 px-1 mb-4">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E1D8" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: "#4F46E5" }}
          />
        </div>
        <span className="text-xs font-medium shrink-0" style={{ color: "#9CA3AF" }}>
          {done}/{total} done
        </span>
      </div>

      {/* Relative container for connector line */}
      <div className="relative">
        {/* Vertical connector */}
        <div
          className="absolute top-6 bottom-6 z-0"
          style={{ left: "1.85rem", width: "1px", backgroundColor: "#E5E1D8" }}
        />

        <div className="relative z-10 flex flex-col gap-1">
          {steps.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              isActive={i === activeIndex}
              onAskAgent={(s) => onAskAgent(`Please adjust this step: ${s.label}. ${s.detail ?? ""}`)}
              onCompleted={handleCompleted}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
