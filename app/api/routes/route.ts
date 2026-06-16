import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

export interface RouteMode {
  mode: "driving" | "transit" | "walking";
  durationMinutes: number;
  distanceMiles: number | null;
  cost: string | null;
  transfers: number | null;
  steps: Array<{ instruction: string; durationMinutes: number; mode: string }>;
  uberDeepLink: string | null;
  mapsDeepLink: string;
  summary: string;
}

async function fetchRoute(
  origin: string,
  destination: string,
  mode: "driving" | "transit",
  departureUnix?: number
): Promise<RouteMode | null> {
  if (!GOOGLE_KEY) return null;

  const params: Record<string, string> = {
    origin,
    destination,
    mode,
    key: GOOGLE_KEY,
  };
  if (mode === "driving" && departureUnix) {
    params.departure_time  = String(departureUnix);
    params.traffic_model   = "best_guess";
  }
  if (mode === "transit") {
    params.transit_mode    = "bus|subway|train";
    params.alternatives    = "true";
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?${new URLSearchParams(params)}`,
    { cache: "no-store" }
  );
  const json = await res.json();

  if (json.status !== "OK" || !json.routes?.length) return null;

  const route = json.routes[0];
  const leg   = route.legs[0];

  const durationSecs = (mode === "driving"
    ? leg.duration_in_traffic?.value
    : leg.duration?.value) ?? leg.duration?.value ?? 0;
  const distanceMeters = leg.distance?.value ?? 0;

  const steps = (leg.steps ?? []).slice(0, 6).map((s: Record<string, unknown>) => ({
    instruction: (s.html_instructions as string)?.replace(/<[^>]+>/g, "") ?? "",
    durationMinutes: Math.ceil(((s.duration as { value?: number })?.value ?? 0) / 60),
    mode: (s.travel_mode as string ?? mode).toLowerCase(),
  }));

  let cost: string | null = null;
  let transfers: number | null = null;
  if (mode === "transit") {
    // Transit details
    const tDetails = leg.steps?.find((s: Record<string, unknown>) => s.travel_mode === "TRANSIT")
      ?.transit_details?.line?.vehicle?.type;
    transfers = Math.max(0, (leg.steps?.filter((s: Record<string, unknown>) => s.travel_mode === "TRANSIT").length ?? 1) - 1);
    cost = tDetails === "SUBWAY" ? "$2.90" : "$3.00"; // NYC estimate
  }

  return {
    mode,
    durationMinutes: Math.ceil(durationSecs / 60),
    distanceMiles: Math.round((distanceMeters / 1609.34) * 10) / 10,
    cost,
    transfers,
    steps,
    uberDeepLink: null,
    mapsDeepLink: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${mode}`,
    summary: route.summary ?? "",
  };
}

export async function GET(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const [{ data: profile }, { data: trip }] = await Promise.all([
    supabase.from("users").select("home_address, home_lat, home_lng").eq("id", user.id).single(),
    supabase.from("trips").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single(),
  ]);

  if (!profile?.home_address && !profile?.home_lat) {
    return NextResponse.json({ error: "Home address not set. Update it in Preferences." }, { status: 400 });
  }

  const originCoord = profile?.home_lat && profile?.home_lng
    ? `${profile.home_lat},${profile.home_lng}`
    : (profile?.home_address ?? "");

  const terminalStr = trip?.terminal ? ` Terminal ${trip.terminal}` : "";
  const destination = `${trip?.origin ?? "JFK"} Airport${terminalStr}`;

  const departureUnix = trip?.departure_time
    ? Math.floor(new Date(trip.departure_time).getTime() / 1000)
    : Math.floor(Date.now() / 1000) + 7200;

  // Fetch driving + transit in parallel
  const [driving, transit] = await Promise.all([
    fetchRoute(originCoord, destination, "driving", departureUnix),
    fetchRoute(originCoord, destination, "transit"),
  ]);

  // Build Uber deep link
  let uberDeepLink: string | null = null;
  if (profile?.home_lat && profile?.home_lng) {
    // We need airport coordinates — use destination string as dropoff
    const airportCoords = {
      JFK: { lat: 40.6413, lng: -73.7781 },
      LAX: { lat: 33.9416, lng: -118.4085 },
      ORD: { lat: 41.9742, lng: -87.9073 },
      ATL: { lat: 33.6407, lng: -84.4277 },
      DFW: { lat: 32.8998, lng: -97.0403 },
      SFO: { lat: 37.6213, lng: -122.379 },
      LGA: { lat: 40.7769, lng: -73.8740 },
      EWR: { lat: 40.6895, lng: -74.1745 },
      BOS: { lat: 42.3656, lng: -71.0096 },
      MIA: { lat: 25.7959, lng: -80.2870 },
    } as Record<string, { lat: number; lng: number }>;

    const airportCode = trip?.origin ?? "JFK";
    const airportLatLng = airportCoords[airportCode];

    if (airportLatLng) {
      const uberParams = new URLSearchParams({
        action: "setPickup",
        "pickup[latitude]":  String(profile.home_lat),
        "pickup[longitude]": String(profile.home_lng),
        "pickup[nickname]":  "Home",
        "dropoff[latitude]":  String(airportLatLng.lat),
        "dropoff[longitude]": String(airportLatLng.lng),
        "dropoff[nickname]":  `${airportCode} Airport`,
      });
      uberDeepLink = `uber://?${uberParams}`;
    }
  }

  if (driving) driving.uberDeepLink = uberDeepLink;

  return NextResponse.json({
    origin: originCoord,
    destination,
    driving: driving ?? {
      mode: "driving",
      durationMinutes: 45,
      distanceMiles: 18,
      cost: null,
      transfers: null,
      steps: [],
      uberDeepLink,
      mapsDeepLink: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originCoord)}&destination=${encodeURIComponent(destination)}&travelmode=driving`,
      summary: "Via highway",
    },
    transit: transit ?? null,
  });
}
