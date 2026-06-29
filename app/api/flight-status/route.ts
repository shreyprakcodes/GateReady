import { NextRequest, NextResponse } from "next/server";

const AVIATIONSTACK_KEY = process.env.AVIATIONSTACK_API_KEY;

export interface FlightStatusData {
  flightNumber: string;
  airline: string | null;
  status: "scheduled" | "active" | "landed" | "cancelled" | "delayed" | "diverted" | "unknown";
  depAirport: string | null;
  depIata: string | null;
  depTerminal: string | null;
  depGate: string | null;
  depScheduled: string | null;
  depEstimated: string | null;
  depActual: string | null;
  arrAirport: string | null;
  arrIata: string | null;
  arrTerminal: string | null;
  arrGate: string | null;
  arrScheduled: string | null;
  arrEstimated: string | null;
  arrActual: string | null;
  aircraft: string | null;
  delayMinutes: number | null;
  depTimezone: string | null;
  arrTimezone: string | null;
  live: { lat: number; lng: number; altitude: number; speed: number } | null;
}

function normalizeStatus(raw: string | null): FlightStatusData["status"] {
  switch ((raw ?? "").toLowerCase()) {
    case "active":    return "active";
    case "landed":    return "landed";
    case "cancelled": return "cancelled";
    case "diverted":  return "diverted";
    case "delayed":   return "delayed";
    case "scheduled": return "scheduled";
    default:          return "unknown";
  }
}

export async function GET(request: NextRequest) {
  const flightIata = request.nextUrl.searchParams.get("flight");
  if (!flightIata) {
    return NextResponse.json({ error: "flight param required" }, { status: 400 });
  }

  if (!AVIATIONSTACK_KEY) {
    return NextResponse.json({ error: "AVIATIONSTACK_API_KEY not configured" }, { status: 500 });
  }

  try {
    const url = `https://api.aviationstack.com/v1/flights?access_key=${AVIATIONSTACK_KEY}&flight_iata=${encodeURIComponent(flightIata)}&limit=1`;
    const res = await fetch(url, { next: { revalidate: 0 } });

    if (!res.ok) {
      throw new Error(`AviationStack HTTP ${res.status}`);
    }

    const json = await res.json();

    if (json.error) {
      console.error("[flight-status] AviationStack error:", json.error);
      return NextResponse.json({ error: json.error.message ?? "API error" }, { status: 502 });
    }

    const flight = json.data?.[0];
    if (!flight) {
      return NextResponse.json({ error: "Flight not found" }, { status: 404 });
    }

    const dep = flight.departure ?? {};
    const arr = flight.arrival ?? {};
    const rawStatus = normalizeStatus(flight.flight_status);

    // Infer delay from scheduled vs estimated
    let delayMinutes: number | null = null;
    const depSched = dep.scheduled ? new Date(dep.scheduled) : null;
    const depEst   = dep.estimated ? new Date(dep.estimated) : null;
    if (depSched && depEst) {
      const diff = Math.round((depEst.getTime() - depSched.getTime()) / 60000);
      if (diff > 0) delayMinutes = diff;
    }

    const statusToReturn: FlightStatusData["status"] =
      rawStatus === "scheduled" && delayMinutes && delayMinutes > 5
        ? "delayed"
        : rawStatus;

    const data: FlightStatusData = {
      flightNumber: flight.flight?.iata ?? flightIata,
      airline: flight.airline?.name ?? null,
      status: statusToReturn,
      depAirport: dep.airport ?? null,
      depIata: dep.iata ?? null,
      depTerminal: dep.terminal ?? null,
      depGate: dep.gate ?? null,
      depScheduled: dep.scheduled ?? null,
      depEstimated: dep.estimated ?? null,
      depActual: dep.actual ?? null,
      arrAirport: arr.airport ?? null,
      arrIata: arr.iata ?? null,
      arrTerminal: arr.terminal ?? null,
      arrGate: arr.gate ?? null,
      arrScheduled: arr.scheduled ?? null,
      arrEstimated: arr.estimated ?? null,
      arrActual: arr.actual ?? null,
      aircraft: flight.aircraft?.iata ?? null,
      delayMinutes,
      depTimezone: dep.timezone ?? null,
      arrTimezone: arr.timezone ?? null,
      live: flight.live
        ? { lat: flight.live.latitude, lng: flight.live.longitude, altitude: flight.live.altitude, speed: flight.live.speed_horizontal }
        : null,
    };

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[flight-status]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
