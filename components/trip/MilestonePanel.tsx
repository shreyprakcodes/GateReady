"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────

const NAVY = "#07101F";
const TEAL = "#00D4B8";

// ─── Milestone definitions ────────────────────────────────────────

type MilestoneType = "left_home" | "cleared_security" | "at_gate" | "boarded";

const STEPS: Array<{ type: MilestoneType; label: string; icon: string; hint: string }> = [
  { type: "left_home",         label: "Left Home",        icon: "🏠", hint: "Started the journey" },
  { type: "cleared_security",  label: "Cleared Security", icon: "✅", hint: "Through TSA" },
  { type: "at_gate",           label: "At Gate",          icon: "🚪", hint: "Ready to board" },
  { type: "boarded",           label: "Boarded",          icon: "✈️", hint: "On the plane" },
];

// ─── Types ────────────────────────────────────────────────────────

interface MilestoneRow {
  type:      string;
  reached_at: string;
}

interface Props {
  tripId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ─── Component ────────────────────────────────────────────────────

export function MilestonePanel({ tripId }: Props) {
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [posting, setPosting]       = useState<MilestoneType | null>(null);

  const fetchMilestones = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/milestones`);
      if (!res.ok) return;
      const json = await res.json() as { milestones: MilestoneRow[] };
      setMilestones(json.milestones ?? []);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { fetchMilestones(); }, [fetchMilestones]);

  const markMilestone = useCallback(async (type: MilestoneType) => {
    setPosting(type);
    try {
      const res = await fetch(`/api/trips/${tripId}/milestones`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type }),
      });
      if (res.ok) await fetchMilestones();
    } finally {
      setPosting(null);
    }
  }, [tripId, fetchMilestones]);

  const reachedMap = Object.fromEntries(milestones.map((m) => [m.type, m.reached_at]));

  // Determine which milestone is next (first unreached)
  const nextIdx = STEPS.findIndex((s) => !reachedMap[s.type]);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: NAVY, boxShadow: `0 4px 24px rgba(0,212,184,0.07)` }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <p
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: `${TEAL}80` }}
        >
          Travel Day Progress
        </p>
        <p
          className="text-base font-bold mt-1"
          style={{ color: "#E2E8F0", fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {loading
            ? "Loading…"
            : milestones.length === 0
              ? "Tap a step when you reach it"
              : milestones.length === STEPS.length
                ? "All done — safe travels! ✈️"
                : `${milestones.length} of ${STEPS.length} steps reached`}
        </p>
      </div>

      {/* Steps */}
      <div
        className="px-5 pb-5 space-y-2"
        style={{ borderTop: "1px solid #162030" }}
      >
        <div className="pt-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: TEAL }} />
            </div>
          ) : (
            STEPS.map((step, idx) => {
              const reachedAt = reachedMap[step.type];
              const isReached = Boolean(reachedAt);
              const isNext    = idx === nextIdx;
              const isBusy    = posting === step.type;

              return (
                <button
                  key={step.type}
                  onClick={() => !isReached && !isBusy && markMilestone(step.type)}
                  disabled={isBusy}
                  className="w-full flex items-center gap-4 rounded-xl px-4 py-3 transition-all active:scale-[0.98] text-left"
                  style={{
                    backgroundColor: isReached
                      ? `${TEAL}12`
                      : isNext
                        ? "#162030"
                        : "#0A1628",
                    border: isReached
                      ? `1px solid ${TEAL}30`
                      : isNext
                        ? `1px solid #1E3050`
                        : `1px solid #0F1E30`,
                    cursor: isReached ? "default" : "pointer",
                  }}
                >
                  {/* Icon circle */}
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
                    style={{
                      backgroundColor: isReached
                        ? `${TEAL}18`
                        : isNext
                          ? "#1E3050"
                          : "#0F1E30",
                    }}
                  >
                    {step.icon}
                  </div>

                  {/* Label + time */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: isReached ? TEAL : isNext ? "#E2E8F0" : "#4A6580" }}
                    >
                      {step.label}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "#4A6580" }}>
                      {isReached ? `Reached at ${fmtTime(reachedAt)}` : step.hint}
                    </p>
                  </div>

                  {/* Status indicator */}
                  <div className="shrink-0">
                    {isBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: TEAL }} />
                    ) : isReached ? (
                      <CheckCircle2 className="h-5 w-5" style={{ color: TEAL }} />
                    ) : isNext ? (
                      <Circle className="h-4 w-4" style={{ color: "#1E3050", strokeWidth: 1.5 }} />
                    ) : (
                      <Circle className="h-4 w-4" style={{ color: "#0F1E30", strokeWidth: 1.5 }} />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
