"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Link2, RefreshCw, Share2 } from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────

const NAVY = "#07101F";
const TEAL = "#00D4B8";

// ─── Types ────────────────────────────────────────────────────────

interface Props {
  tripId:              string;
  initialShareEnabled: boolean;
  initialToken:        string | null;
}

// ─── Component ────────────────────────────────────────────────────

export function SharePanel({ tripId, initialShareEnabled, initialToken }: Props) {
  const [enabled, setEnabled] = useState(initialShareEnabled);
  const [token, setToken]     = useState(initialToken ?? "");
  const [saving, setSaving]   = useState(false);
  const [copied, setCopied]   = useState(false);

  const shareUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/s/${token}`
    : "";

  const patch = useCallback(async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/share`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = await res.json() as { trip?: { share_enabled: boolean; share_token: string } };
      if (json.trip) {
        setEnabled(json.trip.share_enabled);
        setToken(json.trip.share_token ?? "");
      }
    } finally {
      setSaving(false);
    }
  }, [tripId]);

  const toggleEnabled = () => patch({ share_enabled: !enabled });
  const regenerate    = () => patch({ regenerate: true });

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select input text
    }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: NAVY, boxShadow: `0 4px 24px rgba(0,212,184,0.07)` }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${TEAL}18` }}
          >
            <Share2 className="h-4 w-4" style={{ color: TEAL }} />
          </div>
          <div>
            <p
              className="text-sm font-bold"
              style={{ color: "#E2E8F0", fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Share live status
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "#4A6580" }}>
              Let family see your progress
            </p>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={toggleEnabled}
          disabled={saving}
          aria-label={enabled ? "Disable sharing" : "Enable sharing"}
          className="relative w-11 h-6 rounded-full transition-colors shrink-0"
          style={{
            backgroundColor: enabled ? TEAL : "#162030",
            opacity: saving ? 0.6 : 1,
          }}
        >
          <span
            className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform"
            style={{ transform: enabled ? "translateX(20px)" : "translateX(0)" }}
          />
        </button>
      </div>

      {/* Link section — visible when enabled */}
      {enabled && token && (
        <div className="px-5 pb-5 space-y-3" style={{ borderTop: "1px solid #162030" }}>
          <p
            className="text-[10px] font-bold uppercase tracking-widest pt-4"
            style={{ color: `${TEAL}80` }}
          >
            Your link
          </p>

          {/* URL pill */}
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: "#162030" }}
          >
            <Link2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#4A6580" }} />
            <span
              className="flex-1 text-xs truncate"
              style={{ color: "#94A3B8", fontFamily: "monospace" }}
            >
              {shareUrl}
            </span>
            <button
              onClick={copyLink}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
              style={{
                backgroundColor: copied ? `${TEAL}20` : `${TEAL}15`,
                color: copied ? TEAL : "#6B8DB0",
              }}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Regenerate */}
          <button
            onClick={regenerate}
            disabled={saving}
            className="flex items-center gap-1.5 text-[11px] font-medium transition-opacity"
            style={{ color: "#4A6580", opacity: saving ? 0.5 : 1 }}
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate link — disables the current one
          </button>
        </div>
      )}

      {/* Hint when disabled */}
      {!enabled && (
        <div className="px-5 pb-5">
          <p className="text-xs" style={{ color: "#4A6580" }}>
            Enable to generate a link you can send to family.
          </p>
        </div>
      )}
    </div>
  );
}
