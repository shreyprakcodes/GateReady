import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

const CLIENT_ID     = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const REDIRECT_URI  = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/auth/google/callback`;

export async function GET(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  if (!CLIENT_ID) {
    return NextResponse.json({ error: "GOOGLE_CALENDAR_CLIENT_ID not configured" }, { status: 500 });
  }

  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString("base64url");

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/calendar.events",
    access_type:   "offline",
    prompt:        "consent",
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
