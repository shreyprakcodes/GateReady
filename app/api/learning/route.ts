import { NextRequest, NextResponse } from "next/server";
import { runPostTripLearning } from "@/lib/agent/learning";
import { inngest } from "@/inngest/client";

export async function POST(request: NextRequest) {
  const { userId, tripId } = await request.json();

  if (!userId || !tripId) {
    return NextResponse.json(
      { error: "Missing userId or tripId" },
      { status: 400 }
    );
  }

  try {
    const result = await runPostTripLearning(userId, tripId);
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
  const { userId, tripId } = await request.json();

  if (!userId || !tripId) {
    return NextResponse.json(
      { error: "Missing userId or tripId" },
      { status: 400 }
    );
  }

  await inngest.send({
    name: "gateready/trip.completed",
    data: { userId, tripId },
  });

  return NextResponse.json({ ok: true, queued: true });
}
