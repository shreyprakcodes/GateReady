import { type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getDriveTime, distanceToAirportKm } from "@/lib/api/maps";
import { getTsaWait }    from "@/lib/api/tsa";
import { computeLeaveTime } from "@/lib/leaveNow";

// Straight-line km above which driving to the airport is implausible.
// E.g. Phoenix user with a JFK flight → ~3400 km → skip live drive routing.
const FAR_THRESHOLD_KM = 500;

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────
  const client = await createSessionClient();
  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body (lat/lng optional; tripId optional) ───────────────
  let lat: number | undefined;
  let lng: number | undefined;
  let tripId: string | undefined;

  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.lat === "number") lat = body.lat;
    if (typeof body.lng === "number") lng = body.lng;
    if (typeof body.tripId === "string") tripId = body.tripId;
  } catch {
    // Body is optional
  }

  // ── Load active trip ────────────────────────────────────────────
  const baseQ = client.from("trips").select("*").eq("user_id", user.id);
  const { data: trip, error: tripErr } = await (
    tripId
      ? baseQ.eq("id", tripId).single()
      : baseQ
          .gte("departure_time", new Date().toISOString())
          .order("departure_time", { ascending: true })
          .limit(1)
          .single()
  );

  if (tripErr || !trip?.departure_time) {
    return Response.json({ error: "No upcoming flight found" }, { status: 404 });
  }

  const airportIata   = trip.origin ?? null;
  const departureTime = new Date(trip.departure_time);
  const hasCoords     = typeof lat === "number" && typeof lng === "number";

  // ── Straight-line distance check ────────────────────────────────
  // Prevents routing a user to an airport hundreds of kilometres away,
  // which would return a correct but useless multi-day drive time.
  const distanceKm: number | null =
    hasCoords && airportIata
      ? distanceToAirportKm(lat!, lng!, airportIata)
      : null;

  const isFarFromAirport =
    distanceKm !== null && distanceKm > FAR_THRESHOLD_KM;

  // Route via Maps only when: coords known + airport known + not far away.
  // A null distanceKm (airport not in our table) still allows routing;
  // getDriveTime's 300-min cap acts as the second-layer guard.
  const canRoute =
    hasCoords && !!airportIata && !isFarFromAirport;

  // ── Fetch drive + TSA concurrently ──────────────────────────────
  const [driveResult, tsaResult] = await Promise.all([
    canRoute
      ? getDriveTime(lat!, lng!, airportIata!)
      : Promise.resolve({ durationMinutes: 45, isLive: false }),
    getTsaWait(airportIata ?? "JFK"),
  ]);

  // When far from the airport, exclude drive time from the calculation.
  // The card will surface a clear "far away" note in the breakdown.
  const effectiveDriveMinutes = isFarFromAirport ? 0 : driveResult.durationMinutes;

  // ── Compute leave time ──────────────────────────────────────────
  const result = computeLeaveTime({
    departureTime,
    driveMinutes: effectiveDriveMinutes,
    tsaMinutes:   tsaResult.waitMinutes,
  });

  // ── Build drive note ────────────────────────────────────────────
  let driveNote: string | undefined;
  if (isFarFromAirport && airportIata) {
    driveNote = `You appear to be ${Math.round(distanceKm!)} km from ${airportIata} — drive time not factored in`;
  } else if (!hasCoords) {
    driveNote = "No location — using 45 min estimate";
  } else if (!airportIata) {
    driveNote = "Airport unknown — using 45 min estimate";
  }

  return Response.json({
    recommendedLeaveTime: result.recommendedLeaveTime.toISOString(),
    minutesUntilLeave:    result.minutesUntilLeave,
    status:               result.status,
    segments:             result.segments,
    inputs: {
      drive: {
        minutes:     effectiveDriveMinutes,
        isLive:      isFarFromAirport ? false : driveResult.isLive,
        unavailable: isFarFromAirport || undefined,   // omitted (not serialized) when false
        distanceKm:  distanceKm !== null ? Math.round(distanceKm) : undefined,
        note:        driveNote,
      },
      tsa: {
        minutes: tsaResult.waitMinutes,
        source:  tsaResult.source,
        note:    tsaResult.note,
      },
      walkToGate: { minutes: 15 },
      buffer:     { minutes: 20 },
    },
  });
}
