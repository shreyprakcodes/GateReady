import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { monitorTrips } from "@/inngest/monitor";
import { onTripCompleted, dailyLearningRun } from "@/inngest/post-trip";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [monitorTrips, onTripCompleted, dailyLearningRun],
});
