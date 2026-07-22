import { NextRequest, NextResponse } from "next/server";
import { runPostTripLearning } from "@/lib/agent/learning";
import { inngest } from "@/inngest/client";
import { createSessionClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Identity is derived from the session — never trust a client-supplied userId.
  const sessionClient = await createSessionClient();
  const { data: { user }, error: authErr } = await sessionClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await request.json();

  if (!tripId) {
    return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
  }

  // Verify ownership before reading/aggregating any trip_events or
  // itinerary_steps data — tripId is client-supplied and must never let the
  // caller pull another user's trip signals into their own response.
  const { data: trip, error: tripErr } = await sessionClient
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();

  if (tripErr || !trip) {
    return NextResponse.json({ error: "Trip not found or access denied" }, { status: 403 });
  }

  try {
    const result = await runPostTripLearning(user.id, tripId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Send a gateready/trip.completed event to trigger the Inngest function
export async function PUT(request: NextRequest) {
  // Identity is derived from the session — never trust a client-supplied userId.
  const sessionClient = await createSessionClient();
  const { data: { user }, error: authErr } = await sessionClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await request.json();

  if (!tripId) {
    return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
  }

  // Same ownership guard as POST — never queue a learning run against a
  // trip the caller doesn't own.
  const { data: trip, error: tripErr } = await sessionClient
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();

  if (tripErr || !trip) {
    return NextResponse.json({ error: "Trip not found or access denied" }, { status: 403 });
  }

  await inngest.send({
    name: "gateready/trip.completed",
    data: { userId: user.id, tripId },
  });

  return NextResponse.json({ ok: true, queued: true });
}
