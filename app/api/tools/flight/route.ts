import { NextRequest, NextResponse } from "next/server";
import { getFlightStatus } from "@/lib/api/aviation";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const flight_number = searchParams.get("flight_number") ?? "";
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const result = await getFlightStatus({ flight_number, date });
  return NextResponse.json(result);
}
