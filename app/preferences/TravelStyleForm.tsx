"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";

const C = {
  bg:             "#FAF7F2",
  card:           "#FFFFFF",
  text:           "#1A1A2E",
  muted:          "#8B8070",
  faint:          "#B5A89A",
  border:         "#E8E0D5",
  divider:        "#F0EDE8",
  accent:         "#4F46E5",
  selected:       "#EDE9FE",
  selectedBorder: "#C4B5FD",
} as const;

const SHADOW = "0 2px 16px rgba(0,0,0,0.06)";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TravelStyleValues {
  arrival_buffer_minutes: number;
  travel_frequency:       string;
  trip_scope:             string;
  travels_with:           string;
  travel_stressors:       string[];
  home_airport:           string;
}

interface Props {
  initialValues: TravelStyleValues;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-2">
      <p className="text-sm font-semibold" style={{ color: C.text }}>{label}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</p>}
    </div>
  );
}

function PillGroup<T extends string | number>({
  options, value, onChange,
}: {
  options: { value: T; label: string; emoji?: string }[];
  value:   T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const sel = String(value) === String(opt.value);
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              backgroundColor: sel ? C.selected : C.card,
              border:          `1.5px solid ${sel ? C.selectedBorder : C.border}`,
              color:           sel ? C.accent : C.text,
            }}
          >
            {opt.emoji && <span>{opt.emoji}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function MultiPill({
  options, values, onChange,
}: {
  options: { value: string; label: string; emoji?: string }[];
  values:  string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(v: string) {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const sel = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              backgroundColor: sel ? C.selected : C.card,
              border:          `1.5px solid ${sel ? C.selectedBorder : C.border}`,
              color:           sel ? C.accent : C.text,
            }}
          >
            {opt.emoji && <span>{opt.emoji}</span>}
            {opt.label}
            {sel && <CheckCircle2 className="h-3 w-3" />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function TravelStyleForm({ initialValues }: Props) {
  const [values,   setValues]  = useState<TravelStyleValues>(initialValues);
  const [dirty,    setDirty]   = useState(false);
  const [saving,   setSaving]  = useState(false);
  const [saved,    setSaved]   = useState(false);
  const [saveErr,  setSaveErr] = useState<string | null>(null);

  useEffect(() => { setValues(initialValues); }, [JSON.stringify(initialValues)]);

  function update<K extends keyof TravelStyleValues>(key: K, val: TravelStyleValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
    setSaved(false);
  }

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          arrival_buffer_minutes: values.arrival_buffer_minutes,
          travel_frequency:       values.travel_frequency || null,
          trip_scope:             values.trip_scope       || null,
          travels_with:           values.travels_with     || null,
          travel_stressors:       values.travel_stressors.length > 0 ? values.travel_stressors : [],
          home_airport:           values.home_airport.trim().toUpperCase() || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setSaveErr(json.error ?? `Save failed (${res.status})`);
        return;
      }
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }, [values]);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
    >
      <div className="px-5 pt-5 pb-1">
        <p className="text-sm font-bold" style={{ color: C.text }}>Travel Style</p>
        <p className="text-xs mt-0.5" style={{ color: C.muted }}>Set once from onboarding or adjust anytime</p>
      </div>

      <div className="px-5 py-4 space-y-5" style={{ borderTop: `1px solid ${C.divider}` }}>

        {/* Arrival buffer */}
        <div>
          <FieldLabel label="Arrive at airport" sub="Your preferred buffer before departure" />
          <PillGroup<number>
            options={[
              { value: 45, label: "Way early",   emoji: "🛋️" },
              { value: 25, label: "Comfortable", emoji: "✈️" },
              { value: 10, label: "Cut it close", emoji: "⚡" },
            ]}
            value={values.arrival_buffer_minutes}
            onChange={(v) => update("arrival_buffer_minutes", v)}
          />
        </div>

        {/* Frequency */}
        <div>
          <FieldLabel label="How often do you fly?" />
          <PillGroup<string>
            options={[
              { value: "rarely",     label: "Rarely",       emoji: "🌱" },
              { value: "sometimes",  label: "Sometimes",    emoji: "✈️" },
              { value: "frequently", label: "Frequently",   emoji: "🏆" },
            ]}
            value={values.travel_frequency}
            onChange={(v) => update("travel_frequency", v)}
          />
        </div>

        {/* Scope */}
        <div>
          <FieldLabel label="Where do you mostly travel?" />
          <PillGroup<string>
            options={[
              { value: "domestic",      label: "Domestic",      emoji: "🏠" },
              { value: "international", label: "International", emoji: "🌍" },
              { value: "both",          label: "Both",          emoji: "🗺️" },
            ]}
            value={values.trip_scope}
            onChange={(v) => update("trip_scope", v)}
          />
        </div>

        {/* Companions */}
        <div>
          <FieldLabel label="Who do you usually travel with?" />
          <PillGroup<string>
            options={[
              { value: "solo",    label: "Solo",           emoji: "🎒" },
              { value: "partner", label: "Partner",        emoji: "💑" },
              { value: "family",  label: "With family",    emoji: "👨‍👩‍👧" },
              { value: "mixed",   label: "Groups / mixed", emoji: "👥" },
            ]}
            value={values.travels_with}
            onChange={(v) => update("travels_with", v)}
          />
        </div>

        {/* Stressors */}
        <div>
          <FieldLabel label="Travel-day stressors" sub="Select all that apply" />
          <MultiPill
            options={[
              { value: "delays",         label: "Delays",         emoji: "⏳" },
              { value: "security_lines", label: "Security lines", emoji: "🔒" },
              { value: "traffic",        label: "Traffic",        emoji: "🚗" },
              { value: "when_to_leave",  label: "When to leave",  emoji: "⏰" },
              { value: "gate_changes",   label: "Gate changes",   emoji: "🚪" },
            ]}
            values={values.travel_stressors}
            onChange={(v) => update("travel_stressors", v)}
          />
        </div>

        {/* Home airport */}
        <div>
          <FieldLabel label="Home airport or city" />
          <input
            type="text"
            value={values.home_airport}
            onChange={(e) => update("home_airport", e.target.value)}
            placeholder="e.g. LAX, SFO, Chicago…"
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
            style={{
              backgroundColor: C.bg,
              border:          `1.5px solid ${C.border}`,
              color:           C.text,
            }}
          />
        </div>

      </div>

      {/* Save footer */}
      <div
        className="px-5 py-4 space-y-2"
        style={{ borderTop: `1px solid ${C.divider}` }}
      >
        {saveErr && (
          <p className="text-xs text-center" style={{ color: "#DC2626" }}>{saveErr}</p>
        )}
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "#10B981" }}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ backgroundColor: C.accent, color: "#FFFFFF" }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
