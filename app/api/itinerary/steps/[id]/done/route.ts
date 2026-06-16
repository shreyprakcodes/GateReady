import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  // Verify the step belongs to this user's trip
  const { data: step } = await supabase
    .from("itinerary_steps")
    .select("id, trip_id, label")
    .eq("id", id)
    .single();

  if (!step) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  // Verify user owns the trip (or has parental access)
  const { data: trip } = await supabase
    .from("trips")
    .select("id, user_id")
    .eq("id", step.trip_id)
    .single();

  if (!trip || trip.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();

  await supabase
    .from("itinerary_steps")
    .update({ status: "done", updated_at: now })
    .eq("id", id);

  await supabase.from("trip_events").insert({
    user_id: user.id,
    trip_id: step.trip_id,
    event_type: "step_done",
    data: { step_id: id, label: step.label, completed_at: now },
  });

  return NextResponse.json({ ok: true });
}
