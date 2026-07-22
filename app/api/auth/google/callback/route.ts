import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient, createSessionClient } from "@/lib/supabase/server";
import { STATE_COOKIE } from "../route";

const CLIENT_ID     = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const REDIRECT_URI  = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/auth/google/callback`;

function statesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// The nonce is single-use — clear it on every response from the point we've
// read it, regardless of outcome.
function clearStateCookie(res: NextResponse): NextResponse {
  res.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/api/auth/google" });
  return res;
}

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

  // state must match a nonce we set on this same browser before it left for
  // Google — single-use, cleared below regardless of outcome.
  const cookieNonce = request.cookies.get(STATE_COOKIE)?.value;

  if (!cookieNonce) {
    return NextResponse.redirect(`${baseUrl}/preferences?calendar_error=state_missing`);
  }

  if (!statesMatch(state, cookieNonce)) {
    return clearStateCookie(
      NextResponse.redirect(`${baseUrl}/preferences?calendar_error=state_mismatch`)
    );
  }

  // Identity comes from the session — never from state.
  const sessionClient = await createSessionClient();
  const { data: { user }, error: authErr } = await sessionClient.auth.getUser();
  if (authErr || !user) {
    return clearStateCookie(NextResponse.redirect(`${baseUrl}/login`));
  }
  const userId = user.id;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return clearStateCookie(
      NextResponse.redirect(`${baseUrl}/preferences?calendar_error=not_configured`)
    );
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
    return clearStateCookie(
      NextResponse.redirect(`${baseUrl}/preferences?calendar_error=token_exchange`)
    );
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

  return clearStateCookie(
    NextResponse.redirect(`${baseUrl}/preferences?calendar_connected=true`)
  );
}
