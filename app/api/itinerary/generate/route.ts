import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function getDirections(origin: string, destination: string, departureUnix: number) {
  if (!GOOGLE_KEY) return null;
  const params = new URLSearchParams({
    origin,
    destination,
    departure_time: String(departureUnix),
    traffic_model: "pessimistic",
    key: GOOGLE_KEY,
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`, { cache: "no-store" });
  const json = await res.json();
  if (json.status !== "OK") return null;
  const leg = json.routes?.[0]?.legs?.[0];
  return {
    durationSecs: leg?.duration_in_traffic?.value ?? leg?.duration?.value ?? 2700,
    summary: json.routes?.[0]?.summary ?? "",
  };
}

async function getTsaWait(airportIata: string, hasPrecheck: boolean): Promise<number> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/tsa?airport=${airportIata}`, { cache: "no-store" });
    if (!res.ok) return hasPrecheck ? 5 : 20;
    const data = await res.json();
    const targetType = hasPrecheck ? "precheck" : "standard";
    const lane = (data.lanes ?? []).find((l: { type: string }) => l.type === targetType) ?? data.lanes?.[0];
    return lane?.waitMinutes ?? (hasPrecheck ? 5 : 20);
  } catch { return hasPrecheck ? 5 : 20; }
}

interface Step {
  position: number;
  time: string;
  label: string;
  icon: string;
  detail: string;
  step_type: string;
  status: string;
}

function addMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60_000);
}

function subMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() - mins * 60_000);
}

export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tripId } = await request.json();
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const supabase = createServiceClient();

  // Verify trip belongs to user
  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).eq("user_id", user.id).single();
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (!trip.departure_time) return NextResponse.json({ error: "Trip has no departure time" }, { status: 400 });

  const { data: profile } = await supabase
    .from("users")
    .select("home_address, home_lat, home_lng, tsa_precheck, preferred_transport")
    .eq("id", user.id)
    .single();

  const depTime = new Date(trip.departure_time);
  const boardingTime = trip.boarding_time ? new Date(trip.boarding_time) : subMinutes(depTime, 30);
  const hasPrecheck = profile?.tsa_precheck ?? false;

  const originCoord = profile?.home_lat && profile?.home_lng
    ? `${profile.home_lat},${profile.home_lng}`
    : (profile?.home_address ?? "New York, NY");

  const terminalStr = trip.terminal ? ` Terminal ${trip.terminal}` : "";
  const destination = `${trip.origin ?? "JFK"} Airport${terminalStr}`;

  const departureUnix = Math.floor(depTime.getTime() / 1000) - 10800; // 3h before for routing

  const [directions, tsaMinutes] = await Promise.all([
    getDirections(originCoord, destination, departureUnix),
    getTsaWait(trip.origin ?? "JFK", hasPrecheck),
  ]);

  const trafficMinutes = directions ? Math.ceil(directions.durationSecs / 60) : 45;
  const gateWalkMinutes = 6;
  const bufferMinutes   = 15;

  // Build timeline working backwards from departure
  const atGateTime      = subMinutes(depTime, bufferMinutes);
  const gateWalkStart   = subMinutes(atGateTime, gateWalkMinutes);
  const tsaEnd          = gateWalkStart;
  const tsaStart        = subMinutes(tsaEnd, tsaMinutes);
  const bagDropStart    = subMinutes(tsaStart, 10);
  const arriveAirport   = subMinutes(bagDropStart, 5);
  const departHomeTime  = subMinutes(arriveAirport, trafficMinutes);
  const prepTime        = subMinutes(departHomeTime, 20);

  const transportLabel = (profile?.preferred_transport ?? "uber").toLowerCase().includes("uber") ? "Uber" : "Drive";
  const transportType  = (profile?.preferred_transport ?? "uber").toLowerCase().includes("uber") ? "car" : "car";

  const steps: Step[] = [
    {
      position: 1,
      time: prepTime.toISOString(),
      label: "Prepare to leave",
      icon: "bag",
      detail: "Grab your bags, ID, and passport. Check you have your boarding pass.",
      step_type: "preparation",
      status: "pending",
    },
    {
      position: 2,
      time: departHomeTime.toISOString(),
      label: `${transportLabel} to ${trip.origin ?? "airport"}`,
      icon: transportType,
      detail: `${trafficMinutes} min drive · ${directions?.summary ? `via ${directions.summary}` : "via fastest route"}`,
      step_type: "transport",
      status: "pending",
    },
    {
      position: 3,
      time: arriveAirport.toISOString(),
      label: `Arrive at ${trip.origin ?? "airport"}`,
      icon: "airport",
      detail: `${trip.terminal ? `Terminal ${trip.terminal}` : "Main terminal"} · Follow signs to check-in`,
      step_type: "arrive",
      status: "pending",
    },
    {
      position: 4,
      time: bagDropStart.toISOString(),
      label: "Bag drop / Check-in",
      icon: "checkin",
      detail: "Use kiosk or counter · Have ID and booking reference ready",
      step_type: "checkin",
      status: "pending",
    },
    {
      position: 5,
      time: tsaStart.toISOString(),
      label: hasPrecheck ? "TSA PreCheck" : "TSA Security",
      icon: "security",
      detail: `~${tsaMinutes} min wait · ${hasPrecheck ? "Keep shoes on, laptop in bag" : "Shoes off, laptop out, 3-1-1 bag"}`,
      step_type: "security",
      status: "pending",
    },
    {
      position: 6,
      time: gateWalkStart.toISOString(),
      label: `Walk to Gate ${trip.gate ?? "—"}`,
      icon: "walk",
      detail: `${trip.gate ? `Gate ${trip.gate}` : "Check departures board for your gate"} · ~${gateWalkMinutes} min walk`,
      step_type: "walk",
      status: "pending",
    },
    {
      position: 7,
      time: atGateTime.toISOString(),
      label: "At the gate",
      icon: "gate",
      detail: `Relax — you have ${bufferMinutes} min buffer before boarding. Check for gate changes.`,
      step_type: "gate",
      status: "pending",
    },
    {
      position: 8,
      time: boardingTime.toISOString(),
      label: "Boarding",
      icon: "board",
      detail: `Board ${trip.airline ?? ""} ${trip.flight_number ?? ""} · Have boarding pass ready`,
      step_type: "boarding",
      status: "pending",
    },
    {
      position: 9,
      time: depTime.toISOString(),
      label: `Depart ${trip.origin ?? "—"} → ${trip.destination ?? "—"}`,
      icon: "depart",
      detail: `${trip.flight_number ?? "Flight"} · ${trip.seat ? `Seat ${trip.seat}` : "Check boarding pass for seat"}`,
      step_type: "depart",
      status: "pending",
    },
  ];

  // Delete old steps and insert new ones
  await supabase.from("itinerary_steps").delete().eq("trip_id", tripId);

  const { error } = await supabase.from("itinerary_steps").insert(
    steps.map((s) => ({ ...s, trip_id: tripId, updated_at: new Date().toISOString() }))
  );

  if (error) {
    console.error("[itinerary/generate]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log to trip_events
  await supabase.from("trip_events").insert({
    user_id: user.id,
    trip_id: tripId,
    event_type: "itinerary_generated",
    data: { trafficMinutes, tsaMinutes, stepCount: steps.length },
  });

  return NextResponse.json({ steps });
}
