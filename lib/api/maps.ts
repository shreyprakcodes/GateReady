const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

// ── Airport coordinates ────────────────────────────────────────────
// Used to compute straight-line distance before calling the Maps API.
// Only major airports needed — unknown airports fall through to the
// Maps duration cap as a secondary guard.
const AIRPORT_COORDS: Record<string, readonly [number, number]> = {
  // North America
  JFK: [40.6413, -73.7781], EWR: [40.6895, -74.1745], LGA: [40.7773, -73.8726],
  LAX: [33.9425, -118.4081], SFO: [37.6213, -122.3790], SAN: [32.7338, -117.1933],
  ORD: [41.9742, -87.9073], MDW: [41.7868, -87.7522],
  ATL: [33.6407, -84.4277], DFW: [32.8998, -97.0403], IAH: [29.9902, -95.3368],
  PHX: [33.4373, -112.0078], DEN: [39.8561, -104.6737], LAS: [36.0840, -115.1537],
  SEA: [47.4502, -122.3088], MIA: [25.7959, -80.2870], MCO: [28.4312, -81.3081],
  BOS: [42.3656, -71.0096], PHL: [39.8729, -75.2437], CLT: [35.2140, -80.9431],
  IAD: [38.9531, -77.4565], DCA: [38.8512, -77.0402],
  MSP: [44.8848, -93.2223], DTW: [42.2124, -83.3534], MKE: [42.9472, -87.8966],
  SLC: [40.7884, -111.9778], PDX: [45.5898, -122.5951], SMF: [38.6954, -121.5908],
  HNL: [21.3245, -157.9251], ANC: [61.1743, -149.9961],
  YYZ: [43.6777, -79.6248],  YVR: [49.1947, -123.1792], YUL: [45.4706, -73.7408],
  MEX: [19.4363, -99.0721],
  // Europe
  LHR: [51.4700,  -0.4543], LGW: [51.1537,  -0.1821],
  CDG: [49.0097,   2.5479], ORY: [48.7233,   2.3794],
  AMS: [52.3105,   4.7683], FRA: [50.0379,   8.5622],
  MAD: [40.4983,  -3.5676], BCN: [41.2974,   2.0833],
  MXP: [45.6306,   8.7231], FCO: [41.8003,  12.2389],
  ZRH: [47.4647,   8.5492], VIE: [48.1103,  16.5697],
  MUC: [48.3538,  11.7861], CPH: [55.6180,  12.6508],
  ARN: [59.6519,  17.9186], HEL: [60.3172,  24.9633],
  IST: [41.2608,  28.7418],
  // Asia-Pacific
  DXB: [25.2532,  55.3657], AUH: [24.4330,  54.6511], DOH: [25.2731,  51.6081],
  NRT: [35.7720, 140.3929], HND: [35.5494, 139.7798],
  ICN: [37.4602, 126.4407], PEK: [40.0799, 116.6031], PVG: [31.1443, 121.8083],
  HKG: [22.3080, 113.9185], BKK: [13.6900, 100.7501],
  SIN: [1.3644,  103.9915], KUL: [2.7456,  101.7099],
  SYD: [-33.9399, 151.1753], MEL: [-37.6690, 144.8410], BNE: [-27.3842, 153.1175],
  // Latin America / other
  GRU: [-23.4356, -46.4731], EZE: [-34.8222, -58.5358], BOG: [4.7016,  -74.1469],
  SCL: [-33.3930, -70.7858], LIM: [-12.0219, -77.1143],
  JNB: [-26.1367,  28.2411], CAI: [30.1219,  31.4056],
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Straight-line distance (km) between a user location and an airport.
 * Returns null when the airport is not in the lookup table.
 */
export function distanceToAirportKm(
  lat: number,
  lng: number,
  airportIata: string,
): number | null {
  const coords = AIRPORT_COORDS[airportIata.toUpperCase()];
  if (!coords) return null;
  return haversineKm(lat, lng, coords[0], coords[1]);
}

// ── getDriveTime ───────────────────────────────────────────────────
// Traffic-aware drive time from a lat/lng to an airport.
// Uses departure_time=now so Google returns current traffic conditions.
//
// IMPORTANT: the caller MUST run a distance check first (distanceToAirportKm)
// and skip this call when the user is far from the airport.  This function
// adds a 300-min duration cap as a second-layer guard against cross-country
// routes that slip through (e.g. airport not in the coords table).

export interface DriveTimeResult {
  durationMinutes: number;
  isLive: boolean; // false when Maps key is absent or the call fails
}

// Sanity cap: no realistic airport-area drive exceeds 5 hours.
// Cross-country routes that reach here (airport not in coords table) get capped.
const DRIVE_CAP_MINUTES = 300;

export async function getDriveTime(
  lat: number,
  lng: number,
  airportIata: string,
): Promise<DriveTimeResult> {
  const FALLBACK: DriveTimeResult = { durationMinutes: 45, isLive: false };
  if (!MAPS_KEY) return FALLBACK;

  try {
    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${lat},${lng}` +
      `&destination=${encodeURIComponent(airportIata + " Airport")}` +
      `&departure_time=${Math.floor(Date.now() / 1000)}` +
      `&traffic_model=best_guess` +
      `&key=${MAPS_KEY}`;

    // Bounded so a hung Maps call can never stall the leave-now response —
    // the existing catch below turns the resulting AbortError into FALLBACK.
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6_000) });
    if (!res.ok) {
      console.warn(`[maps] getDriveTime HTTP ${res.status} for ${airportIata}`);
      return FALLBACK;
    }

    const json = await res.json();
    const mapsStatus = (json.status ?? "UNKNOWN") as string;

    // Log the Maps status so a bad key shows up clearly in server logs.
    if (mapsStatus !== "OK") {
      if (mapsStatus === "REQUEST_DENIED") {
        console.error("[maps] REQUEST_DENIED — check GOOGLE_MAPS_API_KEY is valid and Directions API is enabled");
      } else if (mapsStatus === "OVER_QUERY_LIMIT") {
        console.warn("[maps] OVER_QUERY_LIMIT — Maps daily quota exceeded");
      } else {
        console.warn(`[maps] Non-OK status=${mapsStatus} for ${airportIata}`);
      }
      return FALLBACK;
    }

    const leg = json?.routes?.[0]?.legs?.[0];
    if (!leg) return FALLBACK;

    // Prefer traffic-adjusted duration; fall back to raw duration.
    // Do NOT default to 2700 s — if both fields are missing the route is invalid.
    const rawSecs: number | undefined =
      leg.duration_in_traffic?.value ?? leg.duration?.value;
    if (rawSecs == null) return FALLBACK;

    const durationMinutes = Math.ceil(rawSecs / 60);

    if (durationMinutes > DRIVE_CAP_MINUTES) {
      console.warn(
        `[maps] Drive time ${durationMinutes} min to ${airportIata} exceeds ${DRIVE_CAP_MINUTES}-min cap ` +
        `— airport not in distance-check table; returning estimate`,
      );
      return FALLBACK;
    }

    console.log(`[maps] status=OK  ${airportIata}  ${durationMinutes} min (isLive=true)`);
    return { durationMinutes, isLive: true };
  } catch (err) {
    console.error("[maps] getDriveTime error:", err);
    return FALLBACK;
  }
}

export interface TrafficResult {
  duration_minutes: number;
  delay_minutes: number;
  condition: string;
  incidents: string[];
  alternate_route: string | null;
}

export interface TransitRoute {
  mode: string;
  steps: string[];
  duration: number;
  cost: string;
  transfers: number;
  reliability_score: number;
}

function mockTraffic(): TrafficResult {
  const base = 25;
  const delay = Math.floor(Math.random() * 10) - 5;
  return {
    duration_minutes: base + Math.max(0, delay),
    delay_minutes: Math.max(0, delay),
    condition: delay > 5 ? "Heavy" : delay > 0 ? "Moderate" : "Clear",
    incidents: delay > 5 ? ["Accident on I-405 N"] : [],
    alternate_route: delay > 5 ? "Take surface streets via Lincoln Blvd" : null,
  };
}

function mockTransit(): TransitRoute[] {
  return [
    {
      mode: "subway",
      steps: ["Walk 5 min to Metro station", "Blue Line — 6 stops", "Walk 8 min to terminal"],
      duration: 45,
      cost: "$1.75",
      transfers: 0,
      reliability_score: 0.88,
    },
    {
      mode: "bus",
      steps: ["Walk 3 min to bus stop", "Route 42 — 12 stops", "Walk 6 min"],
      duration: 58,
      cost: "$1.75",
      transfers: 1,
      reliability_score: 0.72,
    },
  ];
}

export async function getTraffic({
  origin,
  destination,
  departure_time,
}: {
  origin: string;
  destination: string;
  departure_time: string;
}): Promise<TrafficResult> {
  if (!MAPS_KEY || process.env.NODE_ENV === "development") {
    return mockTraffic();
  }

  try {
    const epoch = Math.floor(new Date(departure_time).getTime() / 1000);
    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${encodeURIComponent(origin)}` +
      `&destination=${encodeURIComponent(destination)}` +
      `&departure_time=${epoch}` +
      `&traffic_model=best_guess` +
      `&key=${MAPS_KEY}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Maps API ${res.status}`);
    const json = await res.json();

    const route = json?.routes?.[0]?.legs?.[0];
    if (!route) return mockTraffic();

    const durationInTraffic = Math.round((route.duration_in_traffic?.value ?? route.duration?.value ?? 0) / 60);
    const durationNormal = Math.round((route.duration?.value ?? 0) / 60);
    const delayMinutes = Math.max(0, durationInTraffic - durationNormal);

    return {
      duration_minutes: durationInTraffic,
      delay_minutes: delayMinutes,
      condition: delayMinutes > 10 ? "Heavy" : delayMinutes > 3 ? "Moderate" : "Clear",
      incidents: [],
      alternate_route: json?.routes?.[1]?.summary ?? null,
    };
  } catch {
    return mockTraffic();
  }
}

export async function getTransitOptions({
  origin,
  destination,
  departure_time,
}: {
  origin: string;
  destination: string;
  departure_time: string;
}): Promise<TransitRoute[]> {
  if (!MAPS_KEY || process.env.NODE_ENV === "development") {
    return mockTransit();
  }

  try {
    const epoch = Math.floor(new Date(departure_time).getTime() / 1000);
    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${encodeURIComponent(origin)}` +
      `&destination=${encodeURIComponent(destination)}` +
      `&mode=transit` +
      `&departure_time=${epoch}` +
      `&alternatives=true` +
      `&key=${MAPS_KEY}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Maps Transit API ${res.status}`);
    const json = await res.json();

    if (!json?.routes?.length) return mockTransit();

    return json.routes.map((route: {
      legs: Array<{
        duration: { value: number };
        steps: Array<{ html_instructions?: string; transit_details?: { line?: { vehicle?: { type?: string } } } }>;
      }>;
      fare?: { text: string };
    }) => {
      const leg = route.legs[0];
      const steps = leg.steps.map(
        (s: { html_instructions?: string }) => s.html_instructions?.replace(/<[^>]+>/g, "") ?? ""
      );
      const transfers = leg.steps.filter(
        (s: { transit_details?: unknown }) => s.transit_details
      ).length - 1;
      const mode = leg.steps.find(
        (s: { transit_details?: { line?: { vehicle?: { type?: string } } } }) => s.transit_details
      )?.transit_details?.line?.vehicle?.type ?? "transit";

      return {
        mode: mode.toLowerCase(),
        steps,
        duration: Math.round((leg.duration?.value ?? 0) / 60),
        cost: route.fare?.text ?? "Varies",
        transfers: Math.max(0, transfers),
        reliability_score: 0.8,
      };
    });
  } catch {
    return mockTransit();
  }
}
