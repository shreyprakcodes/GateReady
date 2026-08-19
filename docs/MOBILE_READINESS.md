# Mobile Readiness Diagnosis

GateReady is used in airports, on phones, often one-handed on spotty wifi — mobile
is the primary context, not a secondary breakpoint. Diagnosis only, no code
changes. Assessed at phone widths (~375–430px). Next.js 16, Tailwind v4.
Date: 2026-07-22.

## 1. Screen inventory

| Screen | Owning file(s) |
|---|---|
| Dashboard (trip list) | `app/dashboard/page.tsx` (own `TripCard`, `WidgetPreview`, `TravelCompanion`, `AddFlightModal` all defined inline) |
| Trip detail (boarding pass, buffer, milestones, map) | `app/trip/[id]/page.tsx` — composes `components/trip/BoardingPass.tsx`, `components/dashboard/LeaveNowCard.tsx`, `components/trip/MilestonePanel.tsx`, `components/trip/SharePanel.tsx`, `components/trip/TripReadinessCard.tsx`, `src/components/RouteMap.tsx` |
| Boarding pass | `components/trip/BoardingPass.tsx` |
| Leave Now card (+ buffer tiers) | `components/dashboard/LeaveNowCard.tsx` |
| Buffer widget (dashboard-level) | inline `TravelCompanion` function component (not exported — local to the file), `app/dashboard/page.tsx` lines 286–409; separate `SmartBuffer` ring inline in `app/trip/[id]/page.tsx` lines 78+ |
| Notifications / bell | `components/notifications/NotificationCenter.tsx`, mounted via `components/dashboard/BottomNav.tsx` |
| Family share page | `app/s/[token]/page.tsx` |
| Settings | `app/settings/page.tsx` (hub) + `app/settings/{profile,family,preferences,account,travel-docs}/page.tsx` |
| Onboarding | `app/onboarding/page.tsx` |
| Agent / Ask GateReady | `app/agent/page.tsx` + `components/agent/AgentChat.tsx` |

## 2. Mobile layout, per screen

**Dashboard** (`app/dashboard/page.tsx`) — responsive: `max-w-5xl mx-auto flex gap-8 px-4 sm:px-6` with main content `flex-1 min-w-0` and the `TravelCompanion` sidebar set to `hidden lg:flex` (line 326) — correctly disappears below `lg`, no horizontal-scroll risk. Filter pills use `overflow-x-auto scrollbar-none` (line 800). `AddFlightModal` is mobile-first: `flex items-end sm:items-center` + `w-full sm:max-w-md` (lines 478/483) — renders as a bottom sheet on phone, centered dialog at `sm+`. No fixed desktop-only widths anywhere in this file.

**Boarding pass** (`components/trip/BoardingPass.tsx`) — **zero `sm:`/`md:`/`lg:` prefixes anywhere in the file**. Fluid (flex + `min-w-0` on the origin/destination blocks, lines 129/149) so it won't force horizontal scroll, but the origin/destination hero uses a fixed `text-[52px] font-black` (lines 131, 151) at every viewport width — sized for desktop, never scales down. No `truncate`/`whitespace-nowrap` guard on that text or on the stub row's boarding-time/seat blocks (lines 231–281) — currently safe only because IATA codes and times are always short strings; no defensive clipping if that assumption breaks. The barcode strip is properly guarded (`shrink-0 overflow-hidden`, `maxWidth: 140`, line 251).

**Leave Now card** (`components/dashboard/LeaveNowCard.tsx`) — no responsive prefixes, but it's a single fluid card (`grid grid-cols-2` for the two secondary tiers, line 404) that will be tight but workable at 375px, likely cramped at 320px (iPhone SE-class). No fixed widths anywhere.

**Buffer widget** — the dashboard-level "Smart Buffer" ring + family-member list (`TravelCompanion`, `app/dashboard/page.tsx:286-409`) is wrapped in `hidden lg:flex` (line 326) — **this whole widget does not render at all on phone**. The per-trip `SmartBuffer` ring (`app/trip/[id]/page.tsx`) and the tier breakdown inside `LeaveNowCard` are not hidden and do work on mobile, so buffer *information* isn't entirely lost — just this one dashboard-level summary.

**Notifications/bell** (`NotificationCenter.tsx`) — mobile-native pattern: bell trigger is a `flex-1 py-2` tab inside `BottomNav`, panel overlay uses `maxWidth: 448, margin: "64px 16px 0"` (lines 150–160) — correctly clamps to viewport width with real margins rather than a fixed panel width. No overflow risk.

**Family share page** (`app/s/[token]/page.tsx`) — best-in-class: `max-w-md mx-auto px-4` (line 167), single column throughout, no fixed widths, generous padding. Reads as designed mobile-first from the start.

**Settings** (`app/settings/page.tsx`) — `max-w-md mx-auto px-4` (line 46), single-column list rows `px-5 py-4` — responsive and touch-friendly.

**Onboarding** (`app/onboarding/page.tsx`) — `max-w-md mx-auto w-full flex flex-col flex-1 px-4` (line 498), single column, progress bar and options all fluid.

**Agent / Ask GateReady** (`app/agent/page.tsx`, `AgentChat.tsx`) — `max-w-md mx-auto` with `height: calc(100dvh - 64px)` (line 37) — correctly uses `dvh` rather than `vh`, avoiding the classic mobile-Safari "100vh taller than the visible viewport" bug. Status chips are deliberately truncated to `max-w-[32px]` (line 100) to fit three chips + header on a narrow screen — a conscious mobile tradeoff. Chat bubbles cap at `max-w-[80%]` (`AgentChat.tsx:200`).

## 3. Touch ergonomics

- **Undersized targets** (below the ~44px guideline): `LeaveNowCard`'s refresh button is `h-6 w-6` (24×24px, line 333); dashboard's add-flight and filter icon buttons are `h-9 w-9` (36×36px, lines 783/790); the "Allow location" button is `px-3 py-1` text-only (~28px tall, line 536); `NotificationCenter`'s panel close button is `p-1.5` (~28px, line 194); plain-text links like "View Past Trips," "Sign out," and "Mark all read" have no padding beyond line-height.
- **Solid targets**: `BottomNav` tabs are `flex-1 py-2` inside a 64px-tall bar (the whole label+icon column is tappable, well over 44px); `MilestonePanel` step rows are full-width `px-4 py-3` (~64–70px tall); onboarding's `Continue`/`Skip` buttons are `py-3.5` (~48px); settings list rows are `px-5 py-4` with 40px icon boxes.
- No hover-only interactions found — everything critical is a `<button>`/`<Link>` with `onClick`/`href`; a few decorative `hover:` classes exist alongside `active:` states (settings rows, milestone rows use `active:scale-[0.98]`), so hover is additive, not required.

## 4. Viewport & shell

- No explicit `viewport` export anywhere in `app/` — confirmed via search. **Not a bug**: per the installed Next 16 docs (`node_modules/next/dist/docs/.../generate-viewport.md`), the `width=device-width, initial-scale=1` viewport meta is set automatically, and the docs explicitly state manual configuration is "usually unnecessary." No `userScalable: false` or fixed non-device-width found or needed.
- **Three distinct visual systems coexist**, which explains the uneven responsive maturity:
  1. Root shell (`app/layout.tsx`) — cream `#F7F5F0` + Playfair Display/Inter — but almost nothing renders using it directly, since nearly every page overrides its own background via an inline-styled wrapper `div`.
  2. A near-identical but separately hardcoded "warm off-white" palette (`#FAF7F2` + `'Space Grotesk'` inline font override) used by `app/trip/[id]/page.tsx`, `app/settings/*`, `app/onboarding/page.tsx`, `app/agent/page.tsx` — the majority of real screens.
  3. A third, unrelated blue/white palette (`#1B6EF3` primary, `#F4F6FA` bg) used **only** by `app/dashboard/page.tsx`.
  4. Navy `#07101F`/teal `#00D4B8`/Space Grotesk used for the family share page (`app/s/[token]`) and as dark-overlay accents inside `NotificationCenter`'s panel.

  These are independently-defined per-file `const C = {...}` objects rather than a shared design-token source — mobile responsiveness patterns (safe-area insets, `dvh`, `max-w-md`) were applied screen-by-screen rather than through a shared layout primitive, which tracks with why some screens (share page, settings, onboarding) are solid and others (dashboard, boarding pass) have gaps.

## 5. Ranking, worst → best

1. **Dashboard "Smart Buffer" / Travel Companion widget** — `app/dashboard/page.tsx:326`, `hidden lg:flex`. Not degraded, **entirely absent** on phone. This is the one true "unusable, not just ugly" finding — the family-member list and the at-a-glance buffer ring simply don't exist below `lg`. (The core buffer feature still surfaces via `LeaveNowCard` and the trip-detail `SmartBuffer` ring, so it's a missing *summary widget*, not a missing *feature*.)
2. **Boarding pass** — `components/trip/BoardingPass.tsx`. No responsive breakpoints at all; a desktop-scaled fixed `52px` hero font that never shrinks, plus no truncation safety net on several text blocks. Currently doesn't break because the data (IATA codes, times) happens to always be short, but it's fragile, not intentionally responsive.
3. **Touch-target consistency, spread across `LeaveNowCard.tsx` and `app/dashboard/page.tsx`** — the refresh button (24px), header icon buttons (36px), and several bare-text links fall meaningfully short of comfortable one-handed tap size, which matters most given the stated in-airport, rushed, one-handed usage context.

Best of the set: `app/s/[token]/page.tsx` (family share), `app/settings/page.tsx`, and `app/onboarding/page.tsx` — all genuinely mobile-first (`max-w-md`, single column, ≥44px primary actions), plus `BottomNav.tsx` and `MilestonePanel.tsx` as standout mobile-ergonomic components.

## Summary

GateReady's mobile maturity is uneven rather than uniformly weak — the screens built more recently or meant to be viewed by non-users on phones (share page, settings, onboarding, the agent chat's `dvh`-based layout) are genuinely mobile-first, while the two earliest/most central screens — the dashboard trip list and the boarding pass — carry the most risk, because a `lg`-only widget hides real functionality on mobile and the boarding pass has no responsive tuning at all despite being sized for desktop text. The three files most worth attention are `app/dashboard/page.tsx` (surface the buffer/family widget below `lg`, and enlarge the icon buttons), `components/trip/BoardingPass.tsx` (add responsive font sizing and truncation guards), and `components/dashboard/LeaveNowCard.tsx` (enlarge the refresh/allow-location touch targets).
