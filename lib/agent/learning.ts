import { createServiceClient } from "@/lib/supabase/server";
import { computeNewConfidence, shouldAutoApply } from "./confidence";
import type { Database } from "@/lib/supabase/types";

type TripEvent = Database["public"]["Tables"]["trip_events"]["Row"];
type ItineraryStep = Database["public"]["Tables"]["itinerary_steps"]["Row"];
type UserPreference = Database["public"]["Tables"]["user_preferences"]["Row"];

// ── Helpers ────────────────────────────────────────────────────────────────

async function upsertPreference(
  userId: string,
  key: string,
  value: unknown,
  source: string,
  existingPrefs: UserPreference[]
): Promise<void> {
  const supabase = createServiceClient();
  const existing = existingPrefs.find((p) => p.key === key);

  const timesObserved = (existing?.times_observed ?? 0) + 1;
  const currentConfidence = existing?.confidence_score ?? 0;
  const newConfidence = computeNewConfidence(
    timesObserved,
    currentConfidence,
    false
  );

  await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      key,
      value: value as Database["public"]["Tables"]["user_preferences"]["Row"]["value"],
      confidence_score: newConfidence,
      source,
      times_observed: timesObserved,
      last_updated: new Date().toISOString(),
    },
    { onConflict: "user_id,key" }
  );

  // Log auto-apply if threshold crossed
  if (shouldAutoApply(newConfidence) && !shouldAutoApply(currentConfidence)) {
    await supabase.from("trip_events").insert({
      user_id: userId,
      trip_id: null as unknown as string, // global preference event
      event_type: "preference_auto_applied",
      data: {
        key,
        value,
        confidence: newConfidence,
        times_observed: timesObserved,
      } as Database["public"]["Tables"]["trip_events"]["Row"]["data"],
    });
  }
}

async function contradictPreference(
  userId: string,
  key: string,
  reason: string,
  existingPrefs: UserPreference[]
): Promise<void> {
  const supabase = createServiceClient();
  const existing = existingPrefs.find((p) => p.key === key);
  if (!existing) return;

  const newConfidence = computeNewConfidence(
    existing.times_observed,
    existing.confidence_score,
    true
  );

  await supabase
    .from("user_preferences")
    .update({
      confidence_score: newConfidence,
      last_updated: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("key", key);

  await supabase.from("trip_events").insert({
    user_id: userId,
    trip_id: null as unknown as string,
    event_type: "preference_contradicted",
    data: {
      key,
      reason,
      confidence_before: existing.confidence_score,
      confidence_after: newConfidence,
    } as Database["public"]["Tables"]["trip_events"]["Row"]["data"],
  });
}

// ── Signal extractors ──────────────────────────────────────────────────────

function extractBufferMinutes(
  events: TripEvent[],
  steps: ItineraryStep[]
): number | null {
  // Find the transport step (first step of type "transport" or "uber" or "drive")
  const transportStep = steps.find((s) =>
    ["transport", "uber", "drive", "transit", "taxi"].includes(
      s.step_type?.toLowerCase() ?? ""
    )
  );
  if (!transportStep?.time) return null;

  // Find when user actually completed that step
  const completionEvent = events.find(
    (e) =>
      e.event_type === "step_completed" &&
      (e.data as Record<string, unknown>)?.step_id === transportStep.id
  );
  if (!completionEvent?.created_at) return null;

  const plannedMs = new Date(transportStep.time).getTime();
  const actualMs = new Date(
    (completionEvent.data as Record<string, unknown>)?.actual_time as string ??
      completionEvent.created_at
  ).getTime();

  // Positive = left later than planned (buffer was too large)
  // Negative = left earlier than planned (buffer was too small)
  return Math.round((actualMs - plannedMs) / 60_000);
}

function extractFoodPreference(
  events: TripEvent[],
  steps: ItineraryStep[]
): boolean {
  const foodStepAdded = events.some(
    (e) => e.event_type === "food_stop_added"
  );
  const foodStepCompleted = steps.some(
    (s) =>
      ["food", "coffee", "restaurant", "dining"].includes(
        s.step_type?.toLowerCase() ?? ""
      ) && s.status === "done"
  );
  return foodStepAdded || foodStepCompleted;
}

function extractTransportMode(
  events: TripEvent[],
  steps: ItineraryStep[]
): string | null {
  // Check trip events for explicit transport_chosen events
  const transportEvent = events.find((e) => e.event_type === "transport_chosen");
  if (transportEvent) {
    return (transportEvent.data as Record<string, unknown>)?.mode as string ?? null;
  }

  // Fall back to completed transport steps
  const completedTransport = steps.find(
    (s) =>
      ["transport", "uber", "drive", "transit", "taxi"].includes(
        s.step_type?.toLowerCase() ?? ""
      ) && s.status === "done"
  );
  if (!completedTransport) return null;

  // Infer mode from step_type or action_url
  if (completedTransport.step_type?.toLowerCase() === "uber") return "uber";
  if (completedTransport.step_type?.toLowerCase() === "transit") return "transit";
  if (completedTransport.step_type?.toLowerCase() === "drive") return "drive";
  if (completedTransport.action_url?.includes("uber")) return "uber";
  if (completedTransport.action_url?.includes("maps")) return "transit";

  return completedTransport.step_type ?? null;
}

function countIgnoredSuggestions(
  events: TripEvent[]
): Record<string, number> {
  const ignored: Record<string, number> = {};
  for (const e of events) {
    if (e.event_type === "suggestion_rejected" || e.event_type === "suggestion_ignored") {
      const category =
        (e.data as Record<string, unknown>)?.category as string ?? "general";
      ignored[category] = (ignored[category] ?? 0) + 1;
    }
  }
  return ignored;
}

// ── Main export ────────────────────────────────────────────────────────────

export async function runPostTripLearning(
  userId: string,
  tripId: string
): Promise<{
  signals: Record<string, unknown>;
  preferencesUpdated: string[];
}> {
  const supabase = createServiceClient();

  // 1. Load all trip events
  const { data: events } = await supabase
    .from("trip_events")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  // 2. Load itinerary steps with status
  const { data: steps } = await supabase
    .from("itinerary_steps")
    .select("*")
    .eq("trip_id", tripId)
    .order("position", { ascending: true });

  // 3. Load existing preferences to compute new confidence correctly
  const { data: existingPrefs } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId);

  const tripEvents: TripEvent[] = events ?? [];
  const tripSteps: ItineraryStep[] = steps ?? [];
  const prefs: UserPreference[] = existingPrefs ?? [];

  const signals: Record<string, unknown> = {};
  const updated: string[] = [];

  // ── Signal 1: buffer_minutes ─────────────────────────────────────────────
  const bufferDelta = extractBufferMinutes(tripEvents, tripSteps);
  if (bufferDelta !== null) {
    signals.buffer_delta_minutes = bufferDelta;

    // Existing buffer preference
    const existingBuffer = prefs.find((p) => p.key === "buffer_minutes");
    const currentBuffer =
      typeof existingBuffer?.value === "number"
        ? existingBuffer.value
        : 60; // default 60 min buffer

    // Adjust: if user left 10 min late, reduce buffer by 10; if 10 min early, add 10
    const newBuffer = Math.max(15, currentBuffer - bufferDelta);
    signals.new_buffer_minutes = newBuffer;

    await upsertPreference(
      userId,
      "buffer_minutes",
      newBuffer,
      `trip:${tripId}`,
      prefs
    );
    updated.push("buffer_minutes");
  }

  // ── Signal 2: food preference ────────────────────────────────────────────
  const wantsFood = extractFoodPreference(tripEvents, tripSteps);
  signals.added_food_stop = wantsFood;

  if (wantsFood) {
    await upsertPreference(
      userId,
      "always_wants_food_stop",
      true,
      `trip:${tripId}`,
      prefs
    );
    updated.push("always_wants_food_stop");
  } else {
    // No food stop this trip — may contradict a previous preference
    const foodPref = prefs.find((p) => p.key === "always_wants_food_stop");
    if (foodPref && (foodPref.value as boolean) === true) {
      await contradictPreference(
        userId,
        "always_wants_food_stop",
        `No food stop taken on trip ${tripId}`,
        prefs
      );
      updated.push("always_wants_food_stop (contradicted)");
    }
  }

  // ── Signal 3: preferred_transport ───────────────────────────────────────
  const transportMode = extractTransportMode(tripEvents, tripSteps);
  signals.transport_used = transportMode;

  if (transportMode) {
    const existingTransport = prefs.find((p) => p.key === "preferred_transport");
    const isContradiction =
      existingTransport !== undefined &&
      existingTransport.value !== transportMode;

    if (isContradiction) {
      await contradictPreference(
        userId,
        "preferred_transport",
        `Used ${transportMode} instead of ${existingTransport!.value}`,
        prefs
      );
      // Then upsert with the new mode (lower confidence due to contradiction)
      const adjusted = prefs.map((p) =>
        p.key === "preferred_transport"
          ? {
              ...p,
              confidence_score: Math.max(0.1, p.confidence_score - 0.3),
              times_observed: p.times_observed,
            }
          : p
      );
      await upsertPreference(
        userId,
        "preferred_transport",
        transportMode,
        `trip:${tripId}`,
        adjusted
      );
    } else {
      await upsertPreference(
        userId,
        "preferred_transport",
        transportMode,
        `trip:${tripId}`,
        prefs
      );
    }
    updated.push("preferred_transport");
  }

  // ── Signal 4: ignored suggestions → lower confidence ────────────────────
  const ignored = countIgnoredSuggestions(tripEvents);
  signals.ignored_suggestions = ignored;

  for (const [category, count] of Object.entries(ignored)) {
    if (count >= 2) {
      await contradictPreference(
        userId,
        `suggestion_${category}`,
        `Ignored ${count} times on trip ${tripId}`,
        prefs
      );
      updated.push(`suggestion_${category} (lowered)`);
    }
  }

  // ── Backfill actual buffer (best-effort; logs if signal is missing) ───────
  await backfillActualBuffer(tripId, userId);

  // ── Log learning run ─────────────────────────────────────────────────────
  await supabase.from("trip_events").insert({
    user_id: userId,
    trip_id: tripId,
    event_type: "post_trip_learning_complete",
    data: {
      signals,
      preferences_updated: updated,
    } as Database["public"]["Tables"]["trip_events"]["Row"]["data"],
  });

  return { signals, preferencesUpdated: updated };
}

// ── Prediction backfill ───────────────────────────────────────────────────
//
// Definition (must stay aligned with predicted_buffer_minutes in bufferEngine.ts):
//   actual_buffer_minutes = floor((departure_actual − at_gate.reached_at) / 60_000)
//   = minutes the user was at the gate before the plane actually pushed back.
//
// This matches predicted_buffer_minutes, which is the airport cushion after
// drive + TSA + gate walk — i.e. time between "settled at gate" and departure.
//
// TODO: implement once at_gate milestone capture is confirmed reliable.
//
// What's missing:
//   1. trips.departure_actual — EXISTS and is reliable (written by pollFlightStatus
//      every 10 min once the aviation API reports the actual gate departure).
//   2. trip_milestones.at_gate.reached_at — EXISTS in the schema and write path
//      (POST /api/trips/[id]/milestones), but is USER-TAPPED. If the user never
//      taps "At Gate" in the app, this row will not exist and the actual cannot
//      be computed. Decision needed: (a) accept sparse coverage and backfill only
//      when the milestone is present, or (b) add an automatic signal (e.g. geofence
//      trigger, boarding-pass scan) that sets the milestone without user action.
//
export async function backfillActualBuffer(
  tripId: string,
  userId: string,
): Promise<void> {
  // TODO: implement this body once the gap above is resolved.
  // Sketch:
  //   const supabase = createServiceClient();
  //   const [{ data: milestone }, { data: trip }] = await Promise.all([
  //     supabase.from("trip_milestones")
  //       .select("reached_at").eq("trip_id", tripId).eq("type", "at_gate").single(),
  //     supabase.from("trips")
  //       .select("departure_actual").eq("id", tripId).single(),
  //   ]);
  //   if (!milestone?.reached_at || !trip?.departure_actual) {
  //     console.warn(`[backfillActualBuffer] missing signal — trip_id=${tripId}`);
  //     return;
  //   }
  //   const actual = Math.floor(
  //     (new Date(trip.departure_actual).getTime() -
  //      new Date(milestone.reached_at).getTime()) / 60_000,
  //   );
  //   if (actual < 0) return; // data anomaly — skip rather than store garbage
  //   await supabase.from("trip_predictions")
  //     .update({ actual_buffer_minutes: actual })
  //     .eq("trip_id", tripId)
  //     .is("actual_buffer_minutes", null); // never overwrite a value already set
  console.warn(
    `[backfillActualBuffer] stub — not yet implemented. trip_id=${tripId} user_id=${userId}`,
  );
}

// ── Context injection for agent ───────────────────────────────────────────
// Call this at the start of each runAgentLoop to build an auto-apply context string.
export async function buildPreferenceContext(userId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .gte("confidence_score", 0.8);

  if (!prefs?.length) return "";

  const lines = prefs.map((p) => {
    const label = p.key.replace(/_/g, " ");
    return `• ${label}: ${JSON.stringify(p.value)} (confidence ${p.confidence_score.toFixed(2)} — auto-apply)`;
  });

  return (
    `[User preferences auto-applied at confidence ≥ 0.8:\n${lines.join("\n")}\n` +
    `Apply these without asking. Log as preference_auto_applied when used.]`
  );
}
