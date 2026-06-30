"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Save } from "lucide-react";
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

const LOUNGE_OPTIONS = [
  { value: "priority_pass",  label: "Priority Pass"               },
  { value: "amex_centurion", label: "Amex Centurion / Platinum"   },
  { value: "capital_one",    label: "Capital One Venture X"       },
  { value: "admirals_club",  label: "AA Admirals Club"            },
  { value: "delta_sky_club", label: "Delta Sky Club"              },
  { value: "united_club",    label: "United Club"                 },
  { value: "alaska_lounge",  label: "Alaska Airlines Lounge"      },
];

interface Profile {
  tsa_precheck:          boolean;
  global_entry:          boolean;
  has_real_id:           boolean;
  has_clear:             boolean;
  known_traveler_number: string | null;
  lounge_memberships:    string[] | null;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: C.accent }}>
      {children}
    </p>
  );
}

function Toggle({
  checked, onChange, label, hint,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 rounded-xl px-4 py-3 text-left transition-all"
      style={{
        backgroundColor: checked ? "#EDE9FE" : C.bg,
        border: `1px solid ${checked ? "#C4B5FD" : C.border}`,
      }}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: checked ? C.accent : C.text }}>{label}</p>
        {hint && <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{hint}</p>}
      </div>
      <div
        className="w-10 h-6 rounded-full relative shrink-0 transition-colors"
        style={{ backgroundColor: checked ? C.accent : C.border }}
      >
        <div
          className="absolute top-1 w-4 h-4 rounded-full transition-all"
          style={{
            backgroundColor: "#FFFFFF",
            left: checked ? "calc(100% - 20px)" : "4px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </div>
    </button>
  );
}

function LoungeCheckbox({
  value, label, checked, onChange,
}: {
  value: string; label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-left w-full transition-all"
      style={{
        backgroundColor: checked ? "#EDE9FE" : C.bg,
        border: `1px solid ${checked ? "#C4B5FD" : C.border}`,
      }}
    >
      <div
        className="w-5 h-5 rounded flex items-center justify-center shrink-0"
        style={{ backgroundColor: checked ? C.accent : C.card, border: `2px solid ${checked ? C.accent : C.border}` }}
      >
        {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
      </div>
      <span className="text-sm font-medium" style={{ color: checked ? C.accent : C.text }}>{label}</span>
    </button>
  );
}

export default function TravelDocsPage() {
  const router = useRouter();

  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [fetchErr,  setFetchErr]  = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [saveErr,   setSaveErr]   = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        const msg = json.error ?? `Could not load profile (${res.status})`;
        console.error("[travel-docs] fetchProfile failed:", msg);
        setFetchErr(msg);
        return;
      }
      const json = await res.json() as { profile: Profile };
      setProfile(json.profile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      console.error("[travel-docs] fetchProfile error:", err);
      setFetchErr(msg);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSave = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    setSaveErr(null);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          tsa_precheck:          profile.tsa_precheck,
          global_entry:          profile.global_entry,
          has_real_id:           profile.has_real_id,
          has_clear:             profile.has_clear,
          known_traveler_number: profile.known_traveler_number || null,
          lounge_memberships:    profile.lounge_memberships,
        }),
      });
      const json = await res.json() as { profile?: Profile; error?: string };
      if (!res.ok) { setSaveErr(json.error ?? "Could not save"); return; }
      if (json.profile) setProfile(json.profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }, [profile]);

  function setField<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaved(false);
  }

  function toggleLounge(value: string, checked: boolean) {
    setProfile((prev) => {
      if (!prev) return prev;
      const current = prev.lounge_memberships ?? [];
      const next = checked
        ? [...current.filter((v) => v !== value), value]
        : current.filter((v) => v !== value);
      return { ...prev, lounge_memberships: next };
    });
    setSaved(false);
  }

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
            Travel Documents
          </h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} />
          </div>
        ) : fetchErr ? (
          <p className="text-sm text-center py-12" style={{ color: "#DC2626" }}>
            {fetchErr}
          </p>
        ) : !profile ? (
          <p className="text-sm text-center py-12" style={{ color: C.muted }}>
            Could not load profile. Try reloading.
          </p>
        ) : (
          <div className="space-y-5">

            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
            >
              <SectionLabel>ID &amp; Security Status</SectionLabel>
              <div className="space-y-2">
                <Toggle
                  checked={profile.has_real_id}
                  onChange={(v) => setField("has_real_id", v)}
                  label="REAL ID compliant"
                  hint="Your driver's license meets REAL ID requirements"
                />
                <Toggle
                  checked={profile.tsa_precheck}
                  onChange={(v) => setField("tsa_precheck", v)}
                  label="TSA PreCheck enrolled"
                  hint="You have an active PreCheck membership"
                />
                <Toggle
                  checked={profile.global_entry}
                  onChange={(v) => setField("global_entry", v)}
                  label="Global Entry enrolled"
                  hint="Includes TSA PreCheck + expedited customs re-entry"
                />
                <Toggle
                  checked={profile.has_clear}
                  onChange={(v) => setField("has_clear", v)}
                  label="CLEAR member"
                  hint="You use CLEAR biometric lanes at the airport"
                />
              </div>
            </div>

            {(profile.tsa_precheck || profile.global_entry) && (
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
              >
                <SectionLabel>Known Traveler Number (KTN)</SectionLabel>
                <p className="text-[11px] mb-3 leading-relaxed" style={{ color: C.muted }}>
                  Your KTN activates the TSA PreCheck lane. Add it to every booking. Stored securely and never shared.
                </p>
                <input
                  type="text"
                  value={profile.known_traveler_number ?? ""}
                  onChange={(e) => setField("known_traveler_number", e.target.value || null)}
                  placeholder="e.g. 123456789"
                  maxLength={20}
                  className="w-full rounded-xl px-4 py-3 text-sm font-mono outline-none transition-all"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            )}

            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
            >
              <SectionLabel>Lounge Access</SectionLabel>
              <p className="text-[11px] mb-3 leading-relaxed" style={{ color: C.muted }}>
                Select all lounge networks you have access to. GateReady will highlight accessible lounges on your trips.
              </p>
              <div className="space-y-2">
                {LOUNGE_OPTIONS.map((opt) => (
                  <LoungeCheckbox
                    key={opt.value}
                    value={opt.value}
                    label={opt.label}
                    checked={(profile.lounge_memberships ?? []).includes(opt.value)}
                    onChange={(v) => toggleLounge(opt.value, v)}
                  />
                ))}
              </div>
            </div>

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

            <p className="text-[11px] text-center pb-2 leading-relaxed" style={{ color: C.faint }}>
              Your KTN and profile data are private and never shown on shared trip links.
            </p>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
