import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

// Debug-only route: accept tokens from magic link hash, set the session via SSR cookies,
// then redirect to the dashboard. Delete this file before shipping to production.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accessToken  = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
  }

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.setSession({
    access_token:  accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/", request.url));
}
