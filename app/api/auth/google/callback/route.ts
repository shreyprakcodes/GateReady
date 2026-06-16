import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const CLIENT_ID     = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const REDIRECT_URI  = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/auth/google/callback`;

export async function GET(request: NextRequest) {
  const code    = request.nextUrl.searchParams.get("code");
  const state   = request.nextUrl.searchParams.get("state");
  const errParam = request.nextUrl.searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (errParam) {
    return NextResponse.redirect(`${baseUrl}/preferences?calendar_error=${encodeURIComponent(errParam)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/preferences?calendar_error=missing_params`);
  }

  let userId: string;
  try {
    userId = JSON.parse(Buffer.from(state, "base64url").toString()).userId;
  } catch {
    return NextResponse.redirect(`${baseUrl}/preferences?calendar_error=invalid_state`);
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.redirect(`${baseUrl}/preferences?calendar_error=not_configured`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json();
    console.error("[google/callback] token exchange error:", err);
    return NextResponse.redirect(`${baseUrl}/preferences?calendar_error=token_exchange`);
  }

  const tokens: { access_token: string; refresh_token?: string; expires_in: number } = await tokenRes.json();

  const supabase = createServiceClient();

  // Store tokens in user_preferences
  await supabase.from("user_preferences").upsert({
    user_id: userId,
    key: "google_calendar_tokens",
    value: {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at:    Date.now() + tokens.expires_in * 1000,
    },
    confidence_score: 1,
    source: "oauth",
    times_observed: 1,
    last_updated: new Date().toISOString(),
  }, { onConflict: "user_id, key" });

  return NextResponse.redirect(`${baseUrl}/preferences?calendar_connected=true`);
}
