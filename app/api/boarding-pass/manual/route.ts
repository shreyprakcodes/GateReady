import { NextRequest, NextResponse } from "next/server";
import { getFlightStatus } from "@/lib/api/aviation";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Always derive userId from the authenticated session — never trust the body
  const sessionClient = await createSessionClient();
  const { data: { user }, error: authErr } = await sessionClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  const { confirmation_code, flight_number, departure_date } =
    await request.json();

  if (!flight_number || !departure_date) {
    return NextResponse.json(
      { error: "Missing flight_number or departure_date" },
      { status: 400 }
    );
  }

  let status;
  try {
    status = await getFlightStatus({ flight_number, date: departure_date });
  } catch (err) {
    return NextResponse.json(
      { error: `Flight lookup failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  let departure_time: string | null = null;
  try {
    departure_time = status.scheduled_departure
      ? new Date(status.scheduled_departure).toISOString()
      : null;
  } catch {
    departure_time = null;
  }

  const supabase = createServiceClient();

  // Ensure public.users row exists before inserting a trip
  await supabase
    .from("users")
    .upsert({ id: userId, email: user.email ?? null }, { onConflict: "id", ignoreDuplicates: true });

  // Only one active trip at a time — delete any existing trips for this user
  await supabase.from("trips").delete().eq("user_id", userId);

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      user_id:           userId,
      flight_number,
      airline:           status.airline,
      origin:            status.origin,
      destination:       status.destination,
      confirmation_code: confirmation_code ?? null,
      gate:              status.gate,
      terminal:          status.terminal,
      departure_time,
      boarding_time:     status.boarding_time,
      status:            status.status,
      raw_boarding_pass: {
        source: "manual",
        departure_timezone: status.departure_timezone,
        looked_up: status,
      },
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ trip, status });
}
