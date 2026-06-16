import { NextRequest, NextResponse } from "next/server";
import { parsePkpass } from "@/lib/boarding-pass/pkpass";
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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!file.name.endsWith(".pkpass")) {
    return NextResponse.json(
      { error: "File must be a .pkpass file" },
      { status: 400 }
    );
  }

  let parsed;
  try {
    const buffer = await file.arrayBuffer();
    parsed = await parsePkpass(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse boarding pass: ${err instanceof Error ? err.message : String(err)}` },
      { status: 422 }
    );
  }

  // Enrich with live flight status if we have flight number + date
  let enriched = { ...parsed };
  if (parsed.flight_number && parsed.departure_date) {
    try {
      const live = await getFlightStatus({
        flight_number: parsed.flight_number,
        date: parsed.departure_date,
      });
      enriched = {
        ...enriched,
        gate:     enriched.gate     ?? live.gate,
        terminal: enriched.terminal ?? live.terminal,
        departure_time:
          enriched.departure_time ?? live.scheduled_departure,
        boarding_time:
          enriched.boarding_time ?? live.boarding_time,
      };
    } catch {
      // Use what we have from the pass
    }
  }

  // Build departure_time as ISO8601 if we have date + time
  let departure_time: string | null = null;
  if (enriched.departure_date && enriched.departure_time) {
    try {
      departure_time = new Date(
        `${enriched.departure_date}T${enriched.departure_time}`
      ).toISOString();
    } catch {
      departure_time = null;
    }
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
      flight_number:     enriched.flight_number,
      airline:           enriched.airline,
      origin:            enriched.origin,
      destination:       enriched.destination,
      departure_time,
      boarding_time:     enriched.boarding_time,
      gate:              enriched.gate,
      terminal:          enriched.terminal,
      seat:              enriched.seat,
      confirmation_code: enriched.confirmation_code,
      raw_boarding_pass: enriched.raw,
      status:            "scheduled",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ trip, parsed: enriched });
}
