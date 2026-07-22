"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    // global-error must include its own html and body tags — it replaces the root layout.
    <html lang="en" className={spaceGrotesk.variable}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#07101F",
          color: "#F7F5F0",
          fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#9CA8B8", margin: "0 0 1.5rem" }}>
            The error has been reported. You can try again.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              backgroundColor: "#00D4B8",
              color: "#07101F",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.625rem 1.5rem",
              fontFamily: "inherit",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
