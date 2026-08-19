import { type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getDriveTime, distanceToAirportKm } from "@/lib/api/maps";
import { getTsaWait }    from "@/lib/api/tsa";
import { computeLeaveTime } from "@/lib/leaveNow";
import { computeBuffer }    from "@/lib/bufferEngine";

// Straight-line km above which driving to the airport is implausible.
// E.g. Phoenix user with a JFK flight → ~3400 km → skip live drive routing.
const FAR_THRESHOLD_KM = 500;

// Convert a UTC Date to the local hour (0–23) at the given IANA timezone.
// Falls back to UTC if the timezone string is missing or unrecognised.
function localDepartureHour(date: Date, timezone: string | null): number {
  if (!timezone) return date.getUTCHours();
  try {
    const hourStr = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).format(date);
    const hour = parseInt(hourStr, 10);
    return isNaN(hour) ? date.getUTCHours() : hour % 24; // % 24 guards against "24" at midnight
  } catch {
    return date.getUTCHours();
  }
}

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────
  const client = await createSessionClient();
  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── User profile (base buffer + engine signals + home coords) ────
  const { data: userRow } = await client
    .from("users")
    .select("arrival_buffer_minutes, trip_scope, travel_stressors, home_lat, home_lng")
    .eq("id", user.id)
    .single();
  const baseBufferMinutes = userRow?.arrival_buffer_minutes ?? 20;

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

  // Guard against a malformed departure_time reaching computeLeaveTime — an
  // Invalid Date would otherwise throw on .toISOString() below and 500 the route.
  if (Number.isNaN(departureTime.getTime())) {
    console.error(`[leave-now] invalid departure_time for trip ${trip.id}: ${trip.departure_time}`);
    return Response.json({ error: "This trip has an invalid departure time" }, { status: 422 });
  }

  // Prefer live GPS coords; fall back to saved home location from profile.
  // When neither is available, drive time cannot be computed honestly.
  const hasGpsCoords  = typeof lat === "number" && typeof lng === "number";
  const hasHomeCoords = typeof userRow?.home_lat === "number" && typeof userRow?.home_lng === "number";
  const originLat     = hasGpsCoords ? lat! : hasHomeCoords ? userRow!.home_lat! : undefined;
  const originLng     = hasGpsCoords ? lng! : hasHomeCoords ? userRow!.home_lng! : undefined;
  const hasOrigin     = originLat !== undefined;
  const originSource: "gps" | "home" | "none" =
    hasGpsCoords ? "gps" : hasHomeCoords ? "home" : "none";

  // Everything below calls fallible external dependencies (Maps, TSA) and pure
  // math on their results. getDriveTime/getTsaWait already degrade internally
  // and never throw, but this is a last-resort net so a truly unexpected error
  // still returns a clean, clearly-labeled JSON error instead of a bare 500.
  try {
    // ── Rules-based buffer ──────────────────────────────────────────
    const bufferResult = computeBuffer({
      baseBufferMinutes,
      departureHour:   localDepartureHour(departureTime, trip.departure_timezone ?? null),
      airportIata,
      tripScope:       userRow?.trip_scope       ?? null,
      travelStressors: userRow?.travel_stressors ?? null,
    });

    // ── Straight-line distance check ────────────────────────────────
    // Prevents routing a user to an airport hundreds of kilometres away,
    // which would return a correct but useless multi-day drive time.
    const distanceKm: number | null =
      hasOrigin && airportIata
        ? distanceToAirportKm(originLat!, originLng!, airportIata)
        : null;

    const isFarFromAirport =
      distanceKm !== null && distanceKm > FAR_THRESHOLD_KM;

    // Route via Maps only when: origin known + airport known + not far away.
    const canRoute = hasOrigin && !!airportIata && !isFarFromAirport;

    // Drive is unavailable when: no usable origin, or origin is far from the airport.
    const driveUnavailable = originSource === "none" || isFarFromAirport;

    // ── Fetch drive + TSA concurrently ──────────────────────────────
    const [driveResult, tsaResult] = await Promise.all([
      canRoute
        ? getDriveTime(originLat!, originLng!, airportIata!)
        : Promise.resolve({ durationMinutes: 45, isLive: false }),
      getTsaWait(airportIata ?? "JFK"),
    ]);

    // Exclude drive time when unavailable — don't inject a fake number.
    const effectiveDriveMinutes = driveUnavailable ? 0 : driveResult.durationMinutes;

    // ── Compute leave time ──────────────────────────────────────────
    const result = computeLeaveTime({
      departureTime,
      driveMinutes:      effectiveDriveMinutes,
      tsaMinutes:        tsaResult.waitMinutes,
      userBufferMinutes: bufferResult.bufferMinutes,
    });

    // ── Log prediction (fire-and-forget — never blocks the response) ─
    // Upserts on trip_id: recomputing Leave Now for the same trip refreshes the one
    // prediction row instead of accumulating duplicates. actual_buffer_minutes is
    // intentionally omitted here so a previously backfilled value is never overwritten.
    // Backfill path: backfillActualBuffer() in lib/agent/learning.ts, called from
    // runPostTripLearning after the trip completes.
    client
      .from("trip_predictions")
      .upsert(
        {
          trip_id:                  trip.id,
          user_id:                  user.id,
          predicted_buffer_minutes: bufferResult.bufferMinutes,
          rule_factors:             bufferResult.factors,
          updated_at:               new Date().toISOString(),
          // actual_buffer_minutes omitted — DB null on first insert, preserved on conflict
        },
        { onConflict: "trip_id" },
      )
      .then(
        ({ error }) => {
          if (error) {
            console.error(
              `[leave-now] prediction upsert failed — trip_id=${trip.id} user_id=${user.id}:`,
              error.message,
              error.details ?? "",
            );
          }
        },
        (err: unknown) => {
          console.error(
            `[leave-now] prediction upsert threw — trip_id=${trip.id} user_id=${user.id}:`,
            err instanceof Error ? err.message : String(err),
          );
        },
      );

    // ── Build drive note ────────────────────────────────────────────
    let driveNote: string | undefined;
    if (originSource === "none") {
      driveNote = "Share your location or set a home address in Settings for real drive time";
    } else if (isFarFromAirport && airportIata) {
      driveNote = `You appear to be ${Math.round(distanceKm!)} km from ${airportIata} — drive time not factored in`;
    } else if (originSource === "home") {
      driveNote = "Using your saved home address as starting point";
    }

    return Response.json({
      recommendedLeaveTime: result.recommendedLeaveTime.toISOString(),
      minutesUntilLeave:    result.minutesUntilLeave,
      status:               result.status,
      segments:             result.segments,
      inputs: {
        drive: {
          minutes:     effectiveDriveMinutes,
          isLive:      driveUnavailable ? false : driveResult.isLive,
          unavailable: driveUnavailable || undefined,
          distanceKm:  distanceKm !== null ? Math.round(distanceKm) : undefined,
          source:      originSource,
          note:        driveNote,
        },
        tsa: {
          minutes: tsaResult.waitMinutes,
          source:  tsaResult.source,
          note:    tsaResult.note,
        },
        walkToGate: { minutes: 15 },
        buffer: {
          minutes: bufferResult.bufferMinutes,
          factors: bufferResult.factors,
        },
      },
    });
  } catch (err) {
    console.error(
      `[leave-now] unexpected error computing leave time — trip_id=${trip.id} user_id=${user.id}:`,
      err instanceof Error ? err.message : String(err),
    );
    return Response.json(
      { error: "Could not compute leave time right now — please try again" },
      { status: 500 },
    );
  }
}
