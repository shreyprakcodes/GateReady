"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, BellOff, Clock, MapPin, Plane, X } from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────

const NAVY  = "#07101F";
const TEAL  = "#00D4B8";
const GRAY  = "#6B7A90"; // BottomNav inactive color

// ─── Types ────────────────────────────────────────────────────────

type NotifType = "delay" | "gate_change" | "cancellation" | "leave_soon";

interface DbNotification {
  id:         string;
  user_id:    string;
  trip_id:    string | null;
  type:       NotifType | string | null;
  title:      string | null;
  body:       string | null;
  read:       boolean;
  created_at: string;
}

// ─── Type config ─────────────────────────────────────────────────

const TYPE_CFG: Record<string, {
  icon:   React.ElementType;
  color:  string;
  bg:     string;
  border: string;
}> = {
  delay:        { icon: Clock,          color: "#F5A623", bg: "#F5A62318", border: "#F5A62330" },
  gate_change:  { icon: MapPin,         color: TEAL,      bg: `${TEAL}18`, border: `${TEAL}30` },
  cancellation: { icon: AlertTriangle,  color: "#FF4444", bg: "#FF444418", border: "#FF444430" },
  leave_soon:   { icon: Plane,          color: "#FF6B00", bg: "#FF6B0018", border: "#FF6B0030" },
};

const DEFAULT_CFG = { icon: Bell, color: GRAY, bg: "#162030", border: "#162030" };

function typeCfg(type: string | null | undefined) {
  return TYPE_CFG[type ?? ""] ?? DEFAULT_CFG;
}

// ─── Helpers ──────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ─── Main component ───────────────────────────────────────────────

export function NotificationCenter() {
  const [notifs, setNotifs]   = useState<DbNotification[]>([]);
  const [open, setOpen]       = useState(false);
  const intervalRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const json = await res.json() as { notifications: DbNotification[] };
      setNotifs(json.notifications ?? []);
    } catch {
      // network error — keep previous state
    }
  }, []);

  // Initial fetch + 30-second poll
  useEffect(() => {
    fetchNotifs();
    intervalRef.current = setInterval(fetchNotifs, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchNotifs]);

  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    // Optimistic update
    setNotifs((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, read: true } : n));
    try {
      await fetch("/api/notifications", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ids }),
      });
    } catch {
      // Revert is handled on next poll
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch("/api/notifications", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ all: true }),
      });
    } catch {
      // Revert on next poll
    }
  }, []);

  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <>
      {/* ── BottomNav tab trigger ──────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center gap-1 flex-1 py-2"
        aria-label="Alerts"
      >
        <div className="relative">
          <Bell
            strokeWidth={unreadCount > 0 ? 2.5 : 1.8}
            className="h-[22px] w-[22px]"
            style={{ color: unreadCount > 0 ? TEAL : GRAY }}
          />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-2 h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold"
              style={{ backgroundColor: "#FF4444", color: "#FFFFFF" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
        <span
          className="text-[10px] font-semibold leading-none"
          style={{ color: unreadCount > 0 ? TEAL : GRAY }}
        >
          Alerts
        </span>
      </button>

      {/* ── Panel overlay ─────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-center"
          style={{ backgroundColor: "rgba(7,16,31,0.72)", backdropFilter: "blur(12px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full flex flex-col overflow-hidden"
            style={{
              maxWidth: 448,
              margin: "64px 16px 0",
              maxHeight: "75vh",
              borderRadius: 24,
              backgroundColor: "#0D1B2E",
              border: "1px solid #162030",
              boxShadow: `0 8px 48px rgba(0,212,184,0.08)`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: "1px solid #162030" }}
            >
              <p
                className="text-sm font-bold"
                style={{
                  color: "#E2E8F0",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Alerts
                {unreadCount > 0 && (
                  <span className="ml-2 text-[11px] font-normal" style={{ color: "#4A6580" }}>
                    {unreadCount} unread
                  </span>
                )}
              </p>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-medium"
                    style={{ color: `${TEAL}CC` }}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: "#162030", color: "#6B8DB0" }}
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto px-4 py-3 pb-6 space-y-2">
              {notifs.length === 0 ? (
                <div className="py-14 text-center">
                  <BellOff
                    className="h-8 w-8 mx-auto mb-3"
                    style={{ color: "#162030" }}
                  />
                  <p className="text-sm" style={{ color: "#4A6580" }}>
                    All caught up
                  </p>
                </div>
              ) : (
                notifs.map((n) => (
                  <NotifCard key={n.id} notif={n} onMarkRead={markRead} />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Notification card ────────────────────────────────────────────

function NotifCard({
  notif,
  onMarkRead,
}: {
  notif:      DbNotification;
  onMarkRead: (ids: string[]) => void;
}) {
  const cfg  = typeCfg(notif.type);
  const Icon = cfg.icon;

  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3 cursor-pointer"
      style={{
        backgroundColor: notif.read ? "#0A1628" : cfg.bg,
        border:          `1px solid ${notif.read ? "#162030" : cfg.border}`,
        opacity:         notif.read ? 0.55 : 1,
        transition:      "opacity 0.2s, background-color 0.2s",
      }}
      onClick={() => { if (!notif.read) onMarkRead([notif.id]); }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${cfg.color}18` }}
      >
        <Icon className="h-4 w-4" style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-semibold leading-snug"
          style={{ color: "#E2E8F0" }}
        >
          {notif.title ?? "Flight Update"}
        </p>
        {notif.body && (
          <p
            className="text-[11px] mt-1 leading-relaxed"
            style={{ color: "#6B8DB0" }}
          >
            {notif.body}
          </p>
        )}
        <p className="text-[10px] mt-1.5" style={{ color: "#4A6580" }}>
          {timeAgo(notif.created_at)}
        </p>
      </div>
      {!notif.read && (
        <div
          className="w-2 h-2 rounded-full shrink-0 mt-1"
          style={{ backgroundColor: TEAL }}
          aria-label="Unread"
        />
      )}
    </div>
  );
}
