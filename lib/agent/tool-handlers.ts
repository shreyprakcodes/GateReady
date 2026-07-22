import * as aviation from "@/lib/api/aviation";
import * as tsa from "@/lib/api/tsa";
import * as maps from "@/lib/api/maps";
import * as uber from "@/lib/api/uber";
import * as places from "@/lib/api/places";
import * as calendar from "@/lib/api/calendar";
import { getMap as getAirportMap } from "@/lib/api/airport-map";
import { createServiceClient } from "@/lib/supabase/server";

// ── Ownership guard ──────────────────────────────────────────────
// Every trip-scoped write below must go through this before touching the
// DB — trip_id is model-supplied (untrusted); userId is the session identity
// threaded down from the authenticated request. Never trust the model's own
// user_id/trip_id pairing to already be consistent.
async function ownsTrip(tripId: string, userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", userId)
    .single();
  return !error && !!data;
}

const ACCESS_DENIED = { error: "Trip not found or access denied" };

// ── Supabase handlers ───────────────────────────────────────────
// Every handler below takes the authenticated session userId as its identity
// argument and ignores any user_id present in the model's tool input.
async function getPreferences(userId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId);
  if (error) return { error: error.message, preferences: [] };
  return { preferences: data ?? [] };
}

async function updateItinerary(
  {
    trip_id,
    steps,
  }: {
    trip_id: string;
    steps: Array<{
      position: number;
      time: string;
      label: string;
      icon?: string;
      detail?: string;
      step_type: string;
      status?: string;
      action_url?: string;
    }>;
  },
  userId: string
) {
  if (!(await ownsTrip(trip_id, userId))) return ACCESS_DENIED;

  const supabase = createServiceClient();

  // Delete existing steps for this trip
  await supabase.from("itinerary_steps").delete().eq("trip_id", trip_id);

  const rows = steps.map((s) => ({
    trip_id,
    position: s.position,
    time: s.time,
    label: s.label,
    icon: s.icon ?? null,
    detail: s.detail ?? null,
    step_type: s.step_type,
    status: s.status ?? "upcoming",
    action_url: s.action_url ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("itinerary_steps").insert(rows);
  if (error) return { error: error.message };
  return { success: true, steps_written: rows.length };
}

async function setAlert(
  input: {
    trip_id: string;
    message: string;
    trigger_time: string;
    type: string;
    priority: number;
  },
  userId: string
) {
  if (!(await ownsTrip(input.trip_id, userId))) return ACCESS_DENIED;

  const supabase = createServiceClient();
  const { error } = await supabase.from("alerts").insert({
    user_id: userId,
    trip_id: input.trip_id,
    message: input.message,
    trigger_time: input.trigger_time,
    type: input.type,
    priority: input.priority,
    delivered: false,
  });
  if (error) return { error: error.message };
  return { success: true };
}

async function savePreference(
  input: {
    key: string;
    value: unknown;
    confidence_score: number;
    source: string;
  },
  userId: string
) {
  const supabase = createServiceClient();

  // Upsert — increment times_observed on conflict
  const { data: existing } = await supabase
    .from("user_preferences")
    .select("times_observed")
    .eq("user_id", userId)
    .eq("key", input.key)
    .single();

  const times_observed = (existing?.times_observed ?? 0) + 1;

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: userId,
        key: input.key,
        value: input.value as import("@/lib/supabase/types").Json,
        confidence_score: input.confidence_score,
        source: input.source,
        times_observed,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "user_id,key" }
    );

  if (error) return { error: error.message };
  return { success: true, times_observed };
}

async function logEvent(
  input: {
    trip_id: string;
    event_type: string;
    data: object;
  },
  userId: string
) {
  if (!(await ownsTrip(input.trip_id, userId))) return ACCESS_DENIED;

  const supabase = createServiceClient();
  const { error } = await supabase.from("trip_events").insert({
    user_id: userId,
    trip_id: input.trip_id,
    event_type: input.event_type,
    data: input.data as import("@/lib/supabase/types").Json,
  });
  if (error) return { error: error.message };
  return { success: true };
}

async function sendFamilyAlert(input: {
  family_member_ids: string[];
  message: string;
  trip_context: object;
}) {
  // Placeholder — full push implementation in Phase 3
  return {
    success: true,
    sent_to: input.family_member_ids.length,
    message: input.message,
  };
}

// ── Dispatcher ──────────────────────────────────────────────────
// Every handler receives the authenticated session userId as its second
// argument. Tools that read/write user- or trip-scoped rows use it as the
// sole identity — any user_id/trip_id the model put in its own tool input is
// either ignored (user-scoped tools) or checked against it before any write
// (trip-scoped tools), never trusted on its own.
const handlers: Record<string, (input: unknown, userId: string) => Promise<unknown>> = {
  get_flight_status: (i) => aviation.getFlightStatus(i as Parameters<typeof aviation.getFlightStatus>[0]),
  get_tsa_wait: (i) => tsa.getWaitTime(i as Parameters<typeof tsa.getWaitTime>[0]),
  get_traffic: (i) => maps.getTraffic(i as Parameters<typeof maps.getTraffic>[0]),
  get_transit_options: (i) => maps.getTransitOptions(i as Parameters<typeof maps.getTransitOptions>[0]),
  get_uber_estimate: (i) => uber.getEstimate(i as Parameters<typeof uber.getEstimate>[0]),
  get_food_stops: (i) => places.getFoodStops(i as Parameters<typeof places.getFoodStops>[0]),
  get_airport_map: (i) => Promise.resolve(getAirportMap(i as Parameters<typeof getAirportMap>[0])),
  get_calendar_events: (i, userId) =>
    calendar.getEvents({ ...(i as { date: string }), user_id: userId }),
  get_user_preferences: (_i, userId) => getPreferences(userId),
  update_itinerary: (i, userId) => updateItinerary(i as Parameters<typeof updateItinerary>[0], userId),
  set_alert: (i, userId) => setAlert(i as Parameters<typeof setAlert>[0], userId),
  book_uber: (i) => uber.bookRide(i as Parameters<typeof uber.bookRide>[0]),
  save_preference: (i, userId) => savePreference(i as Parameters<typeof savePreference>[0], userId),
  log_trip_event: (i, userId) => logEvent(i as Parameters<typeof logEvent>[0], userId),
  send_family_alert: (i) => sendFamilyAlert(i as Parameters<typeof sendFamilyAlert>[0]),
};

export async function execTool(
  name: string,
  input: unknown,
  userId: string
): Promise<unknown> {
  const handler = handlers[name];
  if (!handler) return { error: `Unknown tool: ${name}` };
  try {
    return await handler(input, userId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
