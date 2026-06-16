import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";
import { FamilyClient } from "./FamilyClient";
import { BottomNav } from "@/components/dashboard/BottomNav";

export default async function FamilyPage() {
  const sessionClient = await createSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) redirect("/login");

  const supabase = createServiceClient();

  const [{ data: links }, { data: monitoredTrips }] = await Promise.all([
    supabase
      .from("family_links")
      .select("*, family_member:family_member_id(id, name, email)")
      .eq("user_id", user.id)
      .eq("active", true),
    supabase
      .from("trips")
      .select("id, user_id, flight_number, airline, origin, destination, departure_time, status, parental_settings")
      .eq("parent_id", user.id)
      .eq("parental_mode", true),
  ]);

  return (
    <>
      <main className="flex flex-col min-h-screen max-w-md mx-auto px-4 pt-6 pb-28 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl transition-all"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", color: "#6B7280" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-inter), sans-serif", color: "#1A1A2E" }}>
              Family & Sharing
            </h1>
            <p className="text-xs font-medium mt-0.5" style={{ color: "#6B7280" }}>
              Share your trip with family
            </p>
          </div>
        </div>

        <FamilyClient
          userId={user.id}
          initialLinks={(links ?? []) as FamilyLink[]}
          initialMonitoredTrips={(monitoredTrips ?? []) as MonitoredTrip[]}
        />
      </main>

      <BottomNav />
    </>
  );
}

export interface FamilyLink {
  id: string;
  user_id: string;
  family_member_id: string;
  permissions: string[];
  active: boolean;
  family_member?: { id: string; name: string | null; email: string | null } | null;
}

export interface MonitoredTrip {
  id: string;
  user_id: string;
  flight_number: string | null;
  airline: string | null;
  origin: string | null;
  destination: string | null;
  departure_time: string | null;
  status: string;
  parental_settings: Record<string, unknown> | null;
}
