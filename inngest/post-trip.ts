import { inngest } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import { runPostTripLearning } from "@/lib/agent/learning";

// ── Event-triggered: fires when trip.completed event is sent ─────────────
export const onTripCompleted = inngest.createFunction(
  {
    id: "on-trip-completed",
    name: "GateReady: Post-Trip Learning",
    triggers: [{ event: "gateready/trip.completed" }],
  },
  async ({ event, step }) => {
    const { userId, tripId } = event.data as {
      userId: string;
      tripId: string;
    };

    const result = await step.run("run-learning", () =>
      runPostTripLearning(userId, tripId)
    );

    return { userId, tripId, result };
  }
);

// ── Cron: daily sweep for trips that completed in the last 24h ───────────
export const dailyLearningRun = inngest.createFunction(
  {
    id: "daily-learning-sweep",
    name: "GateReady: Daily Learning Sweep",
    triggers: [{ cron: "0 3 * * *" }], // 3 AM UTC daily
  },
  async ({ step }) => {
    const supabase = createServiceClient();

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // Trips that departed in the last 24h and haven't been learned from yet
    const { data: trips } = await supabase
      .from("trips")
      .select("id, user_id")
      .lte("departure_time", now)
      .gte("departure_time", cutoff)
      .neq("status", "cancelled");

    if (!trips?.length) return { processed: 0 };

    // Exclude trips already processed (have a post_trip_learning_complete event)
    const tripIds = trips.map((t) => t.id);
    const { data: alreadyProcessed } = await supabase
      .from("trip_events")
      .select("trip_id")
      .in("trip_id", tripIds)
      .eq("event_type", "post_trip_learning_complete");

    const processedSet = new Set(
      (alreadyProcessed ?? []).map((e) => e.trip_id)
    );
    const pending = trips.filter((t) => !processedSet.has(t.id));

    if (!pending.length) return { processed: 0, skipped: trips.length };

    const results = await Promise.all(
      pending.map(async (trip) => {
        try {
          const result = await step.run(
            `learn-trip-${trip.id}`,
            () => runPostTripLearning(trip.user_id as string, trip.id)
          );
          return { tripId: trip.id, success: true, result };
        } catch (err) {
          return {
            tripId: trip.id,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    return {
      processed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }
);
