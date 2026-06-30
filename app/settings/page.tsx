import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, User, ShieldCheck, Users, Sliders, Settings, Pencil } from "lucide-react";
import { createSessionClient } from "@/lib/supabase/server";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { BottomNav } from "@/components/dashboard/BottomNav";

const C = {
  bg:      "#FAF7F2",
  card:    "#FFFFFF",
  text:    "#1A1A2E",
  muted:   "#8B8070",
  faint:   "#B5A89A",
  border:  "#E8E0D5",
  divider: "#F0EDE8",
  accent:  "#4F46E5",
} as const;

const SHADOW = "0 2px 16px rgba(0,0,0,0.06)";

export default async function SettingsPage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, email")
    .eq("id", user.id)
    .single();

  const displayName = profile?.name ?? user.email?.split("@")[0] ?? "Traveler";
  const email       = user.email ?? profile?.email ?? "";

  const sections = [
    { href: "/settings/profile",     Icon: User,        label: "Profile",          sub: "Name and display settings" },
    { href: "/settings/travel-docs", Icon: ShieldCheck, label: "Travel Documents", sub: "REAL ID, PreCheck, KTN, lounges" },
    { href: "/settings/family",      Icon: Users,       label: "Family",           sub: "Shared trip access" },
    { href: "/settings/preferences", Icon: Sliders,     label: "Preferences",      sub: "Transport, home, accessibility" },
    { href: "/settings/account",     Icon: Settings,    label: "Account",          sub: "Sign out and account options" },
  ];

  return (
    <>
      <div className="min-h-screen pb-24" style={{ backgroundColor: C.bg }}>
        <div className="max-w-md mx-auto px-4">

          <div className="pt-8 pb-6">
            <h1
              className="text-2xl font-bold mb-6"
              style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Settings
            </h1>

            <Link
              href="/settings/profile"
              className="rounded-2xl p-5 flex items-center gap-4 transition-colors hover:bg-[#F0EDE8] active:bg-[#EAE5DF]"
              style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}`, display: "flex" }}
            >
              <InitialsAvatar name={displayName} size={60} />
              <div className="min-w-0 flex-1">
                <p
                  className="text-base font-bold truncate"
                  style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {displayName}
                </p>
                <p className="text-sm truncate mt-0.5" style={{ color: C.muted }}>
                  {email}
                </p>
              </div>
              <Pencil className="h-4 w-4 shrink-0 ml-2" style={{ color: C.faint }} />
            </Link>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
          >
            {sections.map(({ href, Icon, label, sub }, i) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#FAF7F2] active:bg-[#F0EDE8]"
                style={{ borderTop: i > 0 ? `1px solid ${C.divider}` : "none" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#EDE9FE" }}
                >
                  <Icon className="h-5 w-5" style={{ color: C.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: C.text }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.faint }} />
              </Link>
            ))}
          </div>

        </div>
      </div>
      <BottomNav />
    </>
  );
}
