"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Bell, User } from "lucide-react";
import { useStore } from "@/lib/store/useStore";

const P = "#1B6EF3";
const G = "#6B7A90";

export function BottomNav() {
  const pathname = usePathname();
  const trip = useStore((s) => s.trip);
  const timelineHref = trip ? `/trip/${trip.id}` : "/dashboard";

  const tabs = [
    { key: "trips",    label: "Trips",    href: "/dashboard", Icon: Home },
    { key: "timeline", label: "Timeline", href: timelineHref, Icon: CalendarDays },
    { key: "alerts",   label: "Alerts",   href: "/dashboard", Icon: Bell },
    { key: "profile",  label: "Profile",  href: "/profile",   Icon: User },
  ] as const;

  function active(key: string) {
    if (key === "trips")    return pathname === "/dashboard" || pathname === "/";
    if (key === "timeline") return pathname.startsWith("/trip/");
    if (key === "alerts")   return false;
    if (key === "profile")  return pathname.startsWith("/profile");
    return false;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E8ECF4",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.07)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-center justify-around max-w-md mx-auto" style={{ height: 64, paddingInline: 8 }}>
        {tabs.map(({ key, label, href, Icon }) => {
          const on = active(key);
          return (
            <Link
              key={key}
              href={href}
              className="flex flex-col items-center gap-1 flex-1 py-2"
            >
              <Icon strokeWidth={on ? 2.5 : 1.8} className="h-[22px] w-[22px]" style={{ color: on ? P : G }} />
              <span className="text-[10px] font-semibold leading-none" style={{ color: on ? P : G }}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
