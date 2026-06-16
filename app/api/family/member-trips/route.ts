import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = request.nextUrl.searchParams.get("memberId");
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

  const supabase = createServiceClient();

  // Verify active family link
  const { data: link } = await supabase
    .from("family_links")
    .select("id")
    .eq("user_id", user.id)
    .eq("family_member_id", memberId)
    .eq("active", true)
    .single();

  if (!link) {
    return NextResponse.json({ error: "No active family link" }, { status: 403 });
  }

  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, flight_number, airline, origin, destination, departure_time, status, parental_mode, parental_settings")
    .eq("user_id", memberId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ trips: trips ?? [] });
}
