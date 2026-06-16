"use client";

import { useRef } from "react";
import { CheckCircle2, ExternalLink, MessageSquare, Navigation, Car } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Step = Database["public"]["Tables"]["itinerary_steps"]["Row"];

const LONG_PRESS_MS = 600;

interface Props {
  step: Step;
  isActive: boolean;
  onAskAgent: (step: Step) => void;
  onCompleted: (step: Step) => void;
}

function getActionLabel(step: Step): string | null {
  if (!step.action_url) return null;
  if (step.step_type === "transport") return "Open Uber";
  if (step.step_type === "tsa" || step.step_type === "gate" || step.step_type === "flight") return "Open Maps";
  return "Open";
}

function getActionIcon(step: Step) {
  if (step.step_type === "transport") return <Car className="h-3.5 w-3.5" />;
  return <Navigation className="h-3.5 w-3.5" />;
}

export function StepCard({ step, isActive, onAskAgent, onCompleted }: Props) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startPress() { pressTimer.current = setTimeout(() => { onAskAgent(step); }, LONG_PRESS_MS); }
  function cancelPress() { if (pressTimer.current) clearTimeout(pressTimer.current); }
  function handleTap() { if (step.action_url) window.open(step.action_url, "_blank", "noopener,noreferrer"); }

  async function markDone() {
    onCompleted(step);
    const supabase = createClient();
    await supabase.from("itinerary_steps").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", step.id);
  }

  const isDone       = step.status === "done";
  const time         = step.time ? new Date(step.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  const actionLabel  = getActionLabel(step);

  return (
    <div
      className="flex gap-4 px-4 py-4 rounded-2xl transition-all select-none"
      style={{
        opacity: isDone ? 0.5 : 1,
        backgroundColor: isActive ? "rgba(79,70,229,0.04)" : "transparent",
        border: isActive ? "1px solid rgba(79,70,229,0.25)" : "1px solid transparent",
      }}
      onClick={handleTap}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
    >
      {/* Icon column */}
      <div className="flex flex-col items-center pt-0.5 gap-1">
        {isDone ? (
          <CheckCircle2 className="h-5 w-5" style={{ color: "#10B981" }} />
        ) : (
          <div
            className="h-5 w-5 rounded-full border-2 flex items-center justify-center"
            style={{
              borderColor: isActive ? "#4F46E5" : "#E5E1D8",
              backgroundColor: isActive ? "rgba(79,70,229,0.10)" : "transparent",
            }}
          >
            {isActive && <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: "#4F46E5" }} />}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {step.icon && <span className="text-base leading-none">{step.icon}</span>}
              <p
                className="text-sm font-semibold"
                style={{
                  color: isDone ? "#9CA3AF" : "#1A1A2E",
                  textDecoration: isDone ? "line-through" : "none",
                }}
              >
                {step.label}
              </p>
            </div>
            {time && (
              <p className="text-xs mt-0.5 font-medium" style={{ color: isActive ? "#4F46E5" : "#9CA3AF" }}>
                {time}
              </p>
            )}
            {step.detail && (
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "#6B7280" }}>
                {step.detail}
              </p>
            )}
          </div>

          {step.action_url && !isActive && (
            <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "#D1D5DB" }} />
          )}
        </div>

        {/* Active step actions */}
        {isActive && !isDone && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={(e) => { e.stopPropagation(); markDone(); }}
              className="flex-1 rounded-xl py-2 text-xs font-semibold"
              style={{ backgroundColor: "#4F46E5", color: "#FFFFFF" }}
            >
              Mark done
            </button>

            {actionLabel && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (step.action_url) window.open(step.action_url, "_blank", "noopener,noreferrer");
                }}
                className="rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5"
                style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8", color: "#6B7280" }}
              >
                {getActionIcon(step)}
                {actionLabel}
              </button>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); onAskAgent(step); }}
              className="rounded-xl px-3 py-2 text-xs font-medium flex items-center gap-1.5"
              style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8", color: "#9CA3AF" }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Ask
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
