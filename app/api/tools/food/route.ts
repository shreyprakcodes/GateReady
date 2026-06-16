import { NextRequest, NextResponse } from "next/server";
import { getFoodStops } from "@/lib/api/places";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin              = searchParams.get("origin")              ?? "";
  const destination         = searchParams.get("destination")         ?? "";
  const preferences         = searchParams.get("preferences")         ?? "coffee breakfast";
  const max_detour_minutes  = Number(searchParams.get("max_detour_minutes") ?? "10");

  const result = await getFoodStops({ origin, destination, preferences, max_detour_minutes });
  return NextResponse.json(result);
}
