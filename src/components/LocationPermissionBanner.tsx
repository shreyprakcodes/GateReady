"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useUserLocation } from "@/src/hooks/useUserLocation";

const DISMISS_KEY = "gr-location-banner-dismissed";

export function LocationPermissionBanner() {
  const { permissionState, isLoading, requestPermission } = useUserLocation();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted]     = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  // Hook always runs; only the UI is conditional
  if (!mounted)                                              return null;
  if (permissionState === "granted")                        return null;
  if (permissionState === "unsupported")                    return null;
  if (dismissed && permissionState === "prompt")            return null;

  const isPrompt = permissionState === "prompt";

  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E1D8",
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
      }}
      aria-live="polite"
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
        style={{
          backgroundColor: "rgba(79,70,229,0.08)",
          border: "1px solid rgba(79,70,229,0.15)",
        }}
      >
        {isPrompt ? "📍" : "🔒"}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-0.5" style={{ color: "#1A1A2E" }}>
          {isPrompt
            ? "Enable location for accurate travel times"
            : "Location access is off"}
        </p>
        <p
          className="text-xs leading-relaxed mb-3"
          style={{ color: "#6B7280", fontFamily: "var(--font-inter)" }}
        >
          {isPrompt
            ? "GateReady uses your location to calculate drive time to the airport and alert you when to leave."
            : "To turn it on, go to your browser or phone Settings → GateReady → Location."}
        </p>

        {isPrompt ? (
          <button
            onClick={requestPermission}
            disabled={isLoading}
            className="rounded-xl px-4 py-2 text-xs font-semibold transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "#4F46E5", color: "#FFFFFF" }}
          >
            {isLoading ? "Requesting…" : "Allow Location"}
          </button>
        ) : (
          <button
            onClick={() => window.open("app-settings:", "_self")}
            className="rounded-xl px-4 py-2 text-xs font-semibold"
            style={{
              backgroundColor: "transparent",
              border: "1px solid #4F46E5",
              color: "#4F46E5",
            }}
          >
            Open Settings
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        className="p-1 rounded-lg shrink-0 -mt-0.5"
        style={{ color: "#9CA3AF" }}
        aria-label="Dismiss location banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
