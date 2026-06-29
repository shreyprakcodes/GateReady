import { type NextRequest } from "next/server";
import { lookupFlight } from "@/lib/api/aviation";

// Re-export so app/api/flights/save/route.ts keeps its existing import path.
export type { NormalizedFlight } from "@/lib/api/providers/types";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const flight = params.get("flight")?.toUpperCase().trim() ?? "";
  const date   = params.get("date") ?? "";

  if (!flight || !date) {
    return Response.json({ error: "flight and date are required" }, { status: 400 });
  }

  if (!/^[A-Z]{2,3}\d{1,4}$/.test(flight)) {
    return Response.json(
      { error: "Invalid format — expected IATA flight number e.g. AA1234" },
      { status: 400 },
    );
  }

  const { flights, source, isSample } = await lookupFlight(flight, date);

  if (flights.length === 0) {
    return Response.json(
      { error: "No flights found for that flight number and date" },
      { status: 404 },
    );
  }

  if (flights.length === 1) {
    return Response.json({ flight: flights[0], multiple: false, source, isSample });
  }

  return Response.json({ flights, multiple: true, source, isSample });
}
