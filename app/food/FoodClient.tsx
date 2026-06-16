"use client";

import { useState } from "react";
import { ArrowLeft, Star, Clock, MapPin, ChevronRight, Coffee, Utensils, Leaf, DollarSign, Lock } from "lucide-react";
import Link from "next/link";
import { BottomNav } from "@/components/dashboard/BottomNav";

interface FoodStop {
  id: string; name: string; type: string; cuisine: string;
  rating: number; price: 1 | 2 | 3; detourMin?: number;
  openNow: boolean; section: "route" | "airport"; emoji: string;
  tags: string[];
}

const STOPS: FoodStop[] = [
  { id: "1", name: "Starbucks", type: "coffee", cuisine: "Coffee & Tea", rating: 4.2, price: 2, detourMin: 3, openNow: true, section: "route", emoji: "☕", tags: ["coffee", "quick"] },
  { id: "2", name: "Dunkin'", type: "coffee", cuisine: "Coffee & Donuts", rating: 4.0, price: 1, detourMin: 2, openNow: true, section: "route", emoji: "☕", tags: ["coffee", "budget"] },
  { id: "3", name: "Chipotle", type: "food", cuisine: "Mexican", rating: 4.3, price: 2, detourMin: 5, openNow: true, section: "route", emoji: "🌯", tags: ["food", "quick"] },
  { id: "4", name: "Shake Shack", type: "food", cuisine: "Burgers", rating: 4.5, price: 3, detourMin: 8, openNow: true, section: "route", emoji: "🍔", tags: ["food"] },
  { id: "5", name: "Terminal B Café", type: "coffee", cuisine: "Coffee & Pastries", rating: 3.8, price: 2, openNow: true, section: "airport", emoji: "☕", tags: ["coffee", "airport"] },
  { id: "6", name: "Ippudo Ramen", type: "food", cuisine: "Japanese", rating: 4.4, price: 3, openNow: true, section: "airport", emoji: "🍜", tags: ["food", "airport"] },
  { id: "7", name: "Sweetgreen", type: "food", cuisine: "Salads", rating: 4.2, price: 2, openNow: false, section: "airport", emoji: "🥗", tags: ["food", "healthy", "vegetarian"] },
  { id: "8", name: "OTG Express", type: "food", cuisine: "American", rating: 3.9, price: 2, openNow: true, section: "airport", emoji: "🥙", tags: ["food", "airport", "quick"] },
];

const FILTERS = [
  { id: "coffee",     label: "Coffee",  Icon: Coffee },
  { id: "food",       label: "Food",    Icon: Utensils },
  { id: "vegetarian", label: "Healthy", Icon: Leaf },
  { id: "budget",     label: "Budget",  Icon: DollarSign },
  { id: "quick",      label: "Quick",   Icon: Clock },
];

interface Props {
  locked?: boolean;
}

export function FoodClient({ locked = false }: Props) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [scenic, setScenic] = useState(false);

  function toggle(id: string) {
    if (locked) return;
    const next = new Set(activeFilters);
    if (next.has(id)) next.delete(id); else next.add(id);
    setActiveFilters(next);
  }

  const filtered = STOPS.filter((s) => {
    if (activeFilters.size === 0) return true;
    return [...activeFilters].some((f) => s.tags.includes(f));
  });

  const routeStops   = filtered.filter((s) => s.section === "route");
  const airportStops = filtered.filter((s) => s.section === "airport");

  return (
    <>
      <main className="flex flex-col min-h-screen max-w-md mx-auto px-4 pt-6 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="p-2 rounded-xl transition-all"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", color: "#6B7280" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-inter), sans-serif", color: "#1A1A2E" }}>
              Food Stops
            </h1>
            <p className="text-xs font-medium mt-0.5" style={{ color: "#6B7280" }}>
              En route + at the airport
            </p>
          </div>
          {!locked && (
            <button
              onClick={() => setScenic((s) => !s)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                backgroundColor: scenic ? "rgba(39,217,143,0.12)" : "#FFFFFF",
                border: `1px solid ${scenic ? "#10B981" : "#E5E1D8"}`,
                color: scenic ? "#10B981" : "#6B7280",
              }}
            >
              🌿 Scenic
            </button>
          )}
        </div>

        {/* DND lock banner */}
        {locked && (
          <div
            className="rounded-2xl px-4 py-3 mb-5 flex items-center gap-3"
            style={{ backgroundColor: "rgba(255,171,46,0.10)", border: "1px solid rgba(255,171,46,0.25)" }}
          >
            <Lock className="h-4 w-4 shrink-0" style={{ color: "#F59E0B" }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: "#F59E0B" }}>Food stops restricted</p>
              <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>
                A parent has turned on Do Not Disturb mode. Stay on schedule.
              </p>
            </div>
          </div>
        )}

        {/* Filter chips */}
        {!locked && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-5 scrollbar-none">
            {FILTERS.map(({ id, label, Icon }) => {
              const on = activeFilters.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggle(id)}
                  className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shrink-0 transition-all"
                  style={{
                    backgroundColor: on ? "rgba(0,212,184,0.12)" : "#FFFFFF",
                    border: `1px solid ${on ? "#4F46E5" : "#E5E1D8"}`,
                    color: on ? "#4F46E5" : "#6B7280",
                  }}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Content — blurred/disabled when locked */}
        <div style={{ opacity: locked ? 0.35 : 1, pointerEvents: locked ? "none" : "auto", filter: locked ? "blur(2px)" : "none" }}>
          {routeStops.length > 0 && (
            <section className="mb-6">
              <SectionHeader label="En Route" sub="On the way to the airport" />
              <div className="space-y-3 mt-3">
                {routeStops.map((stop) => <StopCard key={stop.id} stop={stop} />)}
              </div>
            </section>
          )}

          {airportStops.length > 0 && (
            <section>
              <SectionHeader label="At the Airport" sub="After security · pre-boarding" />
              <div className="space-y-3 mt-3">
                {airportStops.map((stop) => <StopCard key={stop.id} stop={stop} />)}
              </div>
            </section>
          )}

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-[#1A1A2E] mb-1">No stops match your filters</p>
              <p className="text-xs" style={{ color: "#6B7280" }}>Try removing a filter</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </>
  );
}

function SectionHeader({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <p className="text-sm font-bold" style={{ fontFamily: "var(--font-inter), sans-serif", color: "#1A1A2E" }}>
        {label}
      </p>
      <p className="text-xs" style={{ color: "#6B7280" }}>{sub}</p>
    </div>
  );
}

function StopCard({ stop }: { stop: FoodStop }) {
  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3 transition-all"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E1D8",
        opacity: stop.openNow ? 1 : 0.5,
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ backgroundColor: "#F7F5F0" }}
      >
        {stop.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-[#1A1A2E] truncate" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
            {stop.name}
          </p>
          {!stop.openNow && (
            <span className="text-[10px] font-medium shrink-0" style={{ color: "#EF4444" }}>Closed</span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{stop.cuisine}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3" style={{ color: "#F59E0B" }} />
            <span className="text-xs font-medium" style={{ color: "#F59E0B" }}>{stop.rating}</span>
          </div>
          <span className="text-xs" style={{ color: "#6B7280" }}>{"$".repeat(stop.price)}</span>
          {stop.detourMin && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" style={{ color: "#6B7280" }} />
              <span className="text-xs" style={{ color: "#6B7280" }}>+{stop.detourMin} min</span>
            </div>
          )}
          {stop.section === "airport" && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" style={{ color: "#6B7280" }} />
              <span className="text-xs" style={{ color: "#6B7280" }}>Terminal</span>
            </div>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#9CA3AF" }} />
    </div>
  );
}
