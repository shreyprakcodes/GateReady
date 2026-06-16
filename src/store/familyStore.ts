import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ── Minimal domain types ───────────────────────────────────────────

export interface Flight {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string; // ISO 8601
  arrivalTime: string;
  status: "scheduled" | "boarding" | "departed" | "landed" | "delayed" | "cancelled";
}

export interface BoardingPass {
  id: string;
  flightId: string;
  seat: string;
  boardingGroup: string;
  gate: string;
  terminal: string;
  barcode: string;
}

// ── Core types ─────────────────────────────────────────────────────

export type FamilyRole = "parent" | "adult" | "teen" | "child";

export const AVATAR_COLORS = [
  "#00D4B8", // teal
  "#27D98F", // green
  "#5B8DEF", // blue
  "#FFAB2E", // amber
  "#FF4B6E", // rose
  "#A855F7", // purple
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

export interface FamilyMember {
  id: string;
  name: string;
  avatarInitials: string;
  avatarColor: AvatarColor;
  role: FamilyRole;
  isCurrentUser: boolean;
  flights: Flight[];
  boardingPasses: BoardingPass[];
}

export interface FamilyStore {
  members: FamilyMember[];
  activeMemberId: string | null;
  addMember: (member: Omit<FamilyMember, "id">) => void;
  removeMember: (id: string) => void;
  setActiveMember: (id: string) => void;
  getActiveMember: () => FamilyMember | null;
}

const DEFAULT_MEMBER: FamilyMember = {
  id: "default-user",
  name: "Me",
  avatarInitials: "ME",
  avatarColor: "#00D4B8",
  role: "parent",
  isCurrentUser: true,
  flights:        [],
  boardingPasses: [],
};

// ── Store ──────────────────────────────────────────────────────────

export const useFamilyStore = create<FamilyStore>()(
  persist(
    (set, get) => ({
      members: [DEFAULT_MEMBER],
      activeMemberId: DEFAULT_MEMBER.id,

      addMember: (member) => {
        const id = crypto.randomUUID();
        set((state) => ({
          members: [...state.members, { ...member, id }],
        }));
      },

      removeMember: (id) => {
        set((state) => {
          const members = state.members.filter((m) => m.id !== id);
          // If we removed the active member, fall back to the first remaining one
          const activeMemberId =
            state.activeMemberId === id
              ? (members[0]?.id ?? null)
              : state.activeMemberId;
          return { members, activeMemberId };
        });
      },

      setActiveMember: (id) => {
        set({ activeMemberId: id });
      },

      getActiveMember: () => {
        const { members, activeMemberId } = get();
        return members.find((m) => m.id === activeMemberId) ?? null;
      },
    }),
    {
      name: "gateready-family",
      version: 2, // v2: removed seed flight data
      storage: createJSONStorage(() => localStorage),
    }
  )
);
