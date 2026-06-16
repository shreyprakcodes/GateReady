import { NextRequest, NextResponse } from "next/server";
import { getEstimate } from "@/lib/api/uber";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { origin, destination, service_types = ["UberX"] } = body;

  const result = await getEstimate({ origin, destination, service_types });
  return NextResponse.json(result);
}
