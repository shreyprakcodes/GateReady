import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

export interface DepartureWindowResult {
  trafficMinutes: number;
  tsaMinutes: number;
  totalMinutes: number;
  comfortable: string; // ISO
  tight: string;
  cutting: string;
  comfortableLabel: string;
  tightLabel: string;
  cuttingLabel: string;
  depTime: string;
}

async function getTrafficMinutes(origin: string, destination: string, departureUnix: number): Promise<number> {
  if (!GOOGLE_KEY) return 45; // fallback

  const params = new URLSearchParams({
    origin,
    destination,
    departure_time: String(departureUnix),
    traffic_model: "pessimistic",
    key: GOOGLE_KEY,
  });

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`, { cache: "no-store" });
    const json = await res.json();

    const leg = json.routes?.[0]?.legs?.[0];
    if (!leg) return 45;

    const secs = leg.duration_in_traffic?.value ?? leg.duration?.value ?? 2700;
    return Math.ceil(secs / 60);
  } catch {
    return 45;
  }
}

async function getTsaMinutes(airportIata: string, hasPrecheck: boolean): Promise<number> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/tsa?airport=${airportIata}`,
      { cache: "no-store" }
    );
    if (!res.ok) return hasPrecheck ? 5 : 20;
    const data = await res.json();

    const lanes: Array<{ type: string; waitMinutes: number }> = data.lanes ?? [];
    const targetType = hasPrecheck ? "precheck" : "standard";
    const lane = lanes.find((l) => l.type === targetType) ?? lanes[0];
    return lane?.waitMinutes ?? (hasPrecheck ? 5 : 20);
  } catch {
    return hasPrecheck ? 5 : 20;
  }
}

function fmtLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60_000);
}

function subMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() - mins * 60_000);
}

export async function GET(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tripId = request.nextUrl.searchParams.get("tripId");
  const supabase = createServiceClient();

  // Get trip + user data in parallel
  const [{ data: trip }, { data: profile }] = await Promise.all([
    tripId
      ? supabase.from("trips").select("*").eq("id", tripId).single()
      : supabase.from("trips").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single(),
    supabase.from("users").select("home_address, home_lat, home_lng, tsa_precheck").eq("id", user.id).single(),
  ]);

  if (!trip?.departure_time) {
    return NextResponse.json({ error: "No departure time found" }, { status: 404 });
  }

  const depTime = new Date(trip.departure_time);
  const hasPrecheck = profile?.tsa_precheck ?? false;

  // Determine origin: lat,lng or address string
  const origin = profile?.home_lat && profile?.home_lng
    ? `${profile.home_lat},${profile.home_lng}`
    : (profile?.home_address ?? "New York, NY");

  // Destination: airport terminal if known, else airport name
  const terminalStr = trip.terminal ? ` Terminal ${trip.terminal}` : "";
  const destination = `${trip.origin ?? "JFK"} Airport${terminalStr}`;

  // Calculate departure unix for traffic API (now or 2h before departure if in the past)
  const departureUnix = Math.max(Math.floor(Date.now() / 1000), Math.floor(depTime.getTime() / 1000) - 7200);

  // Fetch traffic + TSA in parallel
  const [trafficMinutes, tsaMinutes] = await Promise.all([
    getTrafficMinutes(origin, destination, departureUnix),
    getTsaMinutes(trip.origin ?? "JFK", hasPrecheck),
  ]);

  const gateWalkMinutes = 6;
  const bufferMinutes   = 10;
  const totalMinutes    = trafficMinutes + tsaMinutes + gateWalkMinutes + bufferMinutes;

  const comfortable = subMinutes(depTime, totalMinutes + 30);
  const tight       = subMinutes(depTime, totalMinutes + 15);
  const cutting     = subMinutes(depTime, totalMinutes);

  const result: DepartureWindowResult = {
    trafficMinutes,
    tsaMinutes,
    totalMinutes,
    comfortable: comfortable.toISOString(),
    tight:       tight.toISOString(),
    cutting:     cutting.toISOString(),
    comfortableLabel: fmtLabel(comfortable.toISOString()),
    tightLabel:       fmtLabel(tight.toISOString()),
    cuttingLabel:     fmtLabel(cutting.toISOString()),
    depTime: depTime.toISOString(),
  };

  // Persist to user_preferences so dashboard can show it without re-fetching
  await supabase.from("user_preferences").upsert({
    user_id: user.id,
    key: "departure_window",
    value: { comfortable: result.comfortable, tight: result.tight, cutoff: result.cutting },
    confidence_score: 1,
    source: "calculated",
    times_observed: 1,
    last_updated: new Date().toISOString(),
  }, { onConflict: "user_id, key" });

  return NextResponse.json(result);
}
