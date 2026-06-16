import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Plane, Car } from "lucide-react";
import { Suspense } from "react";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";
import { AgentChat } from "@/components/agent/AgentChat";
import { BottomNav } from "@/components/dashboard/BottomNav";

export default async function AgentPage() {
  const sessionClient = await createSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) redirect("/login");

  const supabase = createServiceClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("id, flight_number, status, origin, destination")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Fetch latest step metrics for the status bar
  const { data: steps } = await supabase
    .from("itinerary_steps")
    .select("step_type, detail, status")
    .eq("trip_id", trip?.id ?? "")
    .in("step_type", ["tsa", "flight", "transport"]);

  const tsaStep    = steps?.find((s) => s.step_type === "tsa");
  const flightStep = steps?.find((s) => s.step_type === "flight");
  const trafficStep = steps?.find((s) => s.step_type === "transport");

  return (
    <>
      <main className="flex flex-col max-w-md mx-auto" style={{ height: "calc(100dvh - 64px)" }}>
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 pt-5 pb-4"
          style={{ borderBottom: "1px solid #E5E1D8", backgroundColor: "#FFFFFF" }}
        >
          <Link
            href="/"
            className="p-2 rounded-xl shrink-0 transition-all"
            style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8", color: "#6B7280" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate" style={{ color: "#1A1A2E" }}>
              GateReady
            </h1>
            <p className="text-[11px] font-medium" style={{ color: "#9CA3AF" }}>
              AI travel assistant
            </p>
          </div>

          {/* Live indicators */}
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusChip
              icon={<ShieldCheck className="h-3 w-3" />}
              value={tsaStep?.detail ?? "—"}
              color="#4F46E5"
            />
            <StatusChip
              icon={<Plane className="h-3 w-3" />}
              value={flightStep?.detail ?? trip?.status ?? "On time"}
              color="#10B981"
            />
            <StatusChip
              icon={<Car className="h-3 w-3" />}
              value={trafficStep?.detail ?? "—"}
              color="#F59E0B"
            />
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-hidden">
          <Suspense>
            <AgentChat userId={user.id} tripId={trip?.id ?? ""} />
          </Suspense>
        </div>
      </main>

      <BottomNav />
    </>
  );
}

function StatusChip({ icon, value, color }: { icon: React.ReactNode; value: string; color: string }) {
  return (
    <div
      className="flex items-center gap-1 rounded-full px-2 py-1"
      style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
    >
      <span style={{ color }}>{icon}</span>
      <span className="text-[9px] font-semibold max-w-[32px] truncate" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
