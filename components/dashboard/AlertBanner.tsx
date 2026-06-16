"use client";

import { useEffect } from "react";
import { X, AlertTriangle, Info, Zap, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store/useStore";
import type { Database } from "@/lib/supabase/types";

type Alert = Database["public"]["Tables"]["alerts"]["Row"];

const TYPE_META: Record<
  string,
  { Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; bg: string; border: string; textColor: string; iconColor: string }
> = {
  urgent:    { Icon: Zap,           bg: "rgba(239,68,68,0.06)",    border: "rgba(239,68,68,0.18)",   textColor: "#991B1B", iconColor: "#EF4444" },
  leave_now: { Icon: Clock,         bg: "rgba(245,158,11,0.06)",   border: "rgba(245,158,11,0.18)",  textColor: "#92400E", iconColor: "#F59E0B" },
  warning:   { Icon: AlertTriangle, bg: "rgba(245,158,11,0.05)",   border: "rgba(245,158,11,0.15)",  textColor: "#92400E", iconColor: "#F59E0B" },
  info:      { Icon: Info,          bg: "rgba(79,70,229,0.05)",    border: "rgba(79,70,229,0.15)",   textColor: "#3730A3", iconColor: "#4F46E5" },
};

interface Props {
  userId: string;
  tripId: string;
}

export function AlertBanner({ userId, tripId }: Props) {
  const alerts       = useStore((s) => s.alerts);
  const setAlerts    = useStore((s) => s.setAlerts);
  const dismissAlert = useStore((s) => s.dismissAlert);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("alerts")
      .select("*")
      .eq("user_id", userId)
      .eq("trip_id", tripId)
      .eq("delivered", false)
      .order("priority", { ascending: false })
      .then(({ data }) => { if (data) setAlerts(data); });
  }, [userId, tripId, setAlerts]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`alerts-${tripId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts", filter: `trip_id=eq.${tripId}` },
        (payload) => {
          const newAlert = payload.new as Alert;
          if (!newAlert.delivered) setAlerts([...alerts, newAlert]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tripId, alerts, setAlerts]);

  async function dismiss(alert: Alert) {
    dismissAlert(alert.id);
    const supabase = createClient();
    await supabase.from("alerts").update({ delivered: true }).eq("id", alert.id);
  }

  if (alerts.length === 0) return null;

  const top  = alerts[0];
  const meta = TYPE_META[top.type ?? "info"] ?? TYPE_META.info;
  const { Icon } = meta;

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-start gap-3"
      style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: meta.iconColor }} />
      <p className="text-sm flex-1 leading-relaxed" style={{ color: meta.textColor }}>
        {top.message}
      </p>
      <button
        onClick={() => dismiss(top)}
        className="shrink-0 transition-opacity hover:opacity-100 opacity-50"
      >
        <X className="h-4 w-4" style={{ color: meta.iconColor }} />
      </button>
    </div>
  );
}
