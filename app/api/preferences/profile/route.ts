import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const sessionClient = await createSessionClient();
  const { data: { user }, error: authErr } = await sessionClient.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, home_address, tsa_precheck, global_entry, preferred_transport, accessibility_needs } = body;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("users")
    .update({ name, home_address, tsa_precheck, global_entry, preferred_transport, accessibility_needs })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
