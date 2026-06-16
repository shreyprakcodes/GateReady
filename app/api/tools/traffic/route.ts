import { NextRequest, NextResponse } from "next/server";
import { getTraffic } from "@/lib/api/maps";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = searchParams.get("origin") ?? "";
  const destination = searchParams.get("destination") ?? "";
  const departure_time = searchParams.get("departure_time") ?? new Date().toISOString();

  const result = await getTraffic({ origin, destination, departure_time });
  return NextResponse.json(result);
}
