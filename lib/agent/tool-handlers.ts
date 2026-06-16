import * as aviation from "@/lib/api/aviation";
import * as tsa from "@/lib/api/tsa";
import * as maps from "@/lib/api/maps";
import * as uber from "@/lib/api/uber";
import * as places from "@/lib/api/places";
import * as calendar from "@/lib/api/calendar";
import { getMap as getAirportMap } from "@/lib/api/airport-map";
import { createServiceClient } from "@/lib/supabase/server";

// ── Supabase handlers ───────────────────────────────────────────
async function getPreferences({ user_id }: { user_id: string }) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user_id);
  if (error) return { error: error.message, preferences: [] };
  return { preferences: data ?? [] };
}

async function updateItinerary({
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
}) {
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

async function setAlert(input: {
  user_id: string;
  trip_id: string;
  message: string;
  trigger_time: string;
  type: string;
  priority: number;
}) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("alerts").insert({
    user_id: input.user_id,
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

async function savePreference(input: {
  user_id: string;
  key: string;
  value: unknown;
  confidence_score: number;
  source: string;
}) {
  const supabase = createServiceClient();

  // Upsert — increment times_observed on conflict
  const { data: existing } = await supabase
    .from("user_preferences")
    .select("times_observed")
    .eq("user_id", input.user_id)
    .eq("key", input.key)
    .single();

  const times_observed = (existing?.times_observed ?? 0) + 1;

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: input.user_id,
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

async function logEvent(input: {
  user_id: string;
  trip_id: string;
  event_type: string;
  data: object;
}) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("trip_events").insert({
    user_id: input.user_id,
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
const handlers: Record<string, (input: unknown, userId: string) => Promise<unknown>> = {
  get_flight_status: (i) => aviation.getFlightStatus(i as Parameters<typeof aviation.getFlightStatus>[0]),
  get_tsa_wait: (i) => tsa.getWaitTime(i as Parameters<typeof tsa.getWaitTime>[0]),
  get_traffic: (i) => maps.getTraffic(i as Parameters<typeof maps.getTraffic>[0]),
  get_transit_options: (i) => maps.getTransitOptions(i as Parameters<typeof maps.getTransitOptions>[0]),
  get_uber_estimate: (i) => uber.getEstimate(i as Parameters<typeof uber.getEstimate>[0]),
  get_food_stops: (i) => places.getFoodStops(i as Parameters<typeof places.getFoodStops>[0]),
  get_airport_map: (i) => Promise.resolve(getAirportMap(i as Parameters<typeof getAirportMap>[0])),
  get_calendar_events: (i) => calendar.getEvents(i as Parameters<typeof calendar.getEvents>[0]),
  get_user_preferences: (i) => getPreferences(i as { user_id: string }),
  update_itinerary: (i) => updateItinerary(i as Parameters<typeof updateItinerary>[0]),
  set_alert: (i) => setAlert(i as Parameters<typeof setAlert>[0]),
  book_uber: (i) => uber.bookRide(i as Parameters<typeof uber.bookRide>[0]),
  save_preference: (i) => savePreference(i as Parameters<typeof savePreference>[0]),
  log_trip_event: (i) => logEvent(i as Parameters<typeof logEvent>[0]),
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
