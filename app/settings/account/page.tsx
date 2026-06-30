"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LogOut, Lock, Trash2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
  red:     "#DC2626",
} as const;

const SHADOW = "0 2px 16px rgba(0,0,0,0.06)";

export default function AccountPage() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const placeholders = [
    { Icon: Lock,  label: "Change Password", sub: "Update your account password" },
    { Icon: Trash2, label: "Delete Account",  sub: "Permanently remove your account and data" },
  ];

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: C.bg }}>
      <div className="max-w-md mx-auto px-4">

        <div className="pt-6 pb-4 flex items-center gap-3">
          <Link
            href="/settings"
            className="h-9 w-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, boxShadow: SHADOW }}
          >
            <ArrowLeft className="h-4 w-4" style={{ color: C.text }} />
          </Link>
          <h1
            className="text-lg font-bold"
            style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Account
          </h1>
        </div>

        <div className="space-y-4">

          {/* Sign out */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
          >
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[#FEF2F2] active:bg-[#FEE2E2]"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#FEE2E2" }}
              >
                <LogOut className="h-5 w-5" style={{ color: C.red }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: C.red }}>Sign Out</p>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>Sign out of GateReady on this device</p>
              </div>
            </button>
          </div>

          {/* Retake onboarding */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
          >
            <Link
              href="/onboarding"
              className="w-full flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#F5F3FF] active:bg-[#EDE9FE]"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#EDE9FE" }}
              >
                <RefreshCw className="h-5 w-5" style={{ color: C.accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: C.text }}>Retake travel preferences</p>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>Update your travel style and defaults</p>
              </div>
            </Link>
          </div>

          {/* Placeholder actions */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
          >
            {placeholders.map(({ Icon, label, sub }, i) => (
              <div
                key={label}
                className="flex items-center gap-4 px-5 py-4"
                style={{ borderTop: i > 0 ? `1px solid ${C.divider}` : "none", opacity: 0.45 }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: C.bg }}
                >
                  <Icon className="h-5 w-5" style={{ color: C.muted }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: C.text }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</p>
                </div>
                <span className="text-[10px] font-semibold shrink-0 px-2 py-0.5 rounded-full" style={{ backgroundColor: C.bg, color: C.faint }}>
                  Soon
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
      <BottomNav />
    </div>
  );
}
