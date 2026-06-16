import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Called after signup to create the public.users row for the new auth user.
export async function POST(request: NextRequest) {
  const { userId, email, name } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("users")
    .upsert(
      { id: userId, email: email ?? null, name: name ?? null },
      { onConflict: "id", ignoreDuplicates: true }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
