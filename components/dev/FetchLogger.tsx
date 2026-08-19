"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __fetchLoggerWrapped?: boolean;
  }
}

// Temporary dev-only instrumentation to locate the source of a
// browser "TypeError: Failed to fetch" that Turbopack won't give a
// usable stack trace for. Remove once the call site is found.
export function FetchLogger() {
  useEffect(() => {
    if (window.__fetchLoggerWrapped) return;
    window.__fetchLoggerWrapped = true;

    const originalFetch = window.fetch;

    window.fetch = function (...args: Parameters<typeof fetch>) {
      const [input, init] = args;
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method =
        init?.method ?? (input instanceof Request ? input.method : "GET");

      // Captured synchronously, before the await — this is the only
      // place the real caller frame survives; by the time .catch()
      // runs, Turbopack's async stack has already lost it.
      const callSiteStack = new Error().stack;

      return originalFetch.apply(this, args).catch((err: unknown) => {
        console.error("[FETCH-FAIL]", {
          url,
          method,
          error: String(err),
          stack: callSiteStack,
        });
        throw err;
      });
    };

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      console.error("[FETCH-FAIL]", {
        source: "unhandledrejection",
        error: String(event.reason),
      });
    }

    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
