import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Plane, ArrowLeft } from "lucide-react";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";
import { FlightCard } from "@/components/dashboard/FlightCard";
import { LiveStrip } from "@/components/dashboard/LiveStrip";
import { DepartureWindow } from "@/components/dashboard/DepartureWindow";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { BottomNav } from "@/components/dashboard/BottomNav";
import { FlightWidget } from "@/components/widget/FlightWidget";
import { ProfilePanel } from "@/src/components/ProfilePanel";
import { GreetingText } from "@/components/dashboard/GreetingText";
import { LocationPermissionBanner } from "@/src/components/LocationPermissionBanner";
import { LocationLiveChip } from "@/src/components/LocationLiveChip";

function fmtDate(d: Date) {
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function extractFirstName(_email: string | undefined, metadata: Record<string, string> | null): string {
  if (metadata?.full_name) return metadata.full_name.split(" ")[0];
  if (metadata?.name)      return metadata.name.split(" ")[0];
  return "Traveler";
}

export default async function DashboardPage() {
  const sessionClient = await createSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) redirect("/login");

  const supabase = createServiceClient();

  // Redirect new users to onboarding before showing the dashboard
  const { data: userRow } = await supabase
    .from("users")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();
  if (userRow && userRow.onboarding_completed === false) redirect("/onboarding");

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: steps } = await supabase
    .from("itinerary_steps")
    .select("*")
    .eq("trip_id", trip?.id ?? "")
    .order("position", { ascending: true });

  const { data: windowPref } = await supabase
    .from("user_preferences")
    .select("value")
    .eq("user_id", user.id)
    .eq("key", "departure_window")
    .single();

  const departureWindow = windowPref?.value as {
    comfortable: string;
    tight: string;
    cutoff: string;
  } | null;

  const firstName = extractFirstName(
    user.email ?? undefined,
    user.user_metadata as Record<string, string> | null,
  );

  return (
    <>
      <main className="flex flex-col min-h-screen max-w-md mx-auto px-4 pt-6 pb-28 gap-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/dashboard"
              className="mt-1 p-2 rounded-xl shrink-0"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", color: "#6B7280" }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1
                className="text-2xl font-bold"
                style={{ color: "#1A1A2E" }}
              >
                <GreetingText name={firstName} />
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs font-medium" style={{ color: "#9CA3AF" }}>
                  {fmtDate(new Date())}
                </p>
                <LocationLiveChip />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <ProfilePanel userEmail={user.email ?? undefined} />
          </div>
        </div>

        {/* Location permission banner */}
        <LocationPermissionBanner />

        {/* Alert banner */}
        {trip && <AlertBanner userId={user.id} tripId={trip.id} />}

        {/* Flight card or empty state */}
        {trip ? (
          <FlightCard trip={trip} />
        ) : (
          <div
            className="rounded-3xl p-8 text-center"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1.5px dashed #E5E1D8",
              boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: "rgba(79,70,229,0.08)", border: "1px solid rgba(79,70,229,0.15)" }}
            >
              <Plane className="h-6 w-6 rotate-90" style={{ color: "#4F46E5" }} />
            </div>
            <p className="text-sm font-bold mb-1" style={{ color: "#1A1A2E" }}>No upcoming trips</p>
            <p className="text-xs mb-5" style={{ color: "#9CA3AF" }}>Add a flight to get started</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold"
              style={{ backgroundColor: "#4F46E5", color: "#FFFFFF" }}
            >
              <Plus className="h-4 w-4" />
              Add a flight
            </Link>
          </div>
        )}

        {/* Live metrics */}
        {trip && <LiveStrip tripId={trip.id} initialSteps={steps ?? []} />}

        {/* Departure window */}
        <DepartureWindow
          departureWindow={departureWindow}
          boardingTime={trip?.boarding_time ?? null}
          departureTz={trip?.departure_timezone ?? null}
        />

        {/* Live flight widget */}
        {trip && (
          <FlightWidget
            flightNumber={trip.flight_number ?? undefined}
            origin={trip.origin ?? undefined}
            destination={trip.destination ?? undefined}
            departureTime={trip.departure_time ?? undefined}
            departureTimezone={trip.departure_timezone ?? null}
            compact
          />
        )}

        {/* Quick actions */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#9CA3AF" }}>
            Quick Actions
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/agent",         label: "Ask GateReady",   sub: "AI travel assistant",    dot: "#4F46E5" },
              { href: "/itinerary",     label: "Itinerary",        sub: "Step-by-step plan",      dot: "#10B981" },
              { href: "/routes",        label: "Route Planner",    sub: "Live traffic + Uber",    dot: "#F59E0B" },
              { href: "/flight-status", label: "Track Flight",     sub: "Live status + progress", dot: "#4F46E5" },
              { href: "/tsa",           label: "TSA Wait Times",   sub: "All lanes, live data",   dot: "#10B981" },
              { href: "/food",          label: "Food Stops",       sub: "En route + at airport",  dot: "#F59E0B" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl p-4 transition-all active:scale-[0.97]"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E1D8",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div className="w-1.5 h-4 rounded-full mb-3" style={{ backgroundColor: item.dot }} />
                <p className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>
                  {item.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
                  {item.sub}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
