import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";
import type { ParentalSettings } from "@/lib/supabase/types";

export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  // Find all trips this user is monitoring as a parent
  const { data: monitoredTrips } = await supabase
    .from("trips")
    .select("id, user_id, parental_settings")
    .eq("parent_id", user.id)
    .eq("parental_mode", true);

  if (!monitoredTrips || monitoredTrips.length === 0) {
    return NextResponse.json({ overdueAlerts: [] });
  }

  const overdueAlerts: Array<{
    tripId: string;
    stepId: string;
    stepLabel: string;
    stepTime: string;
    minutesOverdue: number;
  }> = [];

  const now = new Date();

  for (const trip of monitoredTrips) {
    const settings = (trip.parental_settings ?? {}) as Partial<ParentalSettings>;
    const alertWindowMinutes = settings.alert_window_minutes ?? 30;

    const { data: steps } = await supabase
      .from("itinerary_steps")
      .select("id, label, time, status")
      .eq("trip_id", trip.id)
      .neq("status", "done")
      .not("time", "is", null);

    if (!steps) continue;

    for (const step of steps) {
      if (!step.time) continue;
      const stepTime = new Date(step.time);
      const deadlineMs = stepTime.getTime() + alertWindowMinutes * 60 * 1000;
      if (now.getTime() <= deadlineMs) continue;

      const minutesOverdue = Math.floor((now.getTime() - deadlineMs) / 60000);

      // Check if an alert for this step was already created
      const { data: existingAlert } = await supabase
        .from("alerts")
        .select("id")
        .eq("user_id", user.id)
        .eq("trip_id", trip.id)
        .ilike("message", `%${step.id}%`)
        .single();

      if (existingAlert) continue;

      // Create the alert for the parent
      const message = `Step overdue (${minutesOverdue}min): "${step.label}" was due at ${new Date(step.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · stepId:${step.id}`;
      await supabase.from("alerts").insert({
        user_id: user.id,
        trip_id: trip.id,
        message,
        type: "urgent",
        priority: 1,
        delivered: false,
        trigger_time: new Date().toISOString(),
      });

      overdueAlerts.push({
        tripId: trip.id,
        stepId: step.id,
        stepLabel: step.label ?? "Step",
        stepTime: step.time,
        minutesOverdue,
      });
    }
  }

  return NextResponse.json({ overdueAlerts });
}
