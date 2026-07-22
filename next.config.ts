import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: "gateready",
  project: "gateready",
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
