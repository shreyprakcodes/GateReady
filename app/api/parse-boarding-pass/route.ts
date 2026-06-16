import { NextResponse } from "next/server";

// Stub — boarding pass OCR/parsing will be wired to a vision model in a future sprint.
export async function POST() {
  return NextResponse.json({
    status: "coming_soon",
    message: "Boarding pass scanning is coming soon.",
  });
}
