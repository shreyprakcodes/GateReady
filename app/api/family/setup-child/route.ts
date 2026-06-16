import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";
import type { ParentalSettings } from "@/lib/supabase/types";

export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: {
    tripId: string;
    childUserId: string;
    settings: ParentalSettings;
  } = await request.json();

  const { tripId, childUserId, settings } = body;
  if (!tripId || !childUserId) {
    return NextResponse.json({ error: "tripId and childUserId are required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify parent has an active family_link to the child
  const { data: link } = await supabase
    .from("family_links")
    .select("id")
    .eq("user_id", user.id)
    .eq("family_member_id", childUserId)
    .eq("active", true)
    .single();

  if (!link) {
    return NextResponse.json({ error: "No active family link found" }, { status: 403 });
  }

  // Verify the trip belongs to the child
  const { data: trip } = await supabase
    .from("trips")
    .select("id, user_id")
    .eq("id", tripId)
    .single();

  if (!trip || trip.user_id !== childUserId) {
    return NextResponse.json({ error: "Trip not found or does not belong to this family member" }, { status: 404 });
  }

  const validatedSettings: ParentalSettings = {
    dnd_vendors: Boolean(settings.dnd_vendors),
    alert_window_minutes: Number(settings.alert_window_minutes) || 30,
    emergency_contact_name: String(settings.emergency_contact_name ?? ""),
    emergency_contact_phone: String(settings.emergency_contact_phone ?? ""),
  };

  const { error } = await supabase
    .from("trips")
    .update({
      parental_mode: true,
      parent_id: user.id,
      parental_settings: validatedSettings,
    })
    .eq("id", tripId);

  if (error) {
    console.error("[setup-child] update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tripId } = await request.json();
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const supabase = createServiceClient();

  // Only the parent who set up the mode can remove it
  const { error } = await supabase
    .from("trips")
    .update({ parental_mode: false, parent_id: null, parental_settings: {} })
    .eq("id", tripId)
    .eq("parent_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
