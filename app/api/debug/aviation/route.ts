import { NextResponse } from "next/server";
import { getFlightStatus } from "@/lib/api/aviation";

export async function GET() {
  const key = process.env.AVIATIONSTACK_API_KEY;
  console.log("[debug] AVIATIONSTACK_API_KEY in Next.js:", key ? `${key.slice(0, 6)}...` : "MISSING");

  const result = await getFlightStatus({ flight_number: "AA100", date: "2026-06-11" });
  console.log("[debug] getFlightStatus result:", JSON.stringify(result, null, 2));

  return NextResponse.json({
    key_present: !!key,
    key_prefix: key?.slice(0, 6) ?? null,
    result,
  });
}
