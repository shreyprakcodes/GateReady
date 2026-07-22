import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createSessionClient } from "@/lib/supabase/server";

const CLIENT_ID     = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const REDIRECT_URI  = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/auth/google/callback`;

export const STATE_COOKIE = "gcal_oauth_state";

export async function GET(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  if (!CLIENT_ID) {
    return NextResponse.json({ error: "GOOGLE_CALENDAR_CLIENT_ID not configured" }, { status: 500 });
  }

  // Unpredictable, single-use nonce — bound to this browser via a cookie,
  // not to a userId. The callback re-derives identity from the session.
  const nonce = randomBytes(32).toString("base64url");

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/calendar.events",
    access_type:   "offline",
    prompt:        "consent",
    state:         nonce,
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production", // keep http://localhost working in dev
    sameSite: "lax", // REQUIRED — "strict" drops the cookie on Google's cross-site redirect back
    maxAge:   600,   // 10 min
    path:     "/api/auth/google",
  });
  return res;
}
