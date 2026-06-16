import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const sessionClient = await createSessionClient();
  const { data: { user }, error: authErr } = await sessionClient.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  const supabase = createServiceClient();

  // Look up the target user
  const { data: target } = await supabase
    .from("users")
    .select("id, email")
    .eq("email", email)
    .single();

  if (!target) {
    // User not found — return success anyway (don't reveal user existence)
    return NextResponse.json({ ok: true, message: "Invite sent if account exists" });
  }

  // Create the family link
  const { error } = await supabase
    .from("family_links")
    .upsert(
      { user_id: user.id, family_member_id: target.id, permissions: ["view_trip"], active: true },
      { onConflict: "user_id,family_member_id", ignoreDuplicates: false }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
