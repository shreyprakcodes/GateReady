import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "gateready",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
