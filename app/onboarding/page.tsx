"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:      "#FAF7F2",
  card:    "#FFFFFF",
  text:    "#1A1A2E",
  muted:   "#8B8070",
  faint:   "#B5A89A",
  border:  "#E8E0D5",
  divider: "#F0EDE8",
  accent:  "#4F46E5",
  selected: "#EDE9FE",
  selectedBorder: "#C4B5FD",
} as const;

const SHADOW = "0 2px 16px rgba(0,0,0,0.06)";

// ─── Question definitions ─────────────────────────────────────────────────────

const TOTAL = 10;

interface Option { value: string | number | boolean; label: string; sub?: string; emoji: string }

interface Question {
  id:       string;
  q:        string;
  sub?:     string;
  type:     "single" | "multi" | "text";
  options?: Option[];
  placeholder?: string;
}

const QUESTIONS: Question[] = [
  {
    id: "arrival_buffer",
    q:  "When do you like to arrive at the airport?",
    sub: "Sets your default Leave Now timing.",
    type: "single",
    options: [
      { value: 45, label: "Way early",     sub: "I want lots of buffer",     emoji: "🛋️" },
      { value: 25, label: "Comfortable",   sub: "On time, no rushing",       emoji: "✈️" },
      { value: 10, label: "Cut it close",  sub: "I know airports well",      emoji: "⚡" },
    ],
  },
  {
    id: "transport",
    q:  "How do you usually get to the airport?",
    type: "single",
    options: [
      { value: "drive",   label: "I drive",          emoji: "🔑" },
      { value: "uber",    label: "Rideshare",         emoji: "🚗" },
      { value: "transit", label: "Public transit",    emoji: "🚆" },
      { value: "flex",    label: "Dropped off / flex",emoji: "👋" },
    ],
  },
  {
    id: "frequency",
    q:  "How often do you fly?",
    type: "single",
    options: [
      { value: "rarely",     label: "Rarely",              sub: "Once a year or less",  emoji: "🌱" },
      { value: "sometimes",  label: "A few times a year",  emoji: "✈️" },
      { value: "frequently", label: "Frequently",           sub: "Monthly or more",      emoji: "🏆" },
    ],
  },
  {
    id: "scope",
    q:  "Where do you mostly travel?",
    sub: "Tunes passport and REAL ID reminders.",
    type: "single",
    options: [
      { value: "domestic",      label: "Domestic",       sub: "Within my country",   emoji: "🏠" },
      { value: "international", label: "International",  sub: "Cross-border travel", emoji: "🌍" },
      { value: "both",          label: "Both",           emoji: "🗺️" },
    ],
  },
  {
    id: "trusted",
    q:  "Any trusted-traveler programs?",
    sub: "Select all that apply.",
    type: "multi",
    options: [
      { value: "tsa_precheck", label: "TSA PreCheck", emoji: "⚡" },
      { value: "global_entry", label: "Global Entry",  emoji: "🌐" },
      { value: "has_clear",    label: "CLEAR",         emoji: "👁️" },
      { value: "none",         label: "None",          emoji: "—" },
    ],
  },
  {
    id: "lounges",
    q:  "Do you have airport lounge access?",
    sub: "Select all that apply.",
    type: "multi",
    options: [
      { value: "priority_pass",  label: "Priority Pass",         emoji: "🛋️" },
      { value: "amex_centurion", label: "Amex Centurion / Plat", emoji: "💳" },
      { value: "capital_one",    label: "Capital One Venture X", emoji: "💎" },
      { value: "admirals_club",  label: "Airline Club",          emoji: "✈️" },
      { value: "none",           label: "None",                  emoji: "—" },
    ],
  },
  {
    id: "companions",
    q:  "Who do you usually travel with?",
    type: "single",
    options: [
      { value: "solo",    label: "Solo",             emoji: "🎒" },
      { value: "partner", label: "Partner",           emoji: "💑" },
      { value: "family",  label: "Family with kids",  emoji: "👨‍👩‍👧" },
      { value: "mixed",   label: "Groups / mixed",    emoji: "👥" },
    ],
  },
  {
    id: "stressors",
    q:  "What stresses you most on travel day?",
    sub: "Select all that apply — we'll highlight what matters to you.",
    type: "multi",
    options: [
      { value: "delays",         label: "Flight delays",      emoji: "⏳" },
      { value: "security_lines", label: "Security lines",     emoji: "🔒" },
      { value: "traffic",        label: "Traffic to airport", emoji: "🚗" },
      { value: "when_to_leave",  label: "When to leave",      emoji: "⏰" },
      { value: "gate_changes",   label: "Gate changes",       emoji: "🚪" },
    ],
  },
  {
    id: "family_updates",
    q:  "Auto-share updates with family?",
    sub: "They can see your live trip status without you having to text.",
    type: "single",
    options: [
      { value: "true",  label: "Yes, keep them posted", emoji: "📱" },
      { value: "false", label: "No thanks",             emoji: "🔒" },
    ],
  },
  {
    id: "home_airport",
    q:  "What's your home airport or city?",
    sub: "Used to estimate drive times and set smart defaults.",
    type: "text",
    placeholder: "e.g. LAX, SFO, Chicago…",
  },
];

// ─── Answers state ────────────────────────────────────────────────────────────

interface Answers {
  arrival_buffer_minutes: number | null;
  preferred_transport:    string | null;
  travel_frequency:       string | null;
  trip_scope:             string | null;
  trusted_traveler:       string[] | null;   // null = not visited; [] = "None" chosen
  lounge_memberships:     string[] | null;
  travels_with:           string | null;
  travel_stressors:       string[] | null;
  family_auto_updates:    boolean | null;
  home_airport:           string;
}

const EMPTY: Answers = {
  arrival_buffer_minutes: null,
  preferred_transport:    null,
  travel_frequency:       null,
  trip_scope:             null,
  trusted_traveler:       null,
  lounge_memberships:     null,
  travels_with:           null,
  travel_stressors:       null,
  family_auto_updates:    null,
  home_airport:           "",
};

function prefillFromProfile(p: Record<string, unknown>): Partial<Answers> {
  const trusted: string[] = [];
  if (p.tsa_precheck) trusted.push("tsa_precheck");
  if (p.global_entry) trusted.push("global_entry");
  if (p.has_clear)    trusted.push("has_clear");

  return {
    arrival_buffer_minutes: typeof p.arrival_buffer_minutes === "number"
      ? p.arrival_buffer_minutes : null,
    preferred_transport:  typeof p.preferred_transport === "string" ? p.preferred_transport : null,
    travel_frequency:     typeof p.travel_frequency    === "string" ? p.travel_frequency    : null,
    trip_scope:           typeof p.trip_scope          === "string" ? p.trip_scope          : null,
    trusted_traveler:     trusted.length > 0 ? trusted : null,
    lounge_memberships:   Array.isArray(p.lounge_memberships) && p.lounge_memberships.length > 0
      ? (p.lounge_memberships as string[]) : null,
    travels_with:         typeof p.travels_with === "string" ? p.travels_with : null,
    travel_stressors:     Array.isArray(p.travel_stressors) && p.travel_stressors.length > 0
      ? (p.travel_stressors as string[]) : null,
    family_auto_updates:  typeof p.family_auto_updates === "boolean" ? p.family_auto_updates : null,
    home_airport:         typeof p.home_airport === "string" ? p.home_airport : "",
  };
}

function buildPayload(answers: Answers): Record<string, unknown> {
  const p: Record<string, unknown> = { onboarding_completed: true };

  if (answers.arrival_buffer_minutes !== null)
    p.arrival_buffer_minutes = answers.arrival_buffer_minutes;
  if (answers.preferred_transport !== null)
    p.preferred_transport = answers.preferred_transport;
  if (answers.travel_frequency !== null)
    p.travel_frequency = answers.travel_frequency;
  if (answers.trip_scope !== null)
    p.trip_scope = answers.trip_scope;

  if (answers.trusted_traveler !== null) {
    const t = answers.trusted_traveler;
    p.tsa_precheck = t.includes("tsa_precheck");
    p.global_entry = t.includes("global_entry");
    p.has_clear    = t.includes("has_clear");
  }

  if (answers.lounge_memberships !== null)
    p.lounge_memberships = answers.lounge_memberships.filter((v) => v !== "none");
  if (answers.travels_with !== null)
    p.travels_with = answers.travels_with;
  if (answers.travel_stressors !== null)
    p.travel_stressors = answers.travel_stressors;
  if (answers.family_auto_updates !== null)
    p.family_auto_updates = answers.family_auto_updates;
  if (answers.home_airport.trim())
    p.home_airport = answers.home_airport.trim().toUpperCase();

  return p;
}

// ─── Single-select answer helpers ─────────────────────────────────────────────

function getSingleValue(answers: Answers, stepId: string): string | number | boolean | null {
  switch (stepId) {
    case "arrival_buffer": return answers.arrival_buffer_minutes;
    case "transport":      return answers.preferred_transport;
    case "frequency":      return answers.travel_frequency;
    case "scope":          return answers.trip_scope;
    case "companions":     return answers.travels_with;
    case "family_updates": return answers.family_auto_updates === null ? null
                            : answers.family_auto_updates ? "true" : "false";
    default: return null;
  }
}

function setSingleValue(
  prev: Answers, stepId: string, value: string | number | boolean,
): Answers {
  switch (stepId) {
    case "arrival_buffer":
      return { ...prev, arrival_buffer_minutes: Number(value) };
    case "transport":
      return { ...prev, preferred_transport: String(value) };
    case "frequency":
      return { ...prev, travel_frequency: String(value) };
    case "scope":
      return { ...prev, trip_scope: String(value) };
    case "companions":
      return { ...prev, travels_with: String(value) };
    case "family_updates":
      return { ...prev, family_auto_updates: value === "true" };
    default:
      return prev;
  }
}

function getMultiValues(answers: Answers, stepId: string): string[] {
  switch (stepId) {
    case "trusted":   return answers.trusted_traveler   ?? [];
    case "lounges":   return answers.lounge_memberships ?? [];
    case "stressors": return answers.travel_stressors   ?? [];
    default: return [];
  }
}

function toggleMulti(
  prev: Answers, stepId: string, value: string, hasNone: boolean,
): Answers {
  const current = getMultiValues(prev, stepId);
  let next: string[];

  if (value === "none") {
    next = current.includes("none") ? [] : ["none"];
  } else {
    const withoutNone = current.filter((v) => v !== "none");
    next = withoutNone.includes(value)
      ? withoutNone.filter((v) => v !== value)
      : [...withoutNone, value];
    if (hasNone && next.length === 0) next = [];
  }

  switch (stepId) {
    case "trusted":   return { ...prev, trusted_traveler:   next };
    case "lounges":   return { ...prev, lounge_memberships: next };
    case "stressors": return { ...prev, travel_stressors:   next };
    default: return prev;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OptionCard({
  option, selected, onSelect, multi,
}: {
  option:   Option;
  selected: boolean;
  onSelect: () => void;
  multi:    boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all active:scale-[0.98]"
      style={{
        backgroundColor: selected ? C.selected : C.card,
        border:          `1.5px solid ${selected ? C.selectedBorder : C.border}`,
        boxShadow:       selected ? "none" : SHADOW,
      }}
    >
      {multi && (
        <div
          className="w-5 h-5 rounded flex items-center justify-center shrink-0"
          style={{
            backgroundColor: selected ? C.accent : C.card,
            border:          `2px solid ${selected ? C.accent : C.border}`,
          }}
        >
          {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
        </div>
      )}

      <span className="text-xl shrink-0 w-7 text-center">{option.emoji}</span>

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold leading-snug"
          style={{ color: selected ? C.accent : C.text }}
        >
          {option.label}
        </p>
        {option.sub && (
          <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>
            {option.sub}
          </p>
        )}
      </div>

      {!multi && selected && (
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: C.accent }}
        >
          <CheckCircle2 className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router  = useRouter();
  const [step,      setStep]      = useState(0);
  const [answers,   setAnswers]   = useState<Answers>(EMPTY);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-fill from existing profile and check onboarding status
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (!json) { setLoading(false); return; }
        const profile = json.profile as Record<string, unknown>;
        // Always allow access — onboarding_completed check is in the root page redirect only.
        // Pre-fill existing values so "retake" preserves prior answers.
        setAnswers((prev) => ({ ...prev, ...prefillFromProfile(profile) }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const q = QUESTIONS[step];

  async function save(finalAnswers: Answers) {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = buildPayload(finalAnswers);
      const res = await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        const msg = json.error ?? `Save failed (${res.status})`;
        console.error("[onboarding] save failed:", msg);
        setSaveError(msg);
        setSaving(false);
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      console.error("[onboarding] save error:", err);
      setSaveError(msg);
      setSaving(false);
      return;
    }
    setSaving(false);
    router.replace("/dashboard");
  }

  async function skipAll() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ onboarding_completed: true }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        const msg = json.error ?? `Save failed (${res.status})`;
        console.error("[onboarding] skipAll failed:", msg);
        setSaveError(msg);
        setSaving(false);
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      console.error("[onboarding] skipAll error:", err);
      setSaveError(msg);
      setSaving(false);
      return;
    }
    setSaving(false);
    router.replace("/dashboard");
  }

  function next() {
    if (step < TOTAL - 1) {
      setStep((s) => s + 1);
    } else {
      save(answers);
    }
  }

  function skip() {
    if (step < TOTAL - 1) {
      setStep((s) => s + 1);
    } else {
      save(answers);
    }
  }

  function back() {
    if (step > 0) setStep((s) => s - 1);
  }

  function selectSingle(value: string | number | boolean) {
    setAnswers((prev) => setSingleValue(prev, q.id, value));
  }

  function toggleOption(value: string) {
    const hasNone = q.options?.some((o) => o.value === "none") ?? false;
    setAnswers((prev) => toggleMulti(prev, q.id, value, hasNone));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: C.bg }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} />
      </div>
    );
  }

  const selectedSingle = getSingleValue(answers, q.id);
  const selectedMulti  = getMultiValues(answers, q.id);

  const canNext =
    q.type === "text"
      ? answers.home_airport.trim().length > 0
      : q.type === "multi"
        ? selectedMulti.length > 0
        : selectedSingle !== null;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: C.bg }}>
      <div className="max-w-md mx-auto w-full flex flex-col flex-1 px-4">

        {/* ── Top bar ─────────────────────────────────────────────── */}
        <div className="pt-6 pb-2 flex items-center justify-between">
          <button
            onClick={back}
            disabled={step === 0}
            className="h-9 w-9 rounded-full flex items-center justify-center transition-all"
            style={{
              backgroundColor: step > 0 ? C.card : "transparent",
              border:          step > 0 ? `1px solid ${C.border}` : "none",
              opacity:         step === 0 ? 0 : 1,
            }}
          >
            <ArrowLeft className="h-4 w-4" style={{ color: C.text }} />
          </button>

          <p className="text-[11px] font-semibold" style={{ color: C.muted }}>
            Step {step + 1} of {TOTAL}
          </p>

          <button
            onClick={skipAll}
            disabled={saving}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
            style={{ color: C.muted, backgroundColor: C.divider }}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Skip all"}
          </button>
        </div>

        {/* ── Progress bar ────────────────────────────────────────── */}
        <div
          className="h-1 rounded-full overflow-hidden mt-1 mb-6"
          style={{ backgroundColor: C.divider }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width:           `${((step + 1) / TOTAL) * 100}%`,
              backgroundColor: C.accent,
            }}
          />
        </div>

        {/* ── Question ────────────────────────────────────────────── */}
        <div className="mb-6">
          <h2
            className="text-xl font-bold leading-tight mb-1"
            style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {q.q}
          </h2>
          {q.sub && (
            <p className="text-sm" style={{ color: C.muted }}>
              {q.sub}
            </p>
          )}
        </div>

        {/* ── Options / input ─────────────────────────────────────── */}
        <div className="flex-1 space-y-2.5">
          {q.type === "text" ? (
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, boxShadow: SHADOW }}
            >
              <input
                ref={inputRef}
                type="text"
                value={answers.home_airport}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, home_airport: e.target.value }))
                }
                placeholder={q.placeholder}
                autoFocus
                className="w-full text-base outline-none bg-transparent"
                style={{ color: C.text }}
              />
            </div>
          ) : q.type === "single" ? (
            q.options!.map((opt) => (
              <OptionCard
                key={String(opt.value)}
                option={opt}
                selected={String(selectedSingle) === String(opt.value)}
                onSelect={() => selectSingle(opt.value)}
                multi={false}
              />
            ))
          ) : (
            q.options!.map((opt) => (
              <OptionCard
                key={String(opt.value)}
                option={opt}
                selected={selectedMulti.includes(String(opt.value))}
                onSelect={() => toggleOption(String(opt.value))}
                multi
              />
            ))
          )}
        </div>

        {/* ── Save error ──────────────────────────────────────────── */}
        {saveError && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
          >
            <span className="font-semibold">Could not save: </span>{saveError}
          </div>
        )}

        {/* ── Bottom actions ──────────────────────────────────────── */}
        <div className="py-6 flex items-center gap-3">
          <button
            onClick={skip}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold transition-all"
            style={{
              backgroundColor: C.divider,
              color:           C.muted,
            }}
          >
            Skip
          </button>

          <button
            onClick={next}
            disabled={!canNext || saving}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
            style={{ backgroundColor: C.accent, color: "#FFFFFF" }}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : step === TOTAL - 1 ? (
              "Finish"
            ) : (
              <>Continue <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
