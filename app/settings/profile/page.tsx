"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Save } from "lucide-react";
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

interface Profile {
  name:  string | null;
  email: string | null;
}

export default function SettingsProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name,    setName]    = useState("");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) return;
      const json = await res.json() as { profile: Profile };
      setProfile(json.profile);
      setName(json.profile.name ?? "");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveErr(null);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim() || null }),
      });
      const json = await res.json() as { profile?: Profile; error?: string };
      if (!res.ok) { setSaveErr(json.error ?? "Could not save"); return; }
      if (json.profile) setProfile(json.profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }, [name]);

  const displayName = name.trim() || profile?.email?.split("@")[0] || "Traveler";

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: C.bg }}>
      <div className="max-w-md mx-auto px-4">

        <div className="pt-6 pb-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/settings")}
            className="h-9 w-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, boxShadow: SHADOW }}
          >
            <ArrowLeft className="h-4 w-4" style={{ color: C.text }} />
          </button>
          <h1
            className="text-lg font-bold"
            style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Profile
          </h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} />
          </div>
        ) : (
          <div className="space-y-5">

            {/* Avatar preview */}
            <div
              className="rounded-2xl p-5 flex flex-col items-center gap-3"
              style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
            >
              <InitialsAvatar name={displayName} size={72} />
              <p className="text-xs" style={{ color: C.muted }}>
                Your initials auto-generate from your display name.
              </p>
            </div>

            {/* Name */}
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                Display Name
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setSaved(false); }}
                placeholder="Your name"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  backgroundColor: C.bg,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                }}
              />
            </div>

            {/* Email */}
            {profile?.email && (
              <div
                className="rounded-2xl p-5 space-y-3"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                  Email
                </p>
                <p className="text-sm px-1" style={{ color: C.muted }}>
                  {profile.email}
                </p>
                <p className="text-[11px]" style={{ color: C.faint }}>
                  Email is managed through your account and cannot be changed here.
                </p>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold transition-all active:scale-[0.98]"
              style={{ backgroundColor: C.accent, color: "#FFFFFF" }}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <><CheckCircle2 className="h-4 w-4" /> Saved</>
              ) : (
                <><Save className="h-4 w-4" /> Save</>
              )}
            </button>

            {saveErr && (
              <p className="text-sm text-center" style={{ color: "#DC2626" }}>{saveErr}</p>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
