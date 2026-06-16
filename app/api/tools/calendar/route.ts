import { NextRequest, NextResponse } from "next/server";
import { getEvents } from "@/lib/api/calendar";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get("user_id") ?? "";
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const result = await getEvents({ user_id, date });
  return NextResponse.json(result);
}
