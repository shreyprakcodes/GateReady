import { NextRequest, NextResponse } from "next/server";
import { getEvents } from "@/lib/api/calendar";
import { createSessionClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  // Identity is derived from the session — never trust a client-supplied user_id.
  const sessionClient = await createSessionClient();
  const { data: { user }, error: authErr } = await sessionClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const result = await getEvents({ user_id: user.id, date });
  return NextResponse.json(result);
}
