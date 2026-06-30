import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Zap, Circle } from "lucide-react";
import { createSessionClient, createServiceClient } from "@/lib/supabase/server";
import { AUTO_APPLY_THRESHOLD } from "@/lib/agent/confidence";
import { ProfileSettingsForm } from "@/app/preferences/ProfileSettingsForm";
import { CalendarConnect } from "@/app/preferences/CalendarConnect";
import { TravelStyleForm } from "@/app/preferences/TravelStyleForm";
import { BottomNav } from "@/components/dashboard/BottomNav";

export default async function SettingsPreferencesPage() {
  const sessionClient = await createSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) redirect("/login");

  const supabase = createServiceClient();

  const [{ data: profile }, { data: prefs }, { data: calendarPref }, { data: trip }] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase.from("user_preferences").select("*").eq("user_id", user.id).order("confidence_score", { ascending: false }),
    supabase.from("user_preferences").select("value").eq("user_id", user.id).eq("key", "google_calendar_tokens").single(),
    supabase.from("trips").select("id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single(),
  ]);

  const autoApplied = (prefs ?? []).filter((p) => p.confidence_score >= AUTO_APPLY_THRESHOLD);
  const learning    = (prefs ?? []).filter((p) => p.confidence_score < AUTO_APPLY_THRESHOLD);

  return (
    <>
      <main className="flex flex-col min-h-screen max-w-md mx-auto px-4 pt-6 pb-28 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="p-2 rounded-xl transition-all"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", color: "#6B7280" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-inter), sans-serif", color: "#1A1A2E" }}>
              Preferences
            </h1>
            <p className="text-xs font-medium mt-0.5" style={{ color: "#6B7280" }}>
              Settings and learned behavior
            </p>
          </div>
        </div>

        <Suspense fallback={null}>
          <CalendarConnect
            connected={!!calendarPref?.value}
            tripId={trip?.id}
          />
        </Suspense>

        <ProfileSettingsForm
          userId={user.id}
          initialProfile={{
            name:                profile?.name ?? "",
            home_address:        profile?.home_address ?? "",
            tsa_precheck:        profile?.tsa_precheck ?? false,
            global_entry:        profile?.global_entry ?? false,
            preferred_transport: profile?.preferred_transport ?? "uber",
            accessibility_needs: profile?.accessibility_needs ?? [],
          }}
        />

        <TravelStyleForm
          initialValues={{
            arrival_buffer_minutes: profile?.arrival_buffer_minutes ?? 25,
            travel_frequency:       profile?.travel_frequency ?? "",
            trip_scope:             profile?.trip_scope        ?? "",
            travels_with:           profile?.travels_with      ?? "",
            travel_stressors:       profile?.travel_stressors  ?? [],
            home_airport:           profile?.home_airport      ?? "",
          }}
        />

        {(autoApplied.length > 0 || learning.length > 0) && (
          <div>
            <SectionHeader label="Learned Preferences" sub="Built from your past trips" />

            {autoApplied.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-3.5 w-3.5" style={{ color: "#10B981" }} />
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#10B981" }}>
                    Auto-applied ({autoApplied.length})
                  </p>
                </div>
                {autoApplied.map((p) => <PrefCard key={p.id} pref={p} autoApply />)}
              </div>
            )}

            {learning.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Circle className="h-3.5 w-3.5" style={{ color: "#6B7280" }} />
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6B7280" }}>
                    Still learning ({learning.length})
                  </p>
                </div>
                {learning.map((p) => <PrefCard key={p.id} pref={p} autoApply={false} />)}
              </div>
            )}
          </div>
        )}

        {prefs?.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-[#1A1A2E] mb-1">No behavior learned yet</p>
            <p className="text-xs" style={{ color: "#6B7280" }}>
              Complete trips to build your preference model.
            </p>
          </div>
        )}

        <p className="text-center text-[10px]" style={{ color: "#9CA3AF" }}>
          Auto-apply threshold: {AUTO_APPLY_THRESHOLD * 100}% confidence
        </p>
      </main>

      <BottomNav />
    </>
  );
}

function SectionHeader({ label, sub }: { label: string; sub: string }) {
  return (
    <div>
      <p className="text-sm font-bold" style={{ fontFamily: "var(--font-inter), sans-serif", color: "#1A1A2E" }}>{label}</p>
      <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{sub}</p>
    </div>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const pct   = Math.round(score * 100);
  const color = score >= AUTO_APPLY_THRESHOLD ? "#10B981" : score >= 0.5 ? "#4F46E5" : "#9CA3AF";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E1D8" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] w-8 text-right font-medium" style={{ color: "#6B7280" }}>{pct}%</span>
    </div>
  );
}

function PrefCard({ pref, autoApply }: {
  pref: { key: string; value: unknown; confidence_score: number; times_observed: number; source: string | null };
  autoApply: boolean;
}) {
  const displayValue = typeof pref.value === "object" ? JSON.stringify(pref.value) : String(pref.value);
  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        backgroundColor: autoApply ? "rgba(39,217,143,0.06)" : "#FFFFFF",
        border: `1px solid ${autoApply ? "rgba(39,217,143,0.25)" : "#E5E1D8"}`,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-[#1A1A2E]">
            {pref.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{displayValue}</p>
        </div>
        <span className="text-[10px] shrink-0 ml-2" style={{ color: "#9CA3AF" }}>
          {pref.times_observed}× observed
        </span>
      </div>
      <ConfidenceBar score={pref.confidence_score} />
    </div>
  );
}
