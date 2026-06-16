"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, UserPlus, Phone, Shield, Eye,
  Mail, Loader2, CheckCircle2, Trash2, AlertCircle,
  Lock, Bell, ChevronDown, ChevronRight, AlertTriangle,
} from "lucide-react";
import type { FamilyLink, MonitoredTrip } from "./page";
import type { ParentalSettings } from "@/lib/supabase/types";

interface Props {
  userId: string;
  initialLinks: FamilyLink[];
  initialMonitoredTrips: MonitoredTrip[];
}

const PERMISSIONS = [
  { id: "view_trip",  label: "View trip",      icon: Eye },
  { id: "view_live",  label: "Live location",  icon: Eye },
  { id: "parental",   label: "Parental alerts", icon: Shield },
];

interface MemberTrip {
  id: string;
  flight_number: string | null;
  airline: string | null;
  origin: string | null;
  destination: string | null;
  departure_time: string | null;
  status: string;
  parental_mode: boolean;
  parental_settings: Record<string, unknown> | null;
}

interface OverdueAlert {
  tripId: string;
  stepId: string;
  stepLabel: string;
  stepTime: string;
  minutesOverdue: number;
}

export function FamilyClient({ userId, initialLinks, initialMonitoredTrips }: Props) {
  const [links, setLinks]       = useState<FamilyLink[]>(initialLinks);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const [overdueAlerts, setOverdueAlerts] = useState<OverdueAlert[]>([]);
  const [monitoredTrips] = useState<MonitoredTrip[]>(initialMonitoredTrips);

  // Poll for overdue steps
  const checkSteps = useCallback(async () => {
    if (monitoredTrips.length === 0) return;
    try {
      const res = await fetch("/api/family/check-steps", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.overdueAlerts?.length) {
          setOverdueAlerts((prev) => {
            const ids = new Set(prev.map((a) => a.stepId));
            const fresh = (data.overdueAlerts as OverdueAlert[]).filter((a) => !ids.has(a.stepId));
            return [...prev, ...fresh];
          });
        }
      }
    } catch { /* non-fatal */ }
  }, [monitoredTrips.length]);

  useEffect(() => {
    checkSteps();
    const interval = setInterval(checkSteps, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkSteps]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    try {
      const res = await fetch("/api/family/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      if (res.ok) {
        setInviteSent(true);
        setInviteEmail("");
        setTimeout(() => setInviteSent(false), 3000);
      } else {
        const body = await res.json();
        setInviteError(body.error ?? "Invite failed");
      }
    } catch {
      setInviteError("Network error. Try again.");
    } finally {
      setInviting(false);
    }
  }

  async function removeLink(linkId: string) {
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    await fetch(`/api/family/link/${linkId}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-6">
      {/* ── Overdue alerts ─────────────────────────────────────── */}
      {overdueAlerts.length > 0 && (
        <div
          className="rounded-2xl p-4 space-y-2"
          style={{ backgroundColor: "rgba(255,75,110,0.08)", border: "1px solid rgba(255,75,110,0.25)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4" style={{ color: "#EF4444" }} />
            <p className="text-sm font-semibold" style={{ color: "#EF4444" }}>Step overdue</p>
          </div>
          {overdueAlerts.map((a) => (
            <div key={a.stepId} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#1A1A2E]">{a.stepLabel}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "#EF4444" }}>
                  {a.minutesOverdue} min overdue · due {new Date(a.stepTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <button
                onClick={() => setOverdueAlerts((p) => p.filter((x) => x.stepId !== a.stepId))}
                className="text-[11px] shrink-0 mt-1"
                style={{ color: "#6B7280" }}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Family Members ─────────────────────────────────────── */}
      <Section title="Family Members" sub="People who can follow your trip">
        {links.length > 0 && (
          <div className="space-y-2 mb-4">
            {links.map((link) => (
              <MemberCard key={link.id} link={link} onRemove={removeLink} />
            ))}
          </div>
        )}

        <form onSubmit={sendInvite} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#6B7280" }} />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="family@example.com"
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1A1A2E] outline-none"
              style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#4F46E5")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "#E5E1D8")}
            />
          </div>

          {inviteError && (
            <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2"
              style={{ backgroundColor: "rgba(255,75,110,0.10)", color: "#EF4444", border: "1px solid rgba(255,75,110,0.20)" }}>
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {inviteError}
            </div>
          )}

          <button
            type="submit"
            disabled={!inviteEmail.trim() || inviting}
            className="w-full rounded-2xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            style={{ backgroundColor: inviteSent ? "#10B981" : "#4F46E5", color: "#F7F5F0" }}
          >
            {inviting   ? <Loader2 className="h-4 w-4 animate-spin" /> :
             inviteSent ? <CheckCircle2 className="h-4 w-4" /> :
                          <UserPlus className="h-4 w-4" />}
            {inviting ? "Sending…" : inviteSent ? "Invite sent!" : "Send Invite"}
          </button>
        </form>
      </Section>

      {/* ── Share Settings ─────────────────────────────────────── */}
      <Section title="Share Settings" sub="What family members can see">
        <div className="space-y-2">
          {PERMISSIONS.map(({ id, label, icon: Icon }) => (
            <div
              key={id}
              className="flex items-center justify-between rounded-xl p-3"
              style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8" }}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" style={{ color: "#6B7280" }} />
                <p className="text-xs font-medium text-[#1A1A2E]">{label}</p>
              </div>
              <Toggle defaultOn />
            </div>
          ))}
        </div>
      </Section>

      {/* ── Parental Mode ──────────────────────────────────────── */}
      <Section title="Parental Mode" sub="Monitor a young traveler's trip">
        {monitoredTrips.length > 0 && (
          <div className="space-y-3 mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#6B7280" }}>
              Currently monitoring
            </p>
            {monitoredTrips.map((trip) => (
              <MonitoredTripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}

        {links.length === 0 ? (
          <p className="text-xs py-2 text-center" style={{ color: "#6B7280" }}>
            Add a family member above to enable parental mode.
          </p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <ParentalSetupRow key={link.id} link={link} userId={userId} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Parental Setup Row ───────────────────────────────────────────

function ParentalSetupRow({ link, userId }: { link: FamilyLink; userId: string }) {
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<MemberTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState("");
  const [settings, setSettings] = useState<Partial<ParentalSettings>>({
    dnd_vendors: false,
    alert_window_minutes: 30,
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const member = link.family_member;
  const display = member?.name ?? member?.email ?? "Family member";

  async function loadTrips() {
    if (trips.length > 0) { setOpen((o) => !o); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/family/member-trips?memberId=${link.family_member_id}`);
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips ?? []);
        if (data.trips?.length === 1) setSelectedTrip(data.trips[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function enableParentalMode() {
    if (!selectedTrip) return;
    setSaving(true);
    try {
      await fetch("/api/family/setup-child", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: selectedTrip,
          childUserId: link.family_member_id,
          settings,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E1D8" }}>
      <button
        onClick={loadTrips}
        className="w-full flex items-center gap-3 p-3 transition-all"
        style={{ backgroundColor: "#F7F5F0" }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: "rgba(0,212,184,0.12)", color: "#4F46E5" }}
        >
          {display.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-semibold text-[#1A1A2E]">{display}</p>
          <p className="text-[11px]" style={{ color: "#6B7280" }}>
            {saved ? "✓ Parental mode enabled" : "Set up parental mode"}
          </p>
        </div>
        <Shield className="h-4 w-4 shrink-0" style={{ color: open ? "#4F46E5" : "#9CA3AF" }} />
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: "#6B7280" }} />
               : <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: "#6B7280" }} />}
      </button>

      {open && (
        <div className="px-3 pb-4 pt-2 space-y-3" style={{ backgroundColor: "#F7F5F0", borderTop: "1px solid #E5E1D8" }}>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#4F46E5" }} />
            </div>
          ) : trips.length === 0 ? (
            <p className="text-xs py-2" style={{ color: "#6B7280" }}>
              {display} has no upcoming trips yet.
            </p>
          ) : (
            <>
              {/* Trip picker */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#6B7280" }}>
                  Trip to monitor
                </p>
                <div className="space-y-1.5">
                  {trips.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTrip(t.id)}
                      className="w-full rounded-xl px-3 py-2 text-left transition-all"
                      style={{
                        backgroundColor: selectedTrip === t.id ? "rgba(0,212,184,0.10)" : "#FFFFFF",
                        border: `1px solid ${selectedTrip === t.id ? "#4F46E5" : "#E5E1D8"}`,
                      }}
                    >
                      <p className="text-xs font-semibold text-[#1A1A2E]">
                        {t.airline ?? ""} {t.flight_number ?? "—"} · {t.origin} → {t.destination}
                      </p>
                      {t.departure_time && (
                        <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>
                          {new Date(t.departure_time).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Emergency contact */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#6B7280" }}>
                  Emergency contact (shown to {display})
                </p>
                <div className="space-y-2">
                  <input
                    value={settings.emergency_contact_name ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, emergency_contact_name: e.target.value }))}
                    placeholder="Your name"
                    className="w-full rounded-xl px-3 py-2 text-sm text-[#1A1A2E] outline-none"
                    style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8" }}
                  />
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "#6B7280" }} />
                    <input
                      value={settings.emergency_contact_phone ?? ""}
                      onChange={(e) => setSettings((s) => ({ ...s, emergency_contact_phone: e.target.value }))}
                      placeholder="+1 (555) 000-0000"
                      type="tel"
                      className="w-full rounded-xl pl-9 pr-3 py-2 text-sm text-[#1A1A2E] outline-none"
                      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8" }}
                    />
                  </div>
                </div>
              </div>

              {/* Alert window */}
              <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8" }}>
                <div className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5" style={{ color: "#F59E0B" }} />
                  <p className="text-xs text-[#1A1A2E]">Alert after</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={settings.alert_window_minutes ?? 30}
                    onChange={(e) => setSettings((s) => ({ ...s, alert_window_minutes: Number(e.target.value) }))}
                    className="w-14 rounded-lg px-2 py-1 text-xs text-[#1A1A2E] text-right outline-none"
                    style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8" }}
                  />
                  <span className="text-xs" style={{ color: "#6B7280" }}>min overdue</span>
                </div>
              </div>

              {/* DND vendors */}
              <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8" }}>
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5" style={{ color: "#F59E0B" }} />
                  <div>
                    <p className="text-xs text-[#1A1A2E]">Do Not Disturb</p>
                    <p className="text-[10px]" style={{ color: "#6B7280" }}>Lock food stops feature</p>
                  </div>
                </div>
                <Toggle
                  defaultOn={settings.dnd_vendors ?? false}
                  onChange={(v) => setSettings((s) => ({ ...s, dnd_vendors: v }))}
                  color="#F59E0B"
                />
              </div>

              <button
                onClick={enableParentalMode}
                disabled={!selectedTrip || saving}
                className="w-full rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ backgroundColor: saved ? "#10B981" : "#4F46E5", color: "#F7F5F0" }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> :
                 saved  ? <CheckCircle2 className="h-4 w-4" /> :
                          <Shield className="h-4 w-4" />}
                {saving ? "Enabling…" : saved ? "Parental mode enabled!" : "Enable Parental Mode"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Monitored trip card (parent view) ───────────────────────────

function MonitoredTripCard({ trip }: { trip: MonitoredTrip }) {
  const settings = (trip.parental_settings ?? {}) as Partial<ParentalSettings>;
  return (
    <div
      className="rounded-2xl p-3"
      style={{ backgroundColor: "rgba(0,212,184,0.06)", border: "1px solid rgba(0,212,184,0.2)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#1A1A2E]">
          {trip.airline ?? ""} {trip.flight_number ?? "—"} · {trip.origin} → {trip.destination}
        </p>
        <span
          className="text-[10px] font-semibold rounded-full px-2 py-0.5"
          style={{ backgroundColor: "rgba(0,212,184,0.15)", color: "#4F46E5" }}
        >
          Monitoring
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        {settings.dnd_vendors && (
          <span className="flex items-center gap-1 text-[10px]" style={{ color: "#F59E0B" }}>
            <Lock className="h-3 w-3" /> DND on
          </span>
        )}
        {settings.alert_window_minutes && (
          <span className="flex items-center gap-1 text-[10px]" style={{ color: "#6B7280" }}>
            <Bell className="h-3 w-3" /> Alert after {settings.alert_window_minutes}min
          </span>
        )}
      </div>
    </div>
  );
}

// ── Shared components ────────────────────────────────────────────

function Toggle({ defaultOn, onChange, color = "#4F46E5" }: { defaultOn?: boolean; onChange?: (v: boolean) => void; color?: string }) {
  const [on, setOn] = useState(defaultOn ?? false);
  function toggle() {
    const next = !on;
    setOn(next);
    onChange?.(next);
  }
  return (
    <button
      onClick={toggle}
      className="w-9 h-5 rounded-full relative transition-all shrink-0"
      style={{ backgroundColor: on ? color : "#E5E1D8" }}
    >
      <div
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
        style={{ left: on ? "calc(100% - 18px)" : "2px" }}
      />
    </button>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl p-5 space-y-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8" }}>
      <div>
        <p className="text-sm font-bold" style={{ fontFamily: "var(--font-inter), sans-serif", color: "#1A1A2E" }}>
          {title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{sub}</p>
      </div>
      {children}
    </div>
  );
}

function MemberCard({ link, onRemove }: { link: FamilyLink; onRemove: (id: string) => void }) {
  const member = link.family_member;
  const display = member?.name ?? member?.email ?? "Family member";
  const initials = display.slice(0, 2).toUpperCase();

  return (
    <div
      className="flex items-center gap-3 rounded-xl p-3"
      style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8" }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ backgroundColor: "rgba(0,212,184,0.15)", color: "#4F46E5" }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#1A1A2E] truncate">{display}</p>
        <p className="text-[11px]" style={{ color: "#6B7280" }}>
          {(link.permissions ?? []).join(", ") || "View only"}
        </p>
      </div>
      <button
        onClick={() => onRemove(link.id)}
        className="p-1.5 rounded-lg transition-all"
        style={{ color: "#9CA3AF" }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
