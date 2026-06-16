import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";

const CLIENT_ID     = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

async function refreshIfNeeded(tokens: { access_token: string; refresh_token?: string; expires_at: number }, userId: string, supabase: ReturnType<typeof createServiceClient>): Promise<string | null> {
  if (Date.now() < tokens.expires_at - 60_000) return tokens.access_token;
  if (!CLIENT_ID || !CLIENT_SECRET || !tokens.refresh_token) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: tokens.refresh_token,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const fresh = json.access_token ?? null;
  if (fresh) {
    await supabase.from("user_preferences").update({
      value: { ...tokens, access_token: fresh, expires_at: Date.now() + 3600_000 },
      last_updated: new Date().toISOString(),
    }).eq("user_id", userId).eq("key", "google_calendar_tokens");
  }
  return fresh;
}

function createGcalEvent(token: string, event: object) {
  return fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
}

function subMin(d: Date, m: number) { return new Date(d.getTime() - m * 60_000); }
function addMin(d: Date, m: number) { return new Date(d.getTime() + m * 60_000); }
function prevDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); }
function setTime(d: Date, h: number, m: number): Date {
  const n = new Date(d);
  n.setHours(h, m, 0, 0);
  return n;
}

export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tripId } = await request.json();
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const supabase = createServiceClient();

  const [{ data: tokenPref }, { data: trip }] = await Promise.all([
    supabase.from("user_preferences").select("value").eq("user_id", user.id).eq("key", "google_calendar_tokens").single(),
    supabase.from("trips").select("*").eq("id", tripId).single(),
  ]);

  if (!tokenPref?.value) {
    return NextResponse.json({ error: "Connect Google Calendar in Preferences first." }, { status: 400 });
  }
  if (!trip?.departure_time) {
    return NextResponse.json({ error: "Trip has no departure time" }, { status: 400 });
  }

  const tokens = tokenPref.value as { access_token: string; refresh_token?: string; expires_at: number };
  const accessToken = await refreshIfNeeded(tokens, user.id, supabase);
  if (!accessToken) {
    return NextResponse.json({ error: "Google Calendar auth expired. Reconnect in Preferences." }, { status: 401 });
  }

  const dep      = new Date(trip.departure_time);
  const boarding = trip.boarding_time ? new Date(trip.boarding_time) : subMin(dep, 30);
  const flightId = `${trip.airline ?? ""} ${trip.flight_number ?? "—"}`;
  const routeStr = `${trip.origin ?? "?"} → ${trip.destination ?? "?"}`;
  const gateStr  = trip.gate ? `Gate ${trip.gate}` : "Check departures";
  const termStr  = trip.terminal ? `Terminal ${trip.terminal}` : "";
  const seatStr  = trip.seat ? `Seat ${trip.seat}` : "";

  // Calculated schedule times (working backwards from departure)
  const atGate      = subMin(dep, 15);
  const gateWalk    = subMin(atGate, 6);
  const tsaStart    = subMin(gateWalk, 15);
  const bagDrop     = subMin(tsaStart, 10);
  const arriveAirport = subMin(bagDrop, 5);
  const leaveHome   = subMin(arriveAirport, 45);
  const wakeUp      = subMin(leaveHome, 90);
  const nightBefore = prevDay(dep);
  const packTime    = setTime(nightBefore, 21, 0);
  const bedTime     = setTime(nightBefore, 22, 0);

  const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ev = (summary: string, description: string, start: Date, end: Date, colorId: string) => ({
    summary,
    description,
    colorId,
    start: { dateTime: start.toISOString(), timeZone: z },
    end:   { dateTime: end.toISOString(),   timeZone: z },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
  });

  const schedule = [
    // Night before
    ev("📦 Pack your bags — GateReady",   `${flightId} departs tomorrow. Check ID, passport, and chargers.`, packTime, addMin(packTime, 30), "3"),
    ev("🛏️ Recommended bedtime",          `Wake up at ${wakeUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} for ${flightId}.`, bedTime, addMin(bedTime, 30), "8"),
    // Travel day
    ev("⏰ Wake up — GateReady",           `${flightId} · ${routeStr}. Leave by ${leaveHome.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`, wakeUp, addMin(wakeUp, 30), "7"),
    ev("🚗 Uber/drive to airport",         `To ${trip.origin ?? "airport"} ${termStr}. ~45 min drive.`, leaveHome, addMin(leaveHome, 45), "5"),
    ev("🧳 Arrive + bag drop",             `${trip.origin ?? "airport"} ${termStr}. Have ID and booking code ready.`, arriveAirport, bagDrop, "4"),
    ev("🛂 TSA Security",                  `${termStr}. ~15 min wait expected.`, tsaStart, gateWalk, "4"),
    ev(`🚶 Walk to ${gateStr}`,            `${gateStr}${termStr ? ` · ${termStr}` : ""} · ~6 min walk.`, gateWalk, atGate, "4"),
    ev("🪑 At gate — buffer time",         `${gateStr}. 15 min before boarding. Grab a snack or coffee.`, atGate, boarding, "7"),
    ev("🎫 Boarding opens",                `Board ${flightId}${seatStr ? ` · ${seatStr}` : ""}.`, boarding, dep, "7"),
    ev(`✈️ ${flightId} · ${routeStr}`,    `${gateStr}${termStr ? `, ${termStr}` : ""}${seatStr ? ` · ${seatStr}` : ""}`, dep, addMin(dep, 480), "9"),
  ];

  const results = await Promise.all(schedule.map((e) => createGcalEvent(accessToken, e)));
  const created = results.filter((r) => r.ok).length;

  return NextResponse.json({ ok: true, created, total: schedule.length });
}
