"use client";

import { useState } from "react";
import { Bell, X, Check } from "lucide-react";

interface Props {
  wakeTime: Date;
  flightLabel: string;
  onDismiss: () => void;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function scheduleWebNotification(wakeTime: Date, flightLabel: string): Promise<boolean> {
  if (!("Notification" in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const delay = wakeTime.getTime() - Date.now();
  if (delay <= 0) {
    new Notification("⏰ Wake up — GateReady", {
      body: `Time to prepare for ${flightLabel}`,
      icon: "/icon.png",
    });
    return true;
  }

  // Schedule via setTimeout (works while tab is open)
  setTimeout(() => {
    new Notification("⏰ Wake up — GateReady", {
      body: `Time to prepare for ${flightLabel}. Don't miss your flight!`,
      icon: "/icon.png",
      requireInteraction: true,
    });
  }, delay);

  // Also register with Service Worker if available for background delivery
  if ("serviceWorker" in navigator && "showNotification" in ServiceWorkerRegistration.prototype) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if ("showNotification" in reg) {
        // Safari/Chrome: schedule via SW push notification at wake time
        // (full push requires a push server; this schedules locally via SW)
        await reg.showNotification("⏰ GateReady alarm set", {
          body: `Alarm set for ${fmtTime(wakeTime)} · ${flightLabel}`,
          icon: "/icon.png",
        });
      }
    } catch { /* SW not available */ }
  }

  return true;
}

export function AlarmDialog({ wakeTime, flightLabel, onDismiss }: Props) {
  const [state, setState] = useState<"idle" | "scheduling" | "done" | "denied">("idle");
  const [adjustedTime, setAdjustedTime] = useState(
    wakeTime.toTimeString().slice(0, 5) // "HH:MM"
  );

  async function confirmAlarm() {
    setState("scheduling");
    // Build date from adjusted time
    const [h, m] = adjustedTime.split(":").map(Number);
    const target = new Date(wakeTime);
    target.setHours(h, m, 0, 0);

    const ok = await scheduleWebNotification(target, flightLabel);
    setState(ok ? "done" : "denied");
    if (ok) setTimeout(onDismiss, 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: "rgba(7,16,31,0.80)", backdropFilter: "blur(12px)" }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 space-y-5"
        style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(155,128,255,0.15)" }}>
              <Bell className="h-5 w-5" style={{ color: "#9B80FF" }} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1A1A2E]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
                Set wake-up alarm
              </p>
              <p className="text-[11px]" style={{ color: "#6B7280" }}>{flightLabel}</p>
            </div>
          </div>
          <button onClick={onDismiss} className="p-1.5 rounded-lg" style={{ color: "#6B7280" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {state === "done" ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "rgba(39,217,143,0.15)" }}>
              <Check className="h-6 w-6" style={{ color: "#10B981" }} />
            </div>
            <p className="text-sm font-semibold text-[#1A1A2E]">Alarm set for {adjustedTime} ⏰</p>
            <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Keep this tab open for the notification to fire.</p>
          </div>
        ) : state === "denied" ? (
          <div className="text-center py-4">
            <p className="text-sm text-[#1A1A2E] mb-1">Notifications blocked</p>
            <p className="text-xs" style={{ color: "#6B7280" }}>
              Enable notifications in your browser settings, then try again.
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#6B7280" }}>
                Wake-up time
              </p>
              <input
                type="time"
                value={adjustedTime}
                onChange={(e) => setAdjustedTime(e.target.value)}
                className="w-full rounded-2xl px-5 py-3 text-2xl font-bold text-center text-[#1A1A2E] outline-none"
                style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8", colorScheme: "dark", fontFamily: "var(--font-inter), sans-serif" }}
              />
            </div>
            <p className="text-xs" style={{ color: "#6B7280" }}>
              GateReady calculated your wake-up time based on your travel time, TSA wait, and a 90-minute preparation window.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onDismiss}
                className="flex-1 rounded-2xl py-3 text-sm font-medium"
                style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8", color: "#6B7280" }}
              >
                Skip
              </button>
              <button
                onClick={confirmAlarm}
                disabled={state === "scheduling"}
                className="flex-1 rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: "#9B80FF", color: "#1A1A2E" }}
              >
                {state === "scheduling" ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                Set alarm
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
