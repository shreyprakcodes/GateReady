"use client";

import { useState, useEffect } from "react";
import { X, Bell, AlertTriangle, CheckCircle, Plane, Clock, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AppNotification {
  id: string;
  type: "leave_now" | "traffic" | "tsa_drop" | "boarding" | "alarm" | "urgent" | "warning" | "info";
  title: string;
  subtitle: string;
  time: Date;
  dismissed: boolean;
}

const TYPE_META: Record<AppNotification["type"], { icon: React.ElementType; color: string; bg: string; border: string }> = {
  leave_now: { icon: Clock,          color: "#EF4444", bg: "rgba(239,68,68,0.06)",    border: "rgba(239,68,68,0.18)"   },
  traffic:   { icon: AlertTriangle,  color: "#EF4444", bg: "rgba(239,68,68,0.05)",    border: "rgba(239,68,68,0.15)"   },
  tsa_drop:  { icon: CheckCircle,    color: "#10B981", bg: "rgba(16,185,129,0.06)",   border: "rgba(16,185,129,0.18)"  },
  boarding:  { icon: Plane,          color: "#4F46E5", bg: "rgba(79,70,229,0.06)",    border: "rgba(79,70,229,0.18)"   },
  alarm:     { icon: Bell,           color: "#4F46E5", bg: "rgba(79,70,229,0.06)",    border: "rgba(79,70,229,0.18)"   },
  urgent:    { icon: AlertTriangle,  color: "#EF4444", bg: "rgba(239,68,68,0.06)",    border: "rgba(239,68,68,0.18)"   },
  warning:   { icon: AlertTriangle,  color: "#F59E0B", bg: "rgba(245,158,11,0.06)",   border: "rgba(245,158,11,0.18)"  },
  info:      { icon: Bell,           color: "#4F46E5", bg: "rgba(79,70,229,0.06)",    border: "rgba(79,70,229,0.18)"   },
};

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function mapAlertType(type: string | null): AppNotification["type"] {
  const t = (type ?? "").toLowerCase();
  if (t === "urgent" || t === "leave_now") return "leave_now";
  if (t === "warning") return "warning";
  return "info";
}

interface Props {
  userId: string;
  tripId?: string;
}

export function NotificationCenter({ userId, tripId }: Props) {
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [open, setOpen]     = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const query = supabase
      .from("alerts")
      .select("*")
      .eq("user_id", userId)
      .eq("delivered", false)
      .order("trigger_time", { ascending: false })
      .limit(20);

    query.then(({ data }) => {
      if (data) {
        setNotifs(
          data.map((a) => ({
            id: a.id,
            type: mapAlertType(a.type),
            title: a.message?.split("·")[0]?.trim() ?? "Alert",
            subtitle: a.message?.split("·").slice(1).join("·").trim() ?? "",
            time: new Date(a.trigger_time ?? Date.now()),
            dismissed: false,
          }))
        );
      }
    });

    const channel = supabase
      .channel(`notif-center-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts", filter: `user_id=eq.${userId}` },
        (payload) => {
          const a = payload.new as { id: string; type: string | null; message: string | null; trigger_time: string | null };
          setNotifs((prev) => [
            {
              id: a.id,
              type: mapAlertType(a.type),
              title: a.message?.split("·")[0]?.trim() ?? "Alert",
              subtitle: a.message?.split("·").slice(1).join("·").trim() ?? "",
              time: new Date(a.trigger_time ?? Date.now()),
              dismissed: false,
            },
            ...prev,
          ]);
          setOpen(true);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, tripId]);

  function dismiss(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    const supabase = createClient();
    supabase.from("alerts").update({ delivered: true }).eq("id", id);
  }

  function dismissAll() {
    const supabase = createClient();
    const ids = notifs.map((n) => n.id);
    setNotifs([]);
    if (ids.length) supabase.from("alerts").update({ delivered: true }).in("id", ids);
  }

  const unread = notifs.length;

  return (
    <>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl transition-all"
        style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8" }}
      >
        {unread > 0 ? (
          <Bell className="h-5 w-5" style={{ color: "#F59E0B" }} />
        ) : (
          <BellOff className="h-5 w-5" style={{ color: "#9CA3AF" }} />
        )}
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{ backgroundColor: "#EF4444", color: "#FFFFFF" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ backgroundColor: "rgba(26,26,46,0.45)", backdropFilter: "blur(12px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md mx-auto mt-16 flex flex-col max-h-[75vh] rounded-3xl overflow-hidden"
            style={{ margin: "64px 16px 0", maxWidth: "calc(100% - 32px)", backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 shrink-0" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <p className="text-sm font-bold" style={{ color: "#1A1A2E" }}>
                Notifications{" "}
                {unread > 0 && <span className="font-normal" style={{ color: "#9CA3AF" }}>· {unread}</span>}
              </p>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={dismissAll} className="text-xs font-medium" style={{ color: "#9CA3AF" }}>
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8", color: "#6B7280" }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto space-y-2 p-4 pb-6">
              {notifs.length === 0 ? (
                <div className="py-12 text-center">
                  <BellOff className="h-8 w-8 mx-auto mb-3" style={{ color: "#E5E1D8" }} />
                  <p className="text-sm" style={{ color: "#9CA3AF" }}>No notifications</p>
                </div>
              ) : (
                notifs.map((n) => <NotifCard key={n.id} notif={n} onDismiss={dismiss} />)
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NotifCard({ notif, onDismiss }: { notif: AppNotification; onDismiss: (id: string) => void }) {
  const meta = TYPE_META[notif.type];
  const Icon = meta.icon;
  const [swiping, setSwiping] = useState(false);

  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3 transition-all duration-300"
      style={{
        backgroundColor: meta.bg,
        border: `1px solid ${meta.border}`,
        opacity: swiping ? 0 : 1,
        transform: swiping ? "translateX(60px)" : "none",
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${meta.color}12` }}
      >
        <Icon className="h-4 w-4" style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: "#1A1A2E" }}>{notif.title}</p>
        {notif.subtitle && (
          <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>{notif.subtitle}</p>
        )}
        <p className="text-[10px] mt-1" style={{ color: "#9CA3AF" }}>{timeAgo(notif.time)}</p>
      </div>
      <button
        onClick={() => { setSwiping(true); setTimeout(() => onDismiss(notif.id), 300); }}
        className="p-1 rounded-lg shrink-0"
        style={{ color: "#9CA3AF" }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
