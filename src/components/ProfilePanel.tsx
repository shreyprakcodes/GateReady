"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X, ChevronRight, Clock, Settings, MapPin, Ticket, LogOut, Plus, Check, ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  useFamilyStore,
  AVATAR_COLORS,
  type FamilyRole,
  type AvatarColor,
} from "@/src/store/familyStore";

// ── Types ──────────────────────────────────────────────────────────

interface ProfilePanelProps {
  userEmail?: string;
}

type PanelSection = "main" | "familyTracking";

const ROLE_LABELS: Record<FamilyRole, string> = {
  parent: "Parent",
  adult:  "Adult",
  teen:   "Teen",
  child:  "Child",
};

const ROLE_COLORS: Record<FamilyRole, string> = {
  parent: "#4F46E5",
  adult:  "#10B981",
  teen:   "#6B7280",
  child:  "#F59E0B",
};

// ── Avatar helpers ─────────────────────────────────────────────────

function AvatarCircle({
  initials,
  color,
  size = 40,
  active = false,
}: {
  initials: string;
  color: string;
  size?: number;
  active?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold select-none shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}18`,
        border: `2px solid ${active ? color : `${color}44`}`,
        color,
        fontSize: size * 0.32,
        fontFamily: "var(--font-inter), sans-serif",
        transition: "border-color 200ms",
      }}
    >
      {initials}
    </div>
  );
}

// ── Add Member Modal ───────────────────────────────────────────────

function AddMemberModal({ onClose }: { onClose: () => void }) {
  const addMember = useFamilyStore((s) => s.addMember);
  const [name, setName]   = useState("");
  const [role, setRole]   = useState<FamilyRole>("adult");
  const [color, setColor] = useState<AvatarColor>(AVATAR_COLORS[1]);

  function deriveInitials(n: string) {
    return n.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "?";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addMember({
      name: name.trim(),
      avatarInitials: deriveInitials(name),
      avatarColor: color,
      role,
      isCurrentUser: false,
      flights: [],
      boardingPasses: [],
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(26,26,46,0.45)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 z-10"
        style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8", boxShadow: "0 -8px 40px rgba(0,0,0,0.12)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold" style={{ color: "#1A1A2E" }}>
            Add Family Member
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl"
            style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8", color: "#6B7280" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6B7280" }}>
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah"
              autoFocus
              className="w-full rounded-2xl px-4 py-2.5 text-sm outline-none"
              style={{
                backgroundColor: "#F7F5F0",
                border: "1px solid #E5E1D8",
                color: "#1A1A2E",
              }}
              onFocus={(e)  => (e.currentTarget.style.borderColor = "#4F46E5")}
              onBlur={(e)   => (e.currentTarget.style.borderColor = "#E5E1D8")}
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6B7280" }}>
              Role
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["parent", "adult", "teen", "child"] as FamilyRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className="rounded-xl py-2 text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: role === r ? `${ROLE_COLORS[r]}10` : "#F7F5F0",
                    border: `1px solid ${role === r ? ROLE_COLORS[r] : "#E5E1D8"}`,
                    color: role === r ? ROLE_COLORS[r] : "#6B7280",
                  }}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Avatar color */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "#6B7280" }}>
              Color
            </label>
            <div className="flex gap-2.5 items-center">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform"
                  style={{
                    backgroundColor: `${c}18`,
                    border: `2px solid ${color === c ? c : `${c}44`}`,
                    transform: color === c ? "scale(1.2)" : "scale(1)",
                  }}
                >
                  {color === c && <Check className="h-3.5 w-3.5" style={{ color: c }} />}
                </button>
              ))}
              <div className="ml-auto">
                <AvatarCircle initials={deriveInitials(name) || "?"} color={color} size={36} />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full rounded-2xl py-3 text-sm font-bold transition-opacity"
            style={{
              backgroundColor: "#4F46E5",
              color: "#FFFFFF",
              opacity: name.trim() ? 1 : 0.4,
            }}
          >
            Add Member
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────

export function ProfilePanel({ userEmail }: ProfilePanelProps) {
  const router  = useRouter();
  const supabase = createClient();

  const members         = useFamilyStore((s) => s.members);
  const activeMemberId  = useFamilyStore((s) => s.activeMemberId);
  const setActiveMember = useFamilyStore((s) => s.setActiveMember);
  const activeMember    = useFamilyStore((s) => s.getActiveMember());

  const [open, setOpen]                 = useState(false);
  const [section, setSection]           = useState<PanelSection>("main");
  const [showAddModal, setShowAddModal] = useState(false);

  const touchStartX = useRef(0);
  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.changedTouches[0].clientX - touchStartX.current > 72) close();
  }

  function close() {
    setOpen(false);
    setTimeout(() => setSection("main"), 300);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials    = activeMember?.avatarInitials ?? "ME";
  const avatarColor = activeMember?.avatarColor    ?? "#4F46E5";

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open profile"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <AvatarCircle initials={initials} color={avatarColor} size={38} active />
      </button>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          backgroundColor: "rgba(26,26,46,0.40)",
          backdropFilter: "blur(2px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={close}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{
          width: "min(100vw, 420px)",
          backgroundColor: "#FFFFFF",
          borderLeft: "1px solid #E5E1D8",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease",
          boxShadow: open ? "-8px 0 40px rgba(0,0,0,0.10)" : "none",
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {section === "main" ? (
          <MainSection
            members={members}
            activeMemberId={activeMemberId}
            currentUser={activeMember}
            userEmail={userEmail}
            onClose={close}
            onSetActive={setActiveMember}
            onAddMember={() => setShowAddModal(true)}
            onFamilyTracking={() => setSection("familyTracking")}
            onSignOut={handleSignOut}
            router={router}
          />
        ) : (
          <FamilyTrackingSection onBack={() => setSection("main")} />
        )}
      </div>

      {showAddModal && <AddMemberModal onClose={() => setShowAddModal(false)} />}
    </>
  );
}

// ── Main section ───────────────────────────────────────────────────

function MainSection({
  members, activeMemberId, currentUser, userEmail,
  onClose, onSetActive, onAddMember, onFamilyTracking, onSignOut, router,
}: {
  members: ReturnType<typeof useFamilyStore.getState>["members"];
  activeMemberId: string | null;
  currentUser: ReturnType<typeof useFamilyStore.getState>["members"][number] | null;
  userEmail?: string;
  onClose: () => void;
  onSetActive: (id: string) => void;
  onAddMember: () => void;
  onFamilyTracking: () => void;
  onSignOut: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const role = currentUser?.role ?? "parent";

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ backgroundColor: "#FFFFFF" }}>
      {/* Close row */}
      <div className="flex justify-end p-4 shrink-0">
        <button
          onClick={onClose}
          className="p-2 rounded-xl"
          style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8", color: "#6B7280" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Profile header */}
      <div className="flex flex-col items-center px-6 pb-6 shrink-0">
        <AvatarCircle
          initials={currentUser?.avatarInitials ?? "ME"}
          color={currentUser?.avatarColor ?? "#4F46E5"}
          size={72}
        />
        <h2 className="mt-3 text-xl font-bold" style={{ color: "#1A1A2E" }}>
          {currentUser?.name ?? "Me"}
        </h2>
        {userEmail && (
          <p className="text-xs mt-0.5 truncate max-w-full" style={{ color: "#9CA3AF" }}>
            {userEmail}
          </p>
        )}
        <div
          className="mt-2 px-3 py-1 rounded-full text-xs font-bold"
          style={{
            backgroundColor: `${ROLE_COLORS[role]}10`,
            border: `1px solid ${ROLE_COLORS[role]}33`,
            color: ROLE_COLORS[role],
          }}
        >
          {ROLE_LABELS[role]}
        </div>
      </div>

      <div className="mx-6 mb-5 shrink-0" style={{ height: 1, backgroundColor: "#E5E1D8" }} />

      {/* Family members */}
      <div className="px-6 mb-5 shrink-0">
        <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: "#9CA3AF" }}>
          Family Members
        </p>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => onSetActive(m.id)}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <AvatarCircle
                initials={m.avatarInitials}
                color={m.avatarColor}
                size={44}
                active={m.id === activeMemberId}
              />
              <span
                className="text-[10px] font-semibold max-w-[48px] truncate"
                style={{ color: m.id === activeMemberId ? m.avatarColor : "#9CA3AF" }}
              >
                {m.name}
              </span>
            </button>
          ))}
          <button onClick={onAddMember} className="flex flex-col items-center gap-1.5 shrink-0">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(79,70,229,0.06)", border: "2px dashed rgba(79,70,229,0.25)" }}
            >
              <Plus className="h-4 w-4" style={{ color: "#4F46E5" }} />
            </div>
            <span className="text-[10px] font-semibold" style={{ color: "#9CA3AF" }}>Add</span>
          </button>
        </div>
      </div>

      <div className="mx-6 mb-3 shrink-0" style={{ height: 1, backgroundColor: "#E5E1D8" }} />

      {/* Menu items */}
      <nav className="px-4 pb-6 flex-1 flex flex-col gap-1">
        <MenuItem icon={Clock}   label="Flight History"   onClick={() => { onClose(); router.push("/itinerary"); }} />
        <MenuItem icon={Settings} label="Settings"        onClick={() => { onClose(); router.push("/preferences"); }} />
        <MenuItem icon={MapPin}  label="Family Tracking"  badge="Soon" onClick={onFamilyTracking} />
        <MenuItem icon={Ticket}  label="Boarding Passes"  onClick={() => { onClose(); router.push("/boarding-passes"); }} />
        <div className="mt-auto pt-4">
          <div className="mx-2 mb-4" style={{ height: 1, backgroundColor: "#E5E1D8" }} />
          <MenuItem icon={LogOut} label="Sign Out" destructive onClick={onSignOut} />
        </div>
      </nav>
    </div>
  );
}

function MenuItem({
  icon: Icon, label, badge, destructive = false, onClick,
}: {
  icon: React.ElementType;
  label: string;
  badge?: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const color   = destructive ? "#EF4444" : "#6B7280";
  const hoverBg = destructive ? "rgba(239,68,68,0.05)" : "#F7F5F0";

  return (
    <button
      onClick={onClick}
      onMouseEnter={(e)  => (e.currentTarget.style.backgroundColor = hoverBg)}
      onMouseLeave={(e)  => (e.currentTarget.style.backgroundColor = "transparent")}
      onMouseDown={()    => setPressed(true)}
      onMouseUp={()      => setPressed(false)}
      onTouchStart={()   => setPressed(true)}
      onTouchEnd={()     => setPressed(false)}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left"
      style={{
        backgroundColor: pressed ? hoverBg : "transparent",
        transform: pressed ? "scale(0.98)" : "scale(1)",
        transition: "background-color 150ms, transform 80ms",
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{
          backgroundColor: destructive ? "rgba(239,68,68,0.08)" : "#F7F5F0",
          border: `1px solid ${destructive ? "rgba(239,68,68,0.18)" : "#E5E1D8"}`,
        }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <span className="flex-1 text-sm font-semibold" style={{ color: destructive ? "#EF4444" : "#1A1A2E" }}>
        {label}
      </span>
      {badge && (
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "rgba(79,70,229,0.08)", color: "#4F46E5", border: "1px solid rgba(79,70,229,0.18)" }}
        >
          {badge}
        </span>
      )}
      {!badge && !destructive && (
        <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: "#D1D5DB" }} />
      )}
    </button>
  );
}

// ── Family tracking placeholder ────────────────────────────────────

function FamilyTrackingSection({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#FFFFFF" }}>
      <div className="flex items-center gap-3 p-4 shrink-0" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <button
          onClick={onBack}
          className="p-2 rounded-xl"
          style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8", color: "#6B7280" }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-bold" style={{ color: "#1A1A2E" }}>Family Tracking</h2>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "rgba(79,70,229,0.08)", color: "#4F46E5", border: "1px solid rgba(79,70,229,0.18)" }}
        >
          Soon
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-5">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ backgroundColor: "rgba(79,70,229,0.06)", border: "1px solid rgba(79,70,229,0.15)" }}
        >
          <MapPin className="h-9 w-9" style={{ color: "#4F46E5" }} />
        </div>

        <div>
          <h3 className="text-lg font-bold mb-2" style={{ color: "#1A1A2E" }}>Life360 Integration</h3>
          <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>
            See every family member&apos;s live location during travel. Gate arrivals, TSA progress, and real-time alerts all in one view.
          </p>
        </div>

        <div
          className="w-full rounded-2xl p-4"
          style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#4F46E5" }} />
            <p className="text-xs font-semibold" style={{ color: "#1A1A2E" }}>Coming in the next update</p>
          </div>
          <ul className="space-y-1.5">
            {["Live map during travel", "Gate arrival notifications", "Family check-in alerts", "SOS emergency sharing"].map((f) => (
              <li key={f} className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
                <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: "#4F46E5" }} />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
