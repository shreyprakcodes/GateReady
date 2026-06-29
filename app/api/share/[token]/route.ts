import { type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// ── Safe public fields returned to family viewers ─────────────────────────────
// Never expose: user_id, email, raw_boarding_pass, confirmation_code, tokens.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token) return Response.json({ error: "Not found" }, { status: 404 });

  const db = createServiceClient();

  // Look up trip by share_token using the service role (bypasses RLS)
  const { data: trip, error: tripErr } = await db
    .from("trips")
    .select("id, user_id, flight_number, airline, origin, destination, departure_time, departure_scheduled, departure_estimated, departure_actual, departure_timezone, destination_timezone, status, gate, terminal, share_enabled")
    .eq("share_token", token)
    .single();

  if (tripErr || !trip) {
    return Response.json({ active: false, reason: "not_found" });
  }

  if (!trip.share_enabled) {
    return Response.json({ active: false, reason: "disabled" });
  }

  // Fetch traveler display name (first name only from public.users)
  const { data: profile } = await db
    .from("users")
    .select("name")
    .eq("id", trip.user_id)
    .single();

  const displayName = profile?.name
    ? (profile.name.split(" ")[0] ?? profile.name)
    : "Your traveler";

  // Fetch milestones
  const { data: milestones } = await db
    .from("trip_milestones")
    .select("type, reached_at")
    .eq("trip_id", trip.id)
    .order("reached_at", { ascending: true });

  return Response.json({
    active: true,
    trip: {
      flightNumber:  trip.flight_number,
      airline:       trip.airline,
      origin:        trip.origin,
      destination:   trip.destination,
      departureTime:      trip.departure_time,
      departureScheduled: trip.departure_scheduled ?? null,
      departureEstimated: trip.departure_estimated ?? null,
      departureActual:    trip.departure_actual    ?? null,
      departureTz:        trip.departure_timezone  ?? null,
      destinationTz:      trip.destination_timezone ?? null,
      status:             trip.status,
      gate:          trip.gate,
      terminal:      trip.terminal,
      displayName,
    },
    milestones: (milestones ?? []).map((m) => ({
      type:      m.type,
      reachedAt: m.reached_at,
    })),
  });
}
