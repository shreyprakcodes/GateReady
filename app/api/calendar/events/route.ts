import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";

const CLIENT_ID     = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET || !refreshToken) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.access_token ?? null;
}

async function getValidToken(tokens: { access_token: string; refresh_token?: string; expires_at: number }, userId: string, supabase: ReturnType<typeof createServiceClient>): Promise<string | null> {
  if (Date.now() < tokens.expires_at - 60_000) return tokens.access_token;

  const fresh = await refreshAccessToken(tokens.refresh_token ?? "");
  if (!fresh) return null;

  await supabase.from("user_preferences").update({
    value: { ...tokens, access_token: fresh, expires_at: Date.now() + 3600_000 },
    last_updated: new Date().toISOString(),
  }).eq("user_id", userId).eq("key", "google_calendar_tokens");

  return fresh;
}

async function createEvent(accessToken: string, event: object): Promise<boolean> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  return res.ok;
}

function isoRange(start: Date, mins: number) {
  return {
    dateTime: start.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function subMinutes(d: Date, m: number) { return new Date(d.getTime() - m * 60_000); }

export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tripId } = await request.json();
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const supabase = createServiceClient();

  const [{ data: tokenPref }, { data: trip }, { data: profile }] = await Promise.all([
    supabase.from("user_preferences").select("value").eq("user_id", user.id).eq("key", "google_calendar_tokens").single(),
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase.from("users").select("home_address").eq("id", user.id).single(),
  ]);

  if (!tokenPref?.value) {
    return NextResponse.json({ error: "Google Calendar not connected. Connect it in Preferences." }, { status: 400 });
  }

  if (!trip?.departure_time) {
    return NextResponse.json({ error: "Trip has no departure time" }, { status: 400 });
  }

  const tokens = tokenPref.value as { access_token: string; refresh_token?: string; expires_at: number };
  const accessToken = await getValidToken(tokens, user.id, supabase);
  if (!accessToken) {
    return NextResponse.json({ error: "Google Calendar auth expired. Please reconnect." }, { status: 401 });
  }

  const depTime   = new Date(trip.departure_time);
  const wakeTime  = subMinutes(depTime, 90 + 45 + 20);  // 90min buffer + 45min traffic + 20min prep
  const leaveTime = subMinutes(depTime, 45 + 20);

  const flightLabel = `${trip.airline ?? ""} ${trip.flight_number ?? ""} · ${trip.origin} → ${trip.destination}`;
  const homeAddr    = profile?.home_address ?? "home";
  const termStr     = trip.terminal ? `Terminal ${trip.terminal}` : "";

  const events = [
    {
      summary: "⏰ Wake up — GateReady",
      description: `${flightLabel}. Leave by ${leaveTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
      colorId: "7", // teal
      start: { dateTime: wakeTime.toISOString() },
      end:   { dateTime: new Date(wakeTime.getTime() + 30 * 60_000).toISOString() },
      reminders: { useDefault: false, overrides: [] },
    },
    {
      summary: `🚗 Leave for airport — GateReady`,
      description: `Uber from ${homeAddr} to ${trip.origin ?? "airport"} ${termStr}. TSA wait ~${trip.parental_mode ? "20" : "10"} min.`,
      colorId: "5", // banana/amber
      start: { dateTime: leaveTime.toISOString() },
      end:   { dateTime: new Date(leaveTime.getTime() + 30 * 60_000).toISOString() },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 15 }],
      },
    },
    {
      summary: `✈️ ${flightLabel}`,
      description: `Gate ${trip.gate ?? "TBD"}, ${termStr}${trip.seat ? ` · Seat ${trip.seat}` : ""}`,
      colorId: "9", // blueberry
      start: { dateTime: depTime.toISOString() },
      end:   { dateTime: new Date(depTime.getTime() + 8 * 3600_000).toISOString() }, // estimate 8h flight
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 120 },
          { method: "popup", minutes: 30 },
        ],
      },
    },
  ];

  const results = await Promise.all(events.map((e) => createEvent(accessToken, e)));
  const failed  = results.filter((r) => !r).length;

  if (failed === results.length) {
    return NextResponse.json({ error: "Failed to create calendar events" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, created: results.filter(Boolean).length });
}
