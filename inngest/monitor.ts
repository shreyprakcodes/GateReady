import { inngest } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import { getFlightStatus } from "@/lib/api/aviation";
import { getWaitTime } from "@/lib/api/tsa";
import { getTraffic } from "@/lib/api/maps";
import { runAgentLoop } from "@/lib/agent/loop";
import { execTool } from "@/lib/agent/tool-handlers";

const THRESHOLDS = {
  flight_delay_added: 10,
  tsa_spike: 8,
  traffic_spike: 5,
};

export const monitorTrips = inngest.createFunction(
  {
    id: "monitor-trips",
    name: "GateReady: Monitor Active Trips",
    triggers: [{ cron: "*/10 * * * *" }],
  },
  async ({ step }) => {
    const supabase = createServiceClient();

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: trips, error } = await supabase
      .from("trips")
      .select("*")
      .gte("departure_time", now.toISOString())
      .lte("departure_time", in24h.toISOString())
      .neq("status", "cancelled");

    if (error || !trips?.length) return { checked: 0 };

    const results = await Promise.all(
      trips.map(async (trip) => {
        const date = trip.departure_time
          ? (trip.departure_time as string).split("T")[0]
          : now.toISOString().split("T")[0];

        let needsReplan = false;
        const reasons: string[] = [];

        // ── Flight status check ─────────────────────────────────
        if (trip.flight_number) {
          const flightStatus = await step.run(
            `check-flight-${trip.id}`,
            async () =>
              getFlightStatus({ flight_number: trip.flight_number as string, date })
          );

          const previousDelay = 0;
          if (
            flightStatus.delay_minutes - previousDelay >
            THRESHOLDS.flight_delay_added
          ) {
            needsReplan = true;
            reasons.push(`Flight delayed ${flightStatus.delay_minutes} minutes`);
          }
        }

        // ── TSA wait check ──────────────────────────────────────
        if (trip.origin && trip.terminal) {
          const tsaWait = await step.run(`check-tsa-${trip.id}`, async () =>
            getWaitTime({
              airport: trip.origin as string,
              terminal: trip.terminal as string,
              lane_type: "standard",
            })
          );

          const previousWait = 8;
          if (tsaWait.wait_minutes - previousWait > THRESHOLDS.tsa_spike) {
            needsReplan = true;
            reasons.push(`TSA wait spiked to ${tsaWait.wait_minutes} minutes`);
          }
        }

        // ── Traffic check ───────────────────────────────────────
        const { data: user } = await supabase
          .from("users")
          .select("home_address")
          .eq("id", trip.user_id)
          .single();

        if (user?.home_address && trip.origin) {
          const traffic = await step.run(
            `check-traffic-${trip.id}`,
            async () =>
              getTraffic({
                origin: user.home_address as string,
                destination: trip.origin as string,
                departure_time:
                  (trip.departure_time as string) ?? new Date().toISOString(),
              })
          );

          const previousDelay = 5;
          if (
            traffic.delay_minutes - previousDelay >
            THRESHOLDS.traffic_spike
          ) {
            needsReplan = true;
            reasons.push(
              `Traffic delay increased to ${traffic.delay_minutes} minutes`
            );
          }
        }

        // ── Replan if thresholds crossed ────────────────────────
        if (needsReplan) {
          await step.run(`replan-${trip.id}`, async () => {
            const trigger = reasons.join("; ");
            await runAgentLoop({
              messages: [
                {
                  role: "user",
                  content: `Background monitor detected changes: ${trigger}. Please replan the itinerary for trip ${trip.id} and set an urgent alert.`,
                },
              ],
              userId: trip.user_id as string,
              tripId: trip.id as string,
              onToolCall: () => {},
              onToolResult: () => {},
            });
          });

          await execTool(
            "set_alert",
            {
              user_id: trip.user_id,
              trip_id: trip.id,
              message: `Your travel plan has been updated: ${reasons.join(", ")}`,
              trigger_time: new Date().toISOString(),
              type: "urgent",
              priority: 5,
            },
            trip.user_id as string
          );
        }

        return { trip_id: trip.id, needs_replan: needsReplan, reasons };
      })
    );

    // ── Fire trip.completed for any trips that just departed ────────────
    const justDeparted = await step.run("check-departed", async () => {
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("trips")
        .select("id, user_id")
        .lte("departure_time", now.toISOString())
        .gte("departure_time", fiveMinutesAgo)
        .neq("status", "cancelled")
        .neq("status", "departed");
      return data ?? [];
    });

    for (const departed of justDeparted) {
      await step.run(`mark-departed-${departed.id}`, async () => {
        const supabase2 = createServiceClient();
        await supabase2
          .from("trips")
          .update({ status: "departed" })
          .eq("id", departed.id);
      });

      await inngest.send({
        name: "gateready/trip.completed",
        data: { userId: departed.user_id, tripId: departed.id },
      });
    }

    return { checked: trips.length, results, departed: justDeparted.length };
  }
);
