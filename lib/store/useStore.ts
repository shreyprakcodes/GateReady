"use client";

import { create } from "zustand";
import type { Database } from "@/lib/supabase/types";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Alert = Database["public"]["Tables"]["alerts"]["Row"];
type ItineraryStep = Database["public"]["Tables"]["itinerary_steps"]["Row"];

export interface ChatToolCall {
  id: string;
  name: string;
  input: unknown;
  result?: unknown;
  status: "running" | "done" | "error";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ChatToolCall[];
}

interface AppState {
  userId: string | null;
  tripId: string | null;
  trip: Trip | null;
  steps: ItineraryStep[];
  alerts: Alert[];
  chatMessages: ChatMessage[];
  agentRunning: boolean;

  setUserId: (id: string) => void;
  setTripId: (id: string) => void;
  setTrip: (trip: Trip) => void;
  getActiveFlight: () => Trip | null;
  setSteps: (steps: ItineraryStep[]) => void;
  upsertStep: (step: ItineraryStep) => void;
  setAlerts: (alerts: Alert[]) => void;
  dismissAlert: (id: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  updateToolCall: (msgId: string, call: ChatToolCall) => void;
  setAgentRunning: (running: boolean) => void;
  clearChat: () => void;
}


export const useStore = create<AppState>((set, get) => ({
  userId: null,
  tripId: null,
  trip: null,
  steps: [],
  alerts: [],
  chatMessages: [],
  agentRunning: false,

  setUserId: (id) => set({ userId: id }),
  setTripId: (id) => set({ tripId: id }),
  setTrip: (trip) => set({ trip }),
  setSteps: (steps) =>
    set({ steps: [...steps].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) }),
  upsertStep: (step) =>
    set((s) => {
      const existing = s.steps.findIndex((x) => x.id === step.id);
      const updated =
        existing >= 0
          ? s.steps.map((x) => (x.id === step.id ? step : x))
          : [...s.steps, step];
      return { steps: updated.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) };
    }),
  setAlerts: (alerts) => set({ alerts }),
  dismissAlert: (id) =>
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
  addChatMessage: (msg) =>
    set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  updateToolCall: (msgId, call) =>
    set((s) => ({
      chatMessages: s.chatMessages.map((m) => {
        if (m.id !== msgId) return m;
        const existing = m.toolCalls?.findIndex((t) => t.id === call.id) ?? -1;
        const toolCalls =
          existing >= 0
            ? (m.toolCalls ?? []).map((t) => (t.id === call.id ? call : t))
            : [...(m.toolCalls ?? []), call];
        return { ...m, toolCalls };
      }),
    })),
  setAgentRunning: (agentRunning) => set({ agentRunning }),
  clearChat: () => set({ chatMessages: [] }),
  getActiveFlight: () => get().trip,
}));
