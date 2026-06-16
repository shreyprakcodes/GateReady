"use client";

import { useState } from "react";
import { Phone, CheckCircle, Clock, MapPin, Shield } from "lucide-react";
import type { Database, ParentalSettings } from "@/lib/supabase/types";

type Step = Database["public"]["Tables"]["itinerary_steps"]["Row"];

const ICON_MAP: Record<string, string> = {
  car: "🚗",
  taxi: "🚕",
  transit: "🚇",
  walk: "🚶",
  security: "🛡",
  checkin: "✈️",
  gate: "🚪",
  board: "🛫",
  food: "🍽",
  default: "📍",
};

function stepIcon(s: Step): string {
  const t = (s.step_type ?? s.icon ?? "").toLowerCase();
  for (const [key, emoji] of Object.entries(ICON_MAP)) {
    if (t.includes(key)) return emoji;
  }
  return ICON_MAP.default;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  trip: Database["public"]["Tables"]["trips"]["Row"];
  steps: Step[];
  userId: string;
}

export function ChildView({ trip, steps, userId }: Props) {
  const settings = (trip.parental_settings ?? {}) as Partial<ParentalSettings>;
  const emergencyName  = settings.emergency_contact_name  ?? "Parent";
  const emergencyPhone = settings.emergency_contact_phone ?? "";

  const ordered = [...steps].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const doneCount = ordered.filter((s) => s.status === "done").length;

  const currentIdx = ordered.findIndex((s) => s.status !== "done");
  const current = currentIdx >= 0 ? ordered[currentIdx] : ordered[ordered.length - 1];
  const next    = currentIdx >= 0 && currentIdx + 1 < ordered.length ? ordered[currentIdx + 1] : null;

  const [marking, setMarking] = useState(false);

  async function markDone() {
    if (!current || marking) return;
    setMarking(true);
    try {
      await fetch(`/api/itinerary/steps/${current.id}/done`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    } finally {
      setMarking(false);
    }
  }

  const allDone = ordered.length > 0 && doneCount === ordered.length;

  return (
    <div className="flex flex-col min-h-dvh relative" style={{ backgroundColor: "#F7F5F0", maxWidth: 440, margin: "0 auto" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium" style={{ color: "#6B7280", fontFamily: "var(--font-inter)" }}>
            Your trip
          </p>
          <h1
            className="text-xl font-semibold"
            style={{ color: "#1A1A2E", fontFamily: "var(--font-inter)" }}
          >
            {trip.origin ?? "?"} → {trip.destination ?? "?"}
          </h1>
        </div>
        {trip.departure_time && (
          <div
            className="rounded-xl px-3 py-1.5 text-xs font-medium"
            style={{ backgroundColor: "#FFFFFF", color: "#4F46E5", border: "1px solid #E5E1D8" }}
          >
            {fmtTime(trip.departure_time)}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: "#6B7280" }}>
          <span>Step {doneCount} of {ordered.length}</span>
          <span>{Math.round((doneCount / Math.max(ordered.length, 1)) * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#FFFFFF" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(doneCount / Math.max(ordered.length, 1)) * 100}%`,
              backgroundColor: "#4F46E5",
            }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-5 pb-32 space-y-4">
        {allDone ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #10B981" }}
          >
            <p className="text-4xl mb-3">🛫</p>
            <p className="text-lg font-semibold text-[#1A1A2E] mb-1" style={{ fontFamily: "var(--font-inter)" }}>
              All done!
            </p>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              Have a great flight!
            </p>
          </div>
        ) : (
          <>
            {/* NOW label */}
            <p className="text-xs font-semibold tracking-widest" style={{ color: "#4F46E5", fontFamily: "var(--font-inter)" }}>
              NOW
            </p>

            {/* Current step — large teal-glow card */}
            {current && (
              <div
                className="rounded-2xl p-5"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid rgba(0,212,184,0.4)",
                  boxShadow: "0 0 24px rgba(0,212,184,0.12)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: "rgba(0,212,184,0.12)" }}
                  >
                    {stepIcon(current)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-lg font-semibold text-[#1A1A2E] leading-tight"
                      style={{ fontFamily: "var(--font-inter)" }}
                    >
                      {current.label}
                    </p>
                    {current.time && (
                      <p className="text-sm mt-0.5" style={{ color: "#4F46E5" }}>
                        <Clock className="inline h-3.5 w-3.5 mr-1" />
                        {fmtTime(current.time)}
                      </p>
                    )}
                    {current.detail && (
                      <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "#6B7280" }}>
                        {current.detail}
                      </p>
                    )}
                  </div>
                </div>

                {/* Mark done */}
                <button
                  onClick={markDone}
                  disabled={marking || current.status === "done"}
                  className="mt-4 w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: current.status === "done" ? "rgba(39,217,143,0.15)" : "#4F46E5",
                    color: current.status === "done" ? "#10B981" : "#F7F5F0",
                  }}
                >
                  <CheckCircle className="h-4 w-4" />
                  {current.status === "done" ? "Done ✓" : marking ? "Marking done…" : "Done — tap when complete"}
                </button>

                {/* Action link */}
                {current.action_url && (
                  <a
                    href={current.action_url}
                    className="mt-2 w-full rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                    style={{
                      border: "1px solid #E5E1D8",
                      color: "#6B7280",
                      display: "flex",
                    }}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {(current.step_type ?? "").toLowerCase().includes("car") || (current.step_type ?? "").toLowerCase().includes("taxi")
                      ? "Open Uber"
                      : "Open Maps"}
                  </a>
                )}
              </div>
            )}

            {/* UP NEXT */}
            {next && (
              <>
                <p className="text-xs font-semibold tracking-widest pt-1" style={{ color: "#6B7280", fontFamily: "var(--font-inter)" }}>
                  UP NEXT
                </p>
                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ backgroundColor: "#121F30" }}
                    >
                      {stepIcon(next)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A2E]">{next.label}</p>
                      {next.time && (
                        <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                          {fmtTime(next.time)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Fixed emergency button */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full px-5 pb-8 pt-4"
        style={{ maxWidth: 440, background: "linear-gradient(to top, #F7F5F0 70%, transparent)" }}
      >
        {emergencyPhone ? (
          <a
            href={`tel:${emergencyPhone}`}
            className="flex items-center justify-center gap-2.5 rounded-2xl py-4 w-full font-semibold text-sm"
            style={{
              backgroundColor: "rgba(255,171,46,0.15)",
              border: "1px solid rgba(255,171,46,0.4)",
              color: "#F59E0B",
            }}
          >
            <Phone className="h-4 w-4" />
            Call {emergencyName} (Emergency)
          </a>
        ) : (
          <div
            className="flex items-center justify-center gap-2 rounded-2xl py-3 w-full text-sm"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", color: "#6B7280" }}
          >
            <Shield className="h-4 w-4" />
            Emergency contact not configured
          </div>
        )}
      </div>
    </div>
  );
}
