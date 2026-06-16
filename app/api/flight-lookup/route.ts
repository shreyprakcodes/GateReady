import { NextRequest, NextResponse } from "next/server";

const AIRLINE_NAMES: Record<string, string> = {
  AA: "American Airlines", DL: "Delta Air Lines",   UA: "United Airlines",
  WN: "Southwest Airlines", B6: "JetBlue Airways",  AS: "Alaska Airlines",
  NK: "Spirit Airlines",   F9: "Frontier Airlines",  G4: "Allegiant Air",
  HA: "Hawaiian Airlines", SY: "Sun Country",        AC: "Air Canada",
};

// Mock route data — will be replaced with FlightAware API
const MOCK_ROUTES: Record<string, { origin: string; destination: string; deptHour: number; arrHour: number; terminal: string; gate: string }> = {
  AA: { origin: "PHX", destination: "JFK", deptHour: 8,  arrHour: 16, terminal: "4",  gate: "B12" },
  DL: { origin: "ATL", destination: "LAX", deptHour: 9,  arrHour: 12, terminal: "A",  gate: "A22" },
  UA: { origin: "ORD", destination: "SFO", deptHour: 11, arrHour: 14, terminal: "1",  gate: "C18" },
  WN: { origin: "PHX", destination: "LAS", deptHour: 7,  arrHour: 8,  terminal: "4",  gate: "A5"  },
  B6: { origin: "JFK", destination: "BOS", deptHour: 14, arrHour: 15, terminal: "5",  gate: "D4"  },
};

export async function GET(request: NextRequest) {
  const flight = request.nextUrl.searchParams.get("flight")?.toUpperCase().trim() ?? "";
  const date   = request.nextUrl.searchParams.get("date") ?? "";

  if (!flight || !date) {
    return NextResponse.json({ error: "flight and date are required" }, { status: 400 });
  }

  const match = flight.match(/^([A-Z]{2,3})(\d{1,4})$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid format — expected e.g. AA1234 or UAL456" }, { status: 400 });
  }

  const [, code] = match;
  const route = MOCK_ROUTES[code] ?? MOCK_ROUTES["AA"];
  const airlineName = AIRLINE_NAMES[code] ?? code;

  const deptISO = `${date}T${String(route.deptHour).padStart(2, "0")}:30:00`;
  const arrISO  = `${date}T${String(route.arrHour).padStart(2, "0")}:00:00`;
  const deptH   = route.deptHour;
  const arrH    = route.arrHour + (route.arrHour < route.deptHour ? 24 : 0);
  const durationH = Math.floor((arrH - deptH));
  const durationM = 30;

  return NextResponse.json({
    flightNumber:    flight,
    airline:         code,
    airlineName,
    origin:          route.origin,
    destination:     route.destination,
    departureTime:   deptISO,
    arrivalTime:     arrISO,
    terminal:        route.terminal,
    gate:            route.gate,
    status:          "scheduled",
    duration:        `${durationH}h ${durationM}m`,
    // Stub flag — front-end can show "mock data" notice
    isMock:          true,
  });
}
