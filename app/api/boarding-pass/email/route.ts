import { NextRequest, NextResponse } from "next/server";
import { scanGmailForFlights } from "@/lib/boarding-pass/email";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";
import { getFlightStatus } from "@/lib/api/aviation";

export async function POST(request: NextRequest) {
  // Always derive userId from the authenticated session — never trust the body
  const sessionClient = await createSessionClient();
  const { data: { user }, error: authErr } = await sessionClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  const { accessToken } = await request.json();

  if (!accessToken) {
    return NextResponse.json({ error: "Missing accessToken" }, { status: 400 });
  }

  let flights;
  try {
    flights = await scanGmailForFlights(accessToken);
  } catch (err) {
    return NextResponse.json(
      { error: `Gmail scan failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  if (flights.length === 0) {
    return NextResponse.json({ trips: [], message: "No flight confirmations found in email." });
  }

  const supabase = createServiceClient();

  // Ensure public.users row exists before inserting trips
  await supabase
    .from("users")
    .upsert({ id: userId, email: user.email ?? null }, { onConflict: "id", ignoreDuplicates: true });

  // Only one active trip at a time — delete any existing trips for this user
  await supabase.from("trips").delete().eq("user_id", userId);

  const createdTrips = [];

  for (const flight of flights) {
    // Enrich with live status
    let gate: string | null = flight.gate;
    let terminal: string | null = flight.terminal;
    let boardingTime: string | null = null;

    if (flight.flight_number && flight.departure_date) {
      try {
        const live = await getFlightStatus({
          flight_number: flight.flight_number,
          date: flight.departure_date,
        });
        gate     = gate     ?? live.gate;
        terminal = terminal ?? live.terminal;
        boardingTime = live.boarding_time;
      } catch {
        // proceed without enrichment
      }
    }

    let departure_time: string | null = null;
    if (flight.departure_date && flight.departure_time) {
      try {
        departure_time = new Date(
          `${flight.departure_date}T${flight.departure_time}`
        ).toISOString();
      } catch {
        departure_time = null;
      }
    }

    const { data: trip, error } = await supabase
      .from("trips")
      .insert({
        user_id:           userId,
        flight_number:     flight.flight_number,
        airline:           flight.airline,
        origin:            flight.origin,
        destination:       flight.destination,
        departure_time,
        boarding_time:     boardingTime,
        gate,
        terminal,
        seat:              flight.seat,
        confirmation_code: flight.confirmation_code,
        raw_boarding_pass: { source: "email", email_id: flight.source_email_id },
        status:            "scheduled",
      })
      .select()
      .single();

    if (!error && trip) createdTrips.push(trip);
  }

  return NextResponse.json({ trips: createdTrips, found: flights.length });
}
