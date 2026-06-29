"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { computeReadiness } from "@/lib/readiness";
import type { ReadinessItem, TravelerProfile, LoungeAccess } from "@/lib/readiness";
import type { AirportFeatures } from "@/lib/airportFeatures";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  card:    "#FFFFFF",
  text:    "#1A1A2E",
  muted:   "#8B8070",
  faint:   "#B5A89A",
  border:  "#E8E0D5",
  divider: "#F0EDE8",
  bg:      "#FAF7F2",
  red:     "#DC2626",
  amber:   "#D97706",
  green:   "#059669",
  greenBg: "#E8FAF5",
  redBg:   "#FEE2E2",
  amberBg: "#FEF3C7",
} as const;

const SHADOW = "0 2px 16px rgba(0,0,0,0.06)";

const LEVEL_STYLES: Record<ReadinessItem["level"], { dot: string; bg: string; text: string }> = {
  required:    { dot: C.red,   bg: C.redBg,   text: C.red   },
  recommended: { dot: C.amber, bg: C.amberBg, text: C.amber },
  good:        { dot: C.green, bg: C.greenBg, text: C.green },
  info:        { dot: C.muted, bg: C.divider, text: C.muted },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-[10px] font-bold uppercase tracking-widest mb-4"
      style={{ color: "#4F46E5" }}
    >
      {children}
    </p>
  );
}

function CheckItem({
  item, checked, onToggle,
}: {
  item:     ReadinessItem;
  checked:  boolean;
  onToggle: () => void;
}) {
  const s = LEVEL_STYLES[item.level];
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-start gap-3 rounded-xl px-4 py-3 text-left transition-all active:scale-[0.99]"
      style={{
        backgroundColor: checked ? C.divider : s.bg,
        border: `1px solid ${checked ? C.border : "transparent"}`,
        opacity: checked ? 0.6 : 1,
      }}
    >
      {/* Dot / check */}
      <span
        className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
        style={{
          backgroundColor: checked ? C.border : s.dot,
          color: "#fff",
          fontWeight: 700,
        }}
      >
        {checked ? "✓" : ""}
      </span>

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold leading-snug"
          style={{ color: checked ? C.faint : C.text }}
        >
          {item.icon} {item.title}
        </p>
        {item.detail && (
          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: C.muted }}>
            {item.detail}
          </p>
        )}
      </div>
    </button>
  );
}

function LoungeRow({ la }: { la: LoungeAccess }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3"
      style={{
        backgroundColor: la.accessible ? C.greenBg : C.bg,
        border: `1px solid ${la.accessible ? "#BBF0DC" : C.border}`,
        opacity: la.accessible ? 1 : 0.65,
      }}
    >
      <span className="text-base shrink-0 mt-0.5">{la.accessible ? "🛋️" : "🔒"}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: C.text }}>
          {la.lounge.name}
        </p>
        {la.lounge.terminal && (
          <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>
            {la.lounge.terminal}
          </p>
        )}
        <p className="text-[11px] mt-0.5" style={{ color: la.accessible ? C.green : C.faint }}>
          {la.accessible
            ? `Accessible via ${NETWORK_LABEL[la.matchedNetwork!] ?? la.matchedNetwork}`
            : "Membership required"}
        </p>
      </div>
    </div>
  );
}

const NETWORK_LABEL: Record<string, string> = {
  priority_pass:   "Priority Pass",
  amex_centurion:  "Amex Centurion / Platinum",
  capital_one:     "Capital One Venture X",
  admirals_club:   "AA Admirals Club",
  delta_sky_club:  "Delta Sky Club",
  united_club:     "United Club",
  alaska_lounge:   "Alaska Airlines Lounge",
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  origin:      string | null;
  destination: string | null;
  tripId:      string;
}

export function TripReadinessCard({ origin, destination, tripId }: Props) {
  const [profile, setProfile]   = useState<TravelerProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [checked, setChecked]   = useState<Set<string>>(new Set());

  // Load profile
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) return;
      const json = await res.json() as { profile: TravelerProfile };
      setProfile(json.profile);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Load checked items from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`gateready:readiness:${tripId}`);
      if (raw) setChecked(new Set(JSON.parse(raw) as string[]));
    } catch { /* ignore */ }
  }, [tripId]);

  const toggleCheck = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try {
        localStorage.setItem(`gateready:readiness:${tripId}`, JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }, [tripId]);

  const { originFeatures, isInternational, reminders, loungeAccess } =
    computeReadiness(origin, destination, profile);

  if (!origin) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: C.card, boxShadow: SHADOW, border: `1px solid ${C.border}` }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        <p
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "#4F46E5" }}
        >
          Trip Readiness
        </p>
        <div className="flex items-center justify-between mt-1">
          <p
            className="text-base font-bold"
            style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {originFeatures
              ? originFeatures.city
              : origin}{isInternational === true ? " → International" : ""}
          </p>
          {loading && <Loader2 className="h-4 w-4 animate-spin" style={{ color: C.muted }} />}
        </div>
      </div>

      {/* ── Airport Info ─────────────────────────────────────────── */}
      {originFeatures && (
        <div className="px-5 pb-4" style={{ borderTop: `1px solid ${C.divider}` }}>
          <div className="pt-4">
            <SectionLabel>At {origin} Airport</SectionLabel>

            {/* PreCheck + CLEAR badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={
                  originFeatures.hasPreCheck
                    ? { backgroundColor: "#EDE9FE", color: "#7C3AED" }
                    : { backgroundColor: C.bg, color: C.faint }
                }
              >
                ✈️ TSA PreCheck {originFeatures.hasPreCheck ? "✓" : "✗"}
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={
                  originFeatures.hasClear
                    ? { backgroundColor: "#DBEAFE", color: "#1D4ED8" }
                    : { backgroundColor: C.bg, color: C.faint }
                }
              >
                👁️ CLEAR {originFeatures.hasClear ? "✓" : "✗"}
              </span>
            </div>

            {/* Lounges */}
            {originFeatures.lounges.length > 0 ? (
              <div className="space-y-2">
                {loungeAccess.map((la) => (
                  <LoungeRow key={la.lounge.name} la={la} />
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: C.muted }}>
                No major airline lounges at {origin}.
              </p>
            )}

            {originFeatures.notes && (
              <p className="text-[11px] mt-3 leading-relaxed" style={{ color: C.faint }}>
                {originFeatures.notes}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Before You Go ────────────────────────────────────────── */}
      {reminders.length > 0 && (
        <div className="px-5 pb-5" style={{ borderTop: `1px solid ${C.divider}` }}>
          <div className="pt-4">
            <SectionLabel>Before You Go</SectionLabel>
            <div className="space-y-2">
              {reminders.map((item) => (
                <CheckItem
                  key={item.id}
                  item={item}
                  checked={checked.has(item.id)}
                  onToggle={() => toggleCheck(item.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Unknown airport fallback ─────────────────────────────── */}
      {!originFeatures && !loading && (
        <div className="px-5 pb-5" style={{ borderTop: `1px solid ${C.divider}` }}>
          <div className="pt-4">
            <p className="text-sm" style={{ color: C.muted }}>
              Airport info for {origin} is not available yet.
            </p>
          </div>
        </div>
      )}

      {/* ── Profile link footer ──────────────────────────────────── */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderTop: `1px solid ${C.divider}` }}
      >
        <p className="text-[11px]" style={{ color: C.faint }}>
          {loading
            ? "Loading your travel profile…"
            : profile
              ? "Based on your travel profile"
              : "Set up your profile for personalized tips"}
        </p>
        <Link
          href="/profile"
          className="flex items-center gap-1 text-xs font-semibold shrink-0"
          style={{ color: "#4F46E5" }}
        >
          Update <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
