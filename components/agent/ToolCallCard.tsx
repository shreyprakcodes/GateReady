"use client";

import { useState } from "react";
import {
  Plane, ShieldCheck, Car, TrafficCone, UtensilsCrossed, Map,
  Calendar, User, ListChecks, Bell, Bookmark, LogIn, Users,
  ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle,
} from "lucide-react";

const TOOL_META: Record<string, { label: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  get_flight_status:    { label: "Checking flight status",     Icon: Plane },
  get_tsa_wait:         { label: "Checking TSA wait times",    Icon: ShieldCheck },
  get_traffic:          { label: "Checking traffic",           Icon: TrafficCone },
  get_transit_options:  { label: "Finding transit options",    Icon: Car },
  get_uber_estimate:    { label: "Getting Uber estimate",      Icon: Car },
  get_food_stops:       { label: "Finding food stops",         Icon: UtensilsCrossed },
  get_airport_map:      { label: "Loading airport map",        Icon: Map },
  get_calendar_events:  { label: "Checking calendar",          Icon: Calendar },
  get_user_preferences: { label: "Loading your preferences",   Icon: User },
  update_itinerary:     { label: "Updating itinerary",          Icon: ListChecks },
  set_alert:            { label: "Setting alert",               Icon: Bell },
  book_uber:            { label: "Booking Uber",                Icon: Car },
  save_preference:      { label: "Saving preference",          Icon: Bookmark },
  log_trip_event:       { label: "Logging event",               Icon: LogIn },
  send_family_alert:    { label: "Alerting family",             Icon: Users },
};

const STATUS_COLOR = {
  running: "#4F46E5",
  done:    "#10B981",
  error:   "#EF4444",
};

interface Props {
  name: string;
  input: unknown;
  result?: unknown;
  status: "running" | "done" | "error";
}

export function ToolCallCard({ name, input, result, status }: Props) {
  const [expanded, setExpanded] = useState(false);
  const meta = TOOL_META[name] ?? { label: name, Icon: ListChecks };
  const { label, Icon } = meta;

  const inputEntries = input && typeof input === "object"
    ? Object.entries(input as Record<string, unknown>).slice(0, 4)
    : [];

  return (
    <div
      className="rounded-xl px-3 py-2.5 text-xs max-w-[85%]"
      style={{
        backgroundColor: "#F7F5F0",
        border: `1px solid ${STATUS_COLOR[status]}22`,
      }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: STATUS_COLOR[status] }} />
        <span className="font-medium flex-1" style={{ color: "#6B7280" }}>{label}</span>
        <span className="ml-auto shrink-0">
          {status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "#4F46E5" }} />}
          {status === "done"    && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#10B981" }} />}
          {status === "error"   && <XCircle className="h-3.5 w-3.5" style={{ color: "#EF4444" }} />}
        </span>
      </div>

      {inputEntries.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {inputEntries.map(([k, v]) => (
            <span key={k} style={{ color: "#9CA3AF" }}>
              <span style={{ color: "#6B7280" }}>{k}:</span>{" "}
              {String(Array.isArray(v) ? v.join(", ") : v).slice(0, 40)}
            </span>
          ))}
        </div>
      )}

      {status === "done" && result !== undefined && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-1.5 flex items-center gap-1"
          style={{ color: "#9CA3AF" }}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Hide result" : "Show result"}
        </button>
      )}

      {expanded && result !== undefined && (
        <pre
          className="mt-2 rounded-lg p-2 text-[10px] overflow-x-auto max-h-32"
          style={{ backgroundColor: "#E5E1D8", color: "#6B7280" }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
