import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { pollFlightStatus } from "@/lib/inngest/pollFlightStatus";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [pollFlightStatus],
});
