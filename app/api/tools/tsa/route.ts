import { NextRequest, NextResponse } from "next/server";
import { getWaitTime } from "@/lib/api/tsa";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const airport = searchParams.get("airport") ?? "";
  const terminal = searchParams.get("terminal") ?? "";
  const lane_type = (searchParams.get("lane_type") ?? "standard") as
    | "standard"
    | "precheck"
    | "clear";

  const result = await getWaitTime({ airport, terminal, lane_type });
  return NextResponse.json(result);
}
