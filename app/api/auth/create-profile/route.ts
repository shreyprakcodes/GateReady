import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createSessionClient } from "@/lib/supabase/server";

// Called after signup to create the public.users row for the new auth user.
export async function POST(request: NextRequest) {
  // Identity is derived from the session — never trust a client-supplied userId.
  const sessionClient = await createSessionClient();
  const { data: { user }, error: authErr } = await sessionClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await request.json();

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("users")
    .upsert(
      { id: user.id, email: user.email ?? null, name: name ?? null },
      { onConflict: "id", ignoreDuplicates: true }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
