"use client";

import { useState } from "react";
import { Loader2, MapPin, CheckCircle2 } from "lucide-react";

interface Profile {
  name: string;
  home_address: string;
  tsa_precheck: boolean;
  global_entry: boolean;
  preferred_transport: string;
  accessibility_needs: string[];
}

const TRANSPORT_OPTIONS = [
  { id: "uber",    label: "Rideshare", emoji: "🚗" },
  { id: "drive",   label: "Drive",     emoji: "🔑" },
  { id: "transit", label: "Transit",   emoji: "🚆" },
  { id: "flex",    label: "Flexible",  emoji: "✨" },
];

const ACCESS_OPTIONS = ["Wheelchair", "Visual impairment", "Hearing impairment", "Mobility aid"];

export function ProfileSettingsForm({ userId, initialProfile }: { userId: string; initialProfile: Profile }) {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setSaveErr(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setSaveErr(json.error ?? `Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  function toggleAccess(need: string) {
    const needs = profile.accessibility_needs;
    setProfile({
      ...profile,
      accessibility_needs: needs.includes(need)
        ? needs.filter((n) => n !== need)
        : [...needs, need],
    });
  }

  return (
    <div
      className="rounded-3xl p-5 space-y-5"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8" }}
    >
      <p className="text-sm font-bold" style={{ fontFamily: "var(--font-inter), sans-serif", color: "#1A1A2E" }}>
        Your Settings
      </p>

      {/* Name */}
      <FieldWrapper label="Name">
        <input
          value={profile.name}
          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          placeholder="Your name"
          className="w-full rounded-xl px-4 py-2.5 text-sm text-[#1A1A2E] outline-none"
          style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#4F46E5")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "#E5E1D8")}
        />
      </FieldWrapper>

      {/* Home address */}
      <FieldWrapper label="Home Address">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#6B7280" }} />
          <input
            value={profile.home_address}
            onChange={(e) => setProfile({ ...profile, home_address: e.target.value })}
            placeholder="123 Main St, City, State"
            className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1A1A2E] outline-none"
            style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#4F46E5")}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "#E5E1D8")}
          />
        </div>
      </FieldWrapper>

      {/* TSA PreCheck / Global Entry toggles */}
      <FieldWrapper label="Trusted Traveler">
        <div className="space-y-2">
          <Toggle
            label="TSA PreCheck"
            sub="Expedited security screening"
            value={profile.tsa_precheck}
            onChange={(v) => setProfile({ ...profile, tsa_precheck: v })}
            color="#4F46E5"
          />
          <Toggle
            label="Global Entry"
            sub="Expedited US customs"
            value={profile.global_entry}
            onChange={(v) => setProfile({ ...profile, global_entry: v })}
            color="#10B981"
          />
        </div>
      </FieldWrapper>

      {/* Preferred transport */}
      <FieldWrapper label="Preferred Transport">
        <div className="grid grid-cols-4 gap-2">
          {TRANSPORT_OPTIONS.map(({ id, label, emoji }) => {
            const on = profile.preferred_transport === id;
            return (
              <button
                key={id}
                onClick={() => setProfile({ ...profile, preferred_transport: id })}
                className="flex flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-semibold transition-all"
                style={{
                  backgroundColor: on ? "rgba(0,212,184,0.12)" : "#F7F5F0",
                  border: `1px solid ${on ? "#4F46E5" : "#E5E1D8"}`,
                  color: on ? "#4F46E5" : "#6B7280",
                }}
              >
                <span className="text-base">{emoji}</span>
                {label}
              </button>
            );
          })}
        </div>
      </FieldWrapper>

      {/* Accessibility */}
      <FieldWrapper label="Accessibility Needs">
        <div className="flex flex-wrap gap-2">
          {ACCESS_OPTIONS.map((need) => {
            const on = profile.accessibility_needs.includes(need);
            return (
              <button
                key={need}
                onClick={() => toggleAccess(need)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  backgroundColor: on ? "rgba(0,212,184,0.12)" : "#F7F5F0",
                  border: `1px solid ${on ? "#4F46E5" : "#E5E1D8"}`,
                  color: on ? "#4F46E5" : "#6B7280",
                }}
              >
                {need}
              </button>
            );
          })}
        </div>
      </FieldWrapper>

      {/* Save button */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        style={{ backgroundColor: saved ? "#10B981" : "#4F46E5", color: "#F7F5F0" }}
      >
        {saving  && <Loader2 className="h-4 w-4 animate-spin" />}
        {saved   && <CheckCircle2 className="h-4 w-4" />}
        {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
      </button>

      {saveErr && (
        <p className="text-xs text-center" style={{ color: "#DC2626" }}>{saveErr}</p>
      )}
    </div>
  );
}

function FieldWrapper({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#6B7280" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function Toggle({ label, sub, value, onChange, color }: {
  label: string; sub: string; value: boolean;
  onChange: (v: boolean) => void; color: string;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between rounded-xl p-3 transition-all"
      style={{
        backgroundColor: value ? `${color}10` : "#F7F5F0",
        border: `1px solid ${value ? `${color}40` : "#E5E1D8"}`,
      }}
    >
      <div className="text-left">
        <p className="text-xs font-semibold text-[#1A1A2E]">{label}</p>
        <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>{sub}</p>
      </div>
      <div
        className="w-9 h-5 rounded-full relative transition-all shrink-0"
        style={{ backgroundColor: value ? color : "#E5E1D8" }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
          style={{ left: value ? "calc(100% - 18px)" : "2px" }}
        />
      </div>
    </button>
  );
}
