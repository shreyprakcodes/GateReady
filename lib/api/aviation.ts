const AVIATIONSTACK_KEY = process.env.AVIATIONSTACK_API_KEY;

export interface FlightStatus {
  status: string;
  gate: string;
  terminal: string;
  delay_minutes: number;
  scheduled_departure: string;
  boarding_time: string;
  aircraft: string;
  airline: string | null;
  origin: string | null;
  destination: string | null;
  departure_timezone: string | null;
}

function deriveBoardingTime(scheduledDeparture: string): string {
  // Boarding typically opens 30 min before departure
  return new Date(new Date(scheduledDeparture).getTime() - 30 * 60 * 1000).toISOString();
}

function getMock(flight_number: string): FlightStatus {
  const base = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  return {
    status: "scheduled",
    gate: "TBD",
    terminal: "TBD",
    delay_minutes: 0,
    scheduled_departure: base,
    boarding_time: deriveBoardingTime(base),
    aircraft: "Unknown",
    airline: null,
    origin: null,
    destination: null,
    departure_timezone: null,
  };
}

export async function getFlightStatus({
  flight_number,
  date,
}: {
  flight_number: string;
  date: string;
}): Promise<FlightStatus> {
  if (!AVIATIONSTACK_KEY) {
    console.warn("[aviation] No API key — using mock data");
    return getMock(flight_number);
  }

  try {
    // Note: flight_date filtering requires a paid AviationStack plan.
    // Free tier returns the current/next scheduled flight for the IATA code.
    const url = `https://api.aviationstack.com/v1/flights?access_key=${AVIATIONSTACK_KEY}&flight_iata=${encodeURIComponent(flight_number)}`;
    console.log(`[aviation] GET ${url.replace(AVIATIONSTACK_KEY, "***")}`);

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[aviation] ${res.status} — falling back to mock`);
      return getMock(flight_number);
    }

    const json = await res.json();
    console.log("[aviation] raw response:", JSON.stringify(json?.data?.[0] ?? {}, null, 2));

    const flight = json?.data?.[0];
    if (!flight) {
      console.warn("[aviation] No flight data returned — falling back to mock");
      return getMock(flight_number);
    }

    const scheduledDeparture =
      flight.departure?.scheduled ?? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    return {
      status:               flight.flight_status ?? "scheduled",
      gate:                 flight.departure?.gate ?? "TBD",
      terminal:             flight.departure?.terminal ?? "TBD",
      delay_minutes:        flight.departure?.delay ?? 0,
      scheduled_departure:  scheduledDeparture,
      boarding_time:        deriveBoardingTime(
        flight.departure?.estimated ?? scheduledDeparture
      ),
      aircraft:             flight.aircraft?.iata ?? "Unknown",
      airline:              flight.airline?.name ?? null,
      origin:               flight.departure?.iata ?? null,
      destination:          flight.arrival?.iata ?? null,
      departure_timezone:   flight.departure?.timezone ?? null,
    };
  } catch (err) {
    console.error("[aviation] fetch error:", err);
    return getMock(flight_number);
  }
}
