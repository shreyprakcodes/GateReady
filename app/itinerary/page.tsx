import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";
import { ItineraryClient } from "./ItineraryClient";
import { ChildView } from "@/components/child/ChildView";
import { BottomNav } from "@/components/dashboard/BottomNav";

export default async function ItineraryPage() {
  const sessionClient = await createSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) redirect("/login");

  const supabase = createServiceClient();

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

  // Child simplified view
  if (trip?.parental_mode) {
    return <ChildView trip={trip} steps={steps ?? []} userId={user.id} />;
  }

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

  return (
    <>
      <main className="flex flex-col min-h-screen max-w-md mx-auto px-4 pt-6 pb-28">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="p-2 rounded-xl transition-all"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", color: "#6B7280" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: "#1A1A2E" }}>
              Itinerary
            </h1>
            {trip && (
              <p className="text-xs font-medium mt-0.5" style={{ color: "#9CA3AF" }}>
                {trip.flight_number} · {trip.origin} → {trip.destination}
              </p>
            )}
          </div>
        </div>

        {departureWindow && <DepWindowBar departureWindow={departureWindow} />}

        <ItineraryClient
          tripId={trip?.id ?? ""}
          userId={user.id}
          initialSteps={steps ?? []}
        />
      </main>

      <BottomNav />
    </>
  );
}

function DepWindowBar({ departureWindow }: {
  departureWindow: { comfortable: string; tight: string; cutoff: string }
}) {
  const now   = Date.now();
  const state =
    now <= new Date(departureWindow.comfortable).getTime() ? "comfortable" :
    now <= new Date(departureWindow.tight).getTime()       ? "tight"       : "cutting";

  const meta = {
    comfortable: { label: "Leave time: Comfortable",      color: "#10B981", bg: "rgba(16,185,129,0.06)" },
    tight:       { label: "Leave time: Getting tight",    color: "#F59E0B", bg: "rgba(245,158,11,0.06)" },
    cutting:     { label: "Leave time: Cutting it close", color: "#EF4444", bg: "rgba(239,68,68,0.06)" },
  }[state];

  function fmt(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center justify-between mb-5"
      style={{ backgroundColor: meta.bg, border: `1px solid ${meta.color}33` }}
    >
      <p className="text-xs font-semibold" style={{ color: meta.color }}>
        {meta.label}
      </p>
      <p className="text-xs font-bold" style={{ color: meta.color }}>
        {state === "comfortable"
          ? fmt(departureWindow.comfortable)
          : state === "tight"
          ? fmt(departureWindow.tight)
          : fmt(departureWindow.cutoff)}
      </p>
    </div>
  );
}
