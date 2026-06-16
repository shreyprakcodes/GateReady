const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

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
