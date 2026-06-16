"use client";

export interface JourneyStep {
  icon:            string;
  label:           string;
  time:            Date;
  durationToNext?: string;
  status:          "done" | "current" | "future";
}

interface Props {
  steps:           JourneyStep[];
  origin:          string;
  destination:     string;
  urgentLeave?:    boolean;
  driveTimeSource?: "google" | "estimated";
}

function fmt12(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function JourneyTimeline({ steps, origin, destination, urgentLeave = false, driveTimeSource }: Props) {
  if (steps.length === 0) return null;

  return (
    <div
      className="rounded-3xl p-5"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E1D8",
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-bold" style={{ color: "#1A1A2E" }}>
          Journey Timeline
        </p>
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: "rgba(79,70,229,0.08)", color: "#4F46E5" }}
        >
          {origin} → {destination}
        </span>
      </div>

      {/* Steps */}
      <div>
        {steps.map((step, i) => {
          const isLast       = i === steps.length - 1;
          const isDone       = step.status === "done";
          const isCurrent    = step.status === "current";
          const isUrgentLeave = i === 0 && urgentLeave;

          const iconBg =
            isUrgentLeave ? "rgba(239,68,68,0.10)"
            : isCurrent   ? "rgba(79,70,229,0.10)"
            : "transparent";

          const iconBorder =
            isUrgentLeave ? "1px solid rgba(239,68,68,0.30)"
            : isCurrent   ? "1px solid rgba(79,70,229,0.22)"
            : "1px solid transparent";

          const labelColor =
            isUrgentLeave ? "#DC2626"
            : isDone       ? "#9CA3AF"
            : isCurrent    ? "#1A1A2E"
            : "#6B7280";

          const timeColor =
            isUrgentLeave ? "#DC2626"
            : isDone       ? "#D1D5DB"
            : isCurrent    ? "#4F46E5"
            : "#9CA3AF";

          const lineColor  = isDone ? "#E5E1D8" : "#F0EEE9";

          return (
            <div key={i} className="flex gap-3">
              {/* Spine */}
              <div className="flex flex-col items-center">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 relative"
                  style={{ backgroundColor: iconBg, border: iconBorder }}
                >
                  {isUrgentLeave && (
                    <span
                      className="animate-ping absolute inset-0 rounded-xl"
                      style={{ background: "rgba(239,68,68,0.20)" }}
                    />
                  )}
                  {step.icon}
                </div>
                {!isLast && (
                  <div
                    className="w-px flex-1 my-1"
                    style={{ backgroundColor: lineColor, minHeight: 20 }}
                  />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-2"}`}>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p
                    className="text-sm font-medium leading-tight"
                    style={{ color: labelColor }}
                  >
                    {step.label}
                  </p>
                  <p
                    key={step.time.toISOString()}
                    className="text-sm font-bold shrink-0"
                    style={{
                      color:               timeColor,
                      fontFamily:          "var(--font-playfair), serif",
                      fontVariantNumeric:  "tabular-nums",
                      animation:           "timeUpdate 0.3s ease",
                    }}
                  >
                    {fmt12(step.time)}
                  </p>
                </div>

                {step.durationToNext && (
                  <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
                    {step.durationToNext}
                  </p>
                )}

                {isCurrent && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1"
                    style={{ backgroundColor: "rgba(79,70,229,0.08)", color: "#4F46E5" }}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ backgroundColor: "#4F46E5" }}
                      />
                      <span
                        className="relative inline-flex rounded-full h-1.5 w-1.5"
                        style={{ backgroundColor: "#4F46E5" }}
                      />
                    </span>
                    Now
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] mt-4 text-center" style={{ color: "#D1D5DB" }}>
        {driveTimeSource === "google"
          ? "Drive time from Google Maps Directions API"
          : "Drive time estimated via straight-line distance at 40 mph average"}
      </p>
    </div>
  );
}
