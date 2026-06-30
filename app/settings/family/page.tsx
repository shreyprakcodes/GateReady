"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Loader2 } from "lucide-react";
import { BottomNav } from "@/components/dashboard/BottomNav";

const C = {
  bg:     "#FAF7F2",
  card:   "#FFFFFF",
  text:   "#1A1A2E",
  muted:  "#8B8070",
  border: "#E8E0D5",
  divider:"#F0EDE8",
  accent: "#4F46E5",
} as const;

const SHADOW = "0 2px 16px rgba(0,0,0,0.06)";

export default function FamilyPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.profile) setEnabled(!!json.profile.family_auto_updates);
      })
      .catch(() => {});
  }, []);

  async function toggle() {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setEnabled(next);
    try {
      await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ family_auto_updates: next }),
      });
    } catch {
      setEnabled(!next); // revert
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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
              Family
            </h1>
          </div>

          <div className="space-y-4">

            {/* Auto-updates toggle */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
            >
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: "#EDE9FE" }}
                    >
                      <Users className="h-5 w-5" style={{ color: C.accent }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: C.text }}>
                        Auto-share trip updates
                      </p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: C.muted }}>
                        Family members see your live status without you having to text.
                      </p>
                    </div>
                  </div>

                  {enabled === null ? (
                    <Loader2 className="h-5 w-5 animate-spin shrink-0 mt-2.5" style={{ color: C.muted }} />
                  ) : (
                    <button
                      onClick={toggle}
                      disabled={saving}
                      className="shrink-0 mt-2 w-11 h-6 rounded-full relative transition-all"
                      style={{ backgroundColor: enabled ? C.accent : C.border }}
                      aria-label={enabled ? "Disable auto-updates" : "Enable auto-updates"}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                        style={{ transform: enabled ? "translateX(20px)" : "translateX(0)" }}
                      />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Placeholder — family member list */}
            <div
              className="rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
              style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}`, opacity: 0.5 }}
            >
              <p className="text-sm font-semibold" style={{ color: C.text }}>Family member list</p>
              <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
                Invite family members to follow your trips in real time. Coming soon.
              </p>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: C.bg, color: C.muted }}
              >
                Soon
              </span>
            </div>

          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
