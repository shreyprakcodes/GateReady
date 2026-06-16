"use client";

import { useRouter } from "next/navigation";
import { Timeline } from "@/components/itinerary/Timeline";
import type { Database } from "@/lib/supabase/types";

type Step = Database["public"]["Tables"]["itinerary_steps"]["Row"];

interface Props {
  tripId: string;
  userId: string;
  initialSteps: Step[];
}

export function ItineraryClient({ tripId, userId, initialSteps }: Props) {
  const router = useRouter();

  function handleAskAgent(prompt: string) {
    const url = `/agent?userId=${userId}&tripId=${tripId}&prompt=${encodeURIComponent(prompt)}`;
    router.push(url);
  }

  return (
    <Timeline
      tripId={tripId}
      userId={userId}
      initialSteps={initialSteps}
      onAskAgent={handleAskAgent}
    />
  );
}
