import { inngest } from "./client";
import { getFlightStatus } from "@/lib/api/aviation";
import { computeLeaveTime } from "@/lib/leaveNow";
import { createServiceClient } from "@/lib/supabase/server";

type NotifChange = {
  tripId: string;
  userId: string;
  updates: Record<string, unknown>;
  notifications: Array<{ type: string; title: string; body: string }>;
};

export const pollFlightStatus = inngest.createFunction(
  { id: "poll-flight-status", triggers: { cron: "*/10 * * * *" } },
  async ({ step }) => {
    const changes = await step.run("load-and-detect-changes", async () => {
      const db = createServiceClient();
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60_000);
      const in24h = new Date(now.getTime() + 24 * 60 * 60_000);

      const { data: trips, error } = await db
        .from("trips")
        .select("*")
        .gte("departure_time", twoHoursAgo.toISOString())
        .lte("departure_time", in24h.toISOString())
        .neq("status", "cancelled")
        .neq("status", "landed");

      if (error || !trips?.length) return [] as NotifChange[];

      const results: NotifChange[] = [];

      for (const trip of trips) {
        if (!trip.flight_number) continue;

        let fresh;
        try {
          fresh = await getFlightStatus({ flight_number: trip.flight_number, date: "" });
        } catch {
          continue;
        }

        const notifs: Array<{ type: string; title: string; body: string }> = [];
        const updates: Record<string, unknown> = {};

        // ── Status / cancellation ─────────────────────────────
        if (fresh.status && fresh.status !== trip.status) {
          updates.status = fresh.status;
          if (fresh.status === "cancelled") {
            notifs.push({
              type: "cancellation",
              title: "Flight Cancelled",
              body: `${trip.flight_number} has been cancelled. Contact your airline for rebooking.`,
            });
          }
        }

        // ── Gate / terminal change ────────────────────────────
        const newGate = fresh.gate !== "TBD" ? fresh.gate : null;
        const newTerminal = fresh.terminal !== "TBD" ? fresh.terminal : null;
        const gateChanged = newGate && newGate !== trip.gate;
        const terminalChanged = newTerminal && newTerminal !== trip.terminal;

        if (gateChanged) {
          updates.gate = newGate;
          if (terminalChanged) updates.terminal = newTerminal;
          const terminalPart = terminalChanged ? `, Terminal ${newTerminal}` : "";
          notifs.push({
            type: "gate_change",
            title: `Gate changed to ${newGate}${terminalPart}`,
            body: `${trip.flight_number} now departs from Gate ${newGate}${terminalPart}. Head there as soon as possible.`,
          });
        } else if (terminalChanged) {
          updates.terminal = newTerminal;
          notifs.push({
            type: "gate_change",
            title: `Terminal changed to ${newTerminal}`,
            body: `${trip.flight_number} now departs from Terminal ${newTerminal}.`,
          });
        }

        // ── Always sync time breakdown columns ───────────────
        if (fresh.departure_scheduled_iso) updates.departure_scheduled = fresh.departure_scheduled_iso;
        if (fresh.departure_estimated_iso) updates.departure_estimated = fresh.departure_estimated_iso;
        if (fresh.departure_actual_iso)    updates.departure_actual    = fresh.departure_actual_iso;
        if (fresh.arrival_scheduled_iso)   updates.arrival_scheduled   = fresh.arrival_scheduled_iso;
        if (fresh.arrival_estimated_iso)   updates.arrival_estimated   = fresh.arrival_estimated_iso;
        if (fresh.arrival_actual_iso)      updates.arrival_actual      = fresh.arrival_actual_iso;

        // ── Delay ─────────────────────────────────────────────
        const hasDelay =
          fresh.delay_minutes > 0 &&
          fresh.scheduled_departure &&
          fresh.scheduled_departure !== trip.departure_time;

        if (hasDelay) {
          updates.departure_time = fresh.scheduled_departure;

          const mins = fresh.delay_minutes;
          const delayStr =
            mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
          const newDep = new Date(fresh.scheduled_departure);
          const depStr = newDep.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

          // Recompute leave time with updated departure (fallback estimates for drive/TSA)
          const leave = computeLeaveTime({ departureTime: newDep, driveMinutes: 45, tsaMinutes: 20 });
          const leaveStr = leave.recommendedLeaveTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });

          notifs.push({
            type: "delay",
            title: `Flight delayed ${delayStr}`,
            body: `${trip.flight_number} now departs at ${depStr}. Your recommended leave time is now ${leaveStr}.`,
          });
        }

        if (Object.keys(updates).length > 0 || notifs.length > 0) {
          results.push({
            tripId: trip.id,
            userId: trip.user_id,
            updates,
            notifications: notifs,
          });
        }
      }

      return results;
    });

    if (!changes.length) return { processed: 0 };

    await step.run("persist-changes", async () => {
      const db = createServiceClient();
      // Dedup window: suppress notifications for the same (trip, type) seen in last 30 min
      const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();

      for (const change of changes) {
        if (Object.keys(change.updates).length > 0) {
          await db.from("trips").update(change.updates).eq("id", change.tripId);
        }

        for (const notif of change.notifications) {
          const { data: existing } = await db
            .from("notifications")
            .select("id")
            .eq("trip_id", change.tripId)
            .eq("type", notif.type)
            .gte("created_at", thirtyMinAgo)
            .limit(1);

          if (existing?.length) continue; // already notified about this change

          await db.from("notifications").insert({
            user_id: change.userId,
            trip_id: change.tripId,
            type:    notif.type,
            title:   notif.title,
            body:    notif.body,
          });
        }
      }
    });

    return { processed: changes.length };
  },
);
