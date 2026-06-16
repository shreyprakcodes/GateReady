"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, CheckCircle2, ExternalLink, Loader2, Sparkles } from "lucide-react";

interface Props {
  connected: boolean;
  tripId?: string;
}

export function CalendarConnect({ connected: initialConnected, tripId }: Props) {
  const params   = useSearchParams();
  const [connected] = useState(initialConnected || params.get("calendar_connected") === "true");
  const error    = params.get("calendar_error");

  const [syncing, setSyncing]   = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [syncError, setSyncError] = useState("");

  async function syncSchedule() {
    if (!tripId || syncing) return;
    setSyncing(true);
    setSyncError("");
    try {
      const res = await fetch("/api/calendar/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 4000);
    } catch (e) {
      setSyncError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div
      className="rounded-3xl p-5 space-y-4"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8" }}
    >
      <div>
        <p className="text-sm font-bold" style={{ fontFamily: "var(--font-inter), sans-serif", color: "#1A1A2E" }}>
          Google Calendar
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
          Auto-add your full trip schedule to calendar
        </p>
      </div>

      {error && (
        <div className="rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: "rgba(255,75,110,0.10)", color: "#EF4444" }}>
          Connection error: {error}. Please try again.
        </div>
      )}

      {!connected ? (
        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-2 w-full rounded-2xl py-2.5 text-sm font-semibold transition-all"
          style={{ backgroundColor: "#FFFFFF", color: "#F7F5F0" }}
        >
          <Calendar className="h-4 w-4" />
          Connect Google Calendar
          <ExternalLink className="h-3.5 w-3.5 opacity-50" />
        </a>
      ) : (
        <div className="space-y-3">
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ backgroundColor: "rgba(39,217,143,0.08)", border: "1px solid rgba(39,217,143,0.20)" }}
          >
            <CheckCircle2 className="h-4 w-4" style={{ color: "#10B981" }} />
            <p className="text-xs font-semibold" style={{ color: "#10B981" }}>Google Calendar connected</p>
          </div>

          {tripId && (
            <>
              {syncError && (
                <p className="text-xs px-1" style={{ color: "#EF4444" }}>{syncError}</p>
              )}
              <button
                onClick={syncSchedule}
                disabled={syncing}
                className="flex items-center justify-center gap-2 w-full rounded-2xl py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: syncDone ? "#10B981" : "#4F46E5", color: "#F7F5F0" }}
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> :
                 syncDone ? <CheckCircle2 className="h-4 w-4" /> :
                            <Sparkles className="h-4 w-4" />}
                {syncing ? "Adding to calendar…" : syncDone ? "Added to calendar!" : "Add full schedule to calendar"}
              </button>
              <p className="text-[11px] text-center" style={{ color: "#6B7280" }}>
                Creates 10 events: pack, bedtime, wake up, departure, security, gate, boarding & flight
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
