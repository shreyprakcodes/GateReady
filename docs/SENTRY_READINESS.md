# Sentry Readiness Diagnosis

Next.js 16.2.9 App Router. Diagnosis only — no packages installed, no code wired up.
Date: 2026-07-22.

## 1. Error surfaces

- **No error boundaries exist.** No `app/error.tsx`, no `app/global-error.tsx`, no
  per-route `error.tsx` anywhere in the tree. Unhandled render errors fall through
  to Next's default error UI with no capture point.
- **API routes** — pattern is try/catch → `Response.json({error}, {status})` with
  `console.error` for diagnostics, but coverage is inconsistent:
  - `app/api/leave-now/route.ts` — whole compute path wrapped in try/catch, logs
    with trip/user id context, returns clean 500. Also has a fire-and-forget
    Supabase upsert with its own `.then(onSuccess, onError)` logging (lines 164–180).
  - `app/api/agent/route.ts` — errors inside the streamed `ReadableStream` are
    caught and pushed as an SSE `{type:"error"}` event rather than an HTTP error
    status (headers are already sent by that point). The API-key-prefix debug log
    that used to sit here has been removed as of this session.
  - `app/api/tools/calendar/route.ts` — **no try/catch at all**; `getEvents()` is
    awaited unguarded. A throw here 500s with no structured handling.
  - Inngest-triggered routes (`app/api/inngest/route.ts`,
    `app/api/agent/monitor/route.ts`) are just `serve()` calls — no app-level
    try/catch; error handling lives inside the functions themselves.

- **Inngest layer** — two independent `Inngest` client instances and two separate
  `serve()` endpoints (looks like an artifact of iterative work, worth confirming
  intentional):
  - `lib/inngest/client.ts` + `lib/inngest/pollFlightStatus.ts` → mounted at
    `app/api/inngest/route.ts`.
  - `inngest/client.ts` + `inngest/monitor.ts` + `inngest/post-trip.ts` → mounted
    at `app/api/agent/monitor/route.ts`.
  - Neither client sets `onFailure` handlers or uses `NonRetriable` errors.
    `pollFlightStatus.ts` swallows per-trip fetch errors with a bare
    `catch { continue }` (line 40) — a failing flight-status call for one trip is
    silent today. Inngest's own dashboard tracks step retries/failures, but
    nothing here forwards a failure to an external monitor — natural
    onFailure/captureException hook point once Sentry exists.

## 2. Client/server + Edge/Node split

- Server-side: all `app/api/**/route.ts` handlers, all Server Components (default
  in `app/`), both Inngest function sets above.
- Client (`"use client"`): 42 files under `app/` + `components/`, confirmed for
  `AgentChat.tsx` and `LeaveNowCard.tsx`. No `TravelCompanion` component exists in
  this repo.
- **`middleware.ts` exists at root and runs on the Edge runtime.** This app is on
  Next 16, where `middleware.ts` is deprecated in favor of `proxy.ts`/
  `export function proxy()` (`node_modules/next/dist/docs/.../file-conventions/proxy.md`,
  `upgrading/version-16.md`). It still works but:
  - No `runtime` export is set; the file predates the split, so it's running the
    legacy Edge-runtime path rather than the new default-Node `proxy.ts` path.
  - This is the one Edge-runtime surface in the entire app — every route handler
    and Server Component runs Node.js (`grep -r "export const runtime"` in `app/`
    returns nothing).
  - Matters for Sentry: request-level instrumentation (`onRequestError` context,
    tracing) differs between Edge and Node. Migrating `middleware.ts` → `proxy.ts`
    first (Next 16 codemod: `npx @next/codemod@canary middleware-to-proxy .`)
    would put the whole app on one runtime and remove the need for an
    edge-specific init branch. Keeping `middleware.ts` as-is means Sentry's edge
    entrypoint (or a `NEXT_RUNTIME === 'edge'` branch in `instrumentation.ts`)
    has to be exercised for that one file.

## 3. Config & secrets

- `.env.local` is the single source of truth; 19 keys currently defined (Anthropic,
  Supabase, Aviation/TSA/Maps/Uber/Google Calendar/Twitter/Inngest/debug/test-user/
  FlightAware/AeroDataBox). Nothing resembling a Sentry DSN or auth token yet.
- Convention: server-only secrets are unprefixed; anything the client needs is
  `NEXT_PUBLIC_*` (2 of the 19 keys today). Sentry fits directly —
  `NEXT_PUBLIC_SENTRY_DSN` (safe client-exposed) for client/server/edge init, and
  a plain `SENTRY_AUTH_TOKEN` (build-time only, referenced solely inside
  `next.config.ts`'s `withSentryConfig` wrapper, never imported by client code)
  for source-map upload.
- `next.config.ts` is currently just an empty `NextConfig` object, default export
  — **needs wrapping** with `withSentryConfig(nextConfig, {...})`, but there's no
  existing `webpack`/`turbopack`/`experimental` block to reconcile around, so the
  wrap is a clean addition.

## 4. Existing noise

- No error-tracking or structured logger exists — raw `console.error`/
  `console.log` throughout (29 occurrences across 6 lib files, plus route-level
  ones). Nothing to rip out before adding Sentry, beyond what was already removed
  this session (the API-key-prefix debug log in `app/api/agent/route.ts`).
- The "dotenv promo-banner" item is isolated to `playwright.config.ts` (loads
  `.env.local` manually for the Playwright process, since Next's own env loading
  doesn't apply outside `next dev`/`next start`) and the two
  `.claude/worktrees/*/package-lock.json` files (irrelevant lockfile entries). It
  runs in a separate process from the Next server and never touches
  `instrumentation.ts`/`instrumentation-client.ts` — no init-order collision with
  Sentry.

## 5. Recommended file list for Next 16 instrumentation

Per current Next 16 conventions (not the pre-15 `sentry.client.config.ts`/
`sentry.server.config.ts` pattern, which doesn't apply here):

1. **`instrumentation.ts`** (project root) — exports `register()` (calls
   `Sentry.init` for Node, branching on `process.env.NEXT_RUNTIME === 'edge'` for
   the edge case as long as `middleware.ts` stays on Edge) and `onRequestError`
   (forwards to `Sentry.captureRequestError`, matching the
   `Instrumentation.onRequestError` signature documented in
   `node_modules/next/dist/docs/.../instrumentation.md`).
2. **`instrumentation-client.ts`** (project root) — `Sentry.init(...)` for the
   browser bundle; this fully replaces the old `sentry.client.config.ts` file.
3. **`next.config.ts`** — wrap the existing empty `NextConfig` with
   `withSentryConfig(nextConfig, { org, project, authToken: process.env.SENTRY_AUTH_TOKEN })`.
4. **`.env.local`** — add `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN`,
   following the existing prefix convention.

Not part of the Sentry install itself, but a prerequisite worth doing first:
migrate `middleware.ts` → `proxy.ts` via the Next 16 codemod so the whole app
runs on one runtime instead of splitting instrumentation across Edge and Node
for a single auth check.
