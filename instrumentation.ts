import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

// The whole app runs on the Node runtime (proxy.ts is Node-only in Next 16,
// no route sets runtime = "edge"), so there is no edge branch to handle here.
export function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

export const onRequestError: Instrumentation.onRequestError = (
  ...args
) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  return Sentry.captureRequestError(...args);
};
