import { type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import type { NormalizedFlight } from "@/app/api/flights/lookup/route";

export async function POST(request: NextRequest) {
  const client = await createSessionClient();
  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { flight: NormalizedFlight & { seat?: string | null } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { flight } = body;
  if (!flight?.flightNumber) {
    return Response.json({ error: "Missing flight data" }, { status: 400 });
  }

  // Ensure the public.users profile row exists before inserting a trip
  await client
    .from("users")
    .upsert({ id: user.id, email: user.email ?? null }, { onConflict: "id", ignoreDuplicates: true });

  const { data: trip, error } = await client
    .from("trips")
    .insert({
      user_id:        user.id,
      flight_number:  flight.flightNumber,
      airline:        flight.airlineName ?? flight.airline ?? null,
      origin:         flight.departure_airport ?? null,
      destination:    flight.arrival_airport ?? null,
      departure_time:      flight.departure_time      ?? null,
      departure_scheduled: flight.departure_scheduled ?? null,
      departure_estimated: flight.departure_estimated ?? null,
      departure_actual:    flight.departure_actual    ?? null,
      arrival_time:        flight.arrival_time        ?? null,
      arrival_scheduled:   flight.arrival_scheduled   ?? null,
      arrival_estimated:   flight.arrival_estimated   ?? null,
      arrival_actual:      flight.arrival_actual      ?? null,
      departure_timezone:   flight.departure_timezone ?? null,
      destination_timezone: flight.arrival_timezone   ?? null,
      status:              flight.status ?? "scheduled",
      gate:           flight.gate ?? null,
      terminal:       flight.terminal ?? null,
      seat:           flight.seat ?? null,
      raw_boarding_pass: flight.raw ? { source: "lookup", raw: flight.raw } : null,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ trip }, { status: 201 });
}
