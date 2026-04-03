# Project Research Summary

**Project:** Wedding Photo Queue — UI/UX Overhaul + Feature Additions
**Domain:** Live event queue coordination (single coordinator, mobile-first, high-pressure venue use)
**Researched:** 2026-04-03
**Confidence:** HIGH (3 of 4 research files completed; PITFALLS.md not generated — risks inferred from ARCHITECTURE.md anti-patterns)

## Executive Summary

The Wedding Photo Queue app is a purpose-built, single-coordinator tool for managing group photo queuing at a wedding. The existing codebase is functional but not production-ready: notifications have never been sent to real phones, the UI has touch targets too small for reliable mobile use, and a 444-line `page.tsx` handles all state with scattered `localStorage` calls. The milestone goal is to make this app genuinely usable on wedding day — reliable notifications, survivable refresh, and a 1-tap interaction model for every primary action.

The recommended approach is additive: no framework migrations, no database, no backend infrastructure changes. The Google Sheets CSV data source and Vercel hosting stay as-is. The upgrade path is four targeted library additions (Zustand for state, TanStack Query for polling, shadcn/ui for components, Sonner for toasts), a localStorage schema extension for timer survival, a custom `useAutoResend` hook using the mutable-ref-bridge pattern, and a component decomposition that separates GroupCard from all state logic. The most critical work is fixing real notification delivery first — everything else depends on live Twilio/SendGrid sends to validate timing and error handling.

The primary risks are: (1) duplicate notification sends if the resend guard is not written before the auto-resend feature ships, (2) stale-closure bugs in interval logic if the mutable-ref pattern is not followed, and (3) `notifiedAt` timestamps being reset on re-render rather than written once. Each risk has a specific, well-documented mitigation. None of them require architectural invention — they are all known React patterns with canonical solutions.

---

## Key Findings

### Recommended Stack

The baseline (Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Twilio, SendGrid) is kept unchanged. All additions are additive and integrate cleanly with the existing setup. shadcn/ui is confirmed compatible with Tailwind v4 via OKLCH color tokens; it must be initialized last in the install sequence because it modifies `globals.css`. The install sequence is: Zustand → TanStack Query → Sonner → date-fns → shadcn init → shadcn add components. Do not add `tailwindcss-animate` (deprecated in the Tailwind v4 path).

**Core technology additions:**
- **Zustand v5** — reactive state store with localStorage persistence; replaces scattered `localStorage.getItem/setItem` calls throughout `page.tsx`. Minimum v5.0.10 for persist middleware race condition fix.
- **TanStack Query v5** — replaces manual `useEffect` fetch for groups; provides `refetchInterval` + `refetchIntervalInBackground` for the auto-resend polling check. Set `staleTime > 0` to prevent SSR hydration double-fetch.
- **shadcn/ui** — install `button`, `badge`, `card`, `dialog`, `sheet` components. Tailwind-native, no runtime JS overhead, zero class conflicts with existing patterns.
- **Sonner** — shadcn/ui's official toast primitive; fires from anywhere including async callbacks with no hook/context setup.
- **date-fns v4** — `formatDistanceToNow()` for "Notified 6 minutes ago" countdown display. Tree-shakeable, zero dependencies.
- **react-swipeable v7** — swipe-right to queue, swipe-left to skip. Progressive enhancement only; do not block milestone on this.

**What not to add:** Prisma, Socket.io, next-auth, Framer Motion, Redux Toolkit, daisyUI, tailwindcss-animate, or react-swipeable-views (unmaintained, has vulnerabilities).

See `.planning/research/STACK.md` for full rationale and alternatives considered.

### Expected Features

The coordinator will struggle without the table-stakes features on wedding day. The differentiators make the coordinator meaningfully faster but are not blocking. Anti-features are explicitly called out to prevent scope creep.

**Must have (table stakes — milestone blocking):**
- Real notification delivery — app is a demo without it; fix email bug, test with live Twilio/SendGrid
- Large touch targets (48px minimum) — current UI causes mis-taps under stress
- One-tap Queue + Notify flow — current dropdown + button two-step is wrong UX for mobile
- Auto-resend for no-shows — core stated requirement; requires timestamp tracking
- Re-queue to back — core stated requirement; requires explicit `queueOrder` array in localStorage
- Coordinator arrival confirmation — prevents premature "done" marking
- Duplicate notification prevention — rate limiting + debounce + server-side guard
- Active queue section pinned at top — mandatory at 100+ group scale

**Should have (high value, low effort):**
- Resend timer countdown visible on card
- Per-group notification status detail (SMS/WhatsApp/Email per channel)
- Search/filter by name
- Actionable error feedback on notification failure
- Group member count as headline element

**Defer to v2+:**
- Quick undo (useful but adds state complexity; manual workaround exists)
- Offline resilience / service worker (add only if venue WiFi tests poorly)
- Auto-advance to next waiting group (polish)
- Batch queue 3-5 groups (can ship post-milestone)
- Swipe gestures (progressive enhancement)

**Status model:** Extend to `waiting → queued → notified → completed`. The `confirmedAt` timestamp on `GroupStateRecord` serves as the arrived-state signal without adding a new enum value — keeps the type model clean.

See `.planning/research/FEATURES.md` for feature dependency graph and coordinator UX principles.

### Architecture Approach

The existing data flow (Google Sheets CSV → `/api/groups` → `page.tsx` → localStorage → `GroupCard`) is sound and should not be restructured. The problem is that `page.tsx` owns too much: state, timers, API calls, and render. The solution is to extract two hooks (`useGroupState` and `useAutoResend`) while keeping GroupCard as a pure display component that only receives data and callbacks.

**Major components:**
1. **`types/index.ts`** — extend `GroupStateRecord` with `notifiedAt`, `lastResendAt`, `resendCount`, `confirmedAt`; must be settled before any other changes
2. **`hooks/useGroupState.ts`** (new) — centralizes all localStorage read/write, status transitions, re-queue logic; exposes reactive state via Zustand
3. **`hooks/useAutoResend.ts`** (new) — interval engine using mutable-ref-bridge pattern (Dan Abramov canonical pattern); checks every 30 seconds against `notifiedAt` threshold; fires resend callback
4. **`components/GroupCard.tsx`** — pure display; receives `notifiedAt`, `resendCount`, `onConfirm`, `onRequeue` props; no direct API calls or localStorage access
5. **`app/page.tsx`** — orchestrator only; wires hooks together and passes callbacks down

**Key architectural rules:**
- Write `notifiedAt` exactly once (when status transitions to `notified`); guard with `if (!existing.notifiedAt)`
- Write `lastResendAt` to localStorage immediately before the API call (not after success) to prevent double-fire on slow network
- Keep group numbers immutable; use separate `queueOrder: number[]` in localStorage for visual ordering only
- Auto-resend fires from the client (browser timer), not Vercel Cron — correct for a coordinator-present use case

**Critical anti-patterns to avoid:**
1. **Stale closure in setInterval** — use the `useRef`-as-bridge pattern; never pass `groups` directly to the interval callback
2. **Resetting `notifiedAt` on re-render** — write once, guard against overwrite
3. **Mutating group numbers for re-queue** — breaks Google Sheets traceability; use `queueOrder` array instead
4. **GroupCard calling `/api/notify` directly** — duplicates notification logic; all API calls go through parent callbacks
5. **setTimeout chains for resend** — not restart-safe after page refresh; use `setInterval` + stored timestamp instead

See `.planning/research/ARCHITECTURE.md` for localStorage schema, full hook implementations, and Vercel constraint analysis.

### Critical Pitfalls

PITFALLS.md was not generated. The following pitfalls are inferred from the anti-patterns documented in ARCHITECTURE.md and known patterns from FEATURES.md:

1. **Duplicate SMS/WhatsApp sends on wedding day** — Twilio does not deduplicate; the app must check `lastResendAt` before every send. Write the resend guard before the auto-resend feature ships. This is the highest-stakes failure mode (guests receive 5+ messages).
2. **Stale closure bug makes auto-resend appear broken** — interval callback captures empty `groups` array at creation. Follow the `useRef` bridge pattern exactly; test with a 30-second threshold in development before setting 3-minute production threshold.
3. **notifiedAt timestamp overwritten on page refresh** — if the guard is missing, resend timer always restarts from zero. Write once, guard always.
4. **Page unusable at 140 groups without filtering** — CSS grid with 140 rendered cards causes jank. Pin active groups to top and render `waiting` groups below a fold; do not render all 140 cards at full fidelity simultaneously.
5. **Email bug in test mode masks real delivery failures** — existing SendGrid success logic has a known bug. Fix and verify with real sends in a staging environment before the event.
6. **shadcn/ui init order** — running `npx shadcn@latest init` before other npm installs causes wrong project assumptions. Always init shadcn last.

---

## Implications for Roadmap

Based on the combined research, the feature dependencies and build order from ARCHITECTURE.md strongly suggest a 4-phase structure:

### Phase 1: Foundation — Types, State, Real Notifications

**Rationale:** Every subsequent feature depends on the extended `GroupStateRecord` type and a working Zustand store. Real notification delivery must be verified first because auto-resend timing and per-channel status display cannot be validated in test mode.
**Delivers:** Working state layer; notifications confirmed to real phones; email bug fixed; duplicate send guard in place.
**Addresses:** Real notification delivery, duplicate notification prevention.
**Avoids:** Building auto-resend on top of an unverified notification stack; shipping the duplicate-send pitfall.

**Work items:**
- Extend `types/index.ts` with `GroupStateRecord` timer fields
- Install Zustand v5; create `store/queueStore.ts` with persist middleware
- Install TanStack Query; replace manual `useEffect` group fetch
- Fix SendGrid email success bug
- Add resend guard logic (`lastResendAt` check before every notify call)
- Live integration test with real Twilio/SendGrid credentials

### Phase 2: Core Queue Mechanics

**Rationale:** With types and state locked, the hooks can be built. `useGroupState` and `useAutoResend` are the core of the milestone. Re-queue mechanics depend on the `queueOrder` array which depends on the Zustand store from Phase 1.
**Delivers:** Auto-resend working with page-refresh survival; re-queue to back working; coordinator confirmation flow.
**Addresses:** Auto-resend for no-shows, re-queue to back, coordinator arrival confirmation.
**Avoids:** Stale closure bug (implement `useRef` bridge pattern from day one), `notifiedAt` overwrite bug.

**Work items:**
- Build `hooks/useGroupState.ts` — all localStorage transitions, re-queue logic, `queueOrder` management
- Build `hooks/useAutoResend.ts` — mutable-ref-bridge interval, 30s check cadence, 3-minute threshold
- Wire both hooks into `app/page.tsx`
- Active queue section pinned at top (sorting logic: notified → queued → waiting)
- Resend timer countdown display on GroupCard

### Phase 3: UI/UX Overhaul

**Rationale:** Component work is isolated from state logic once the hooks are settled. shadcn/ui components, large touch targets, and the one-tap flow can be built and iterated without touching the state layer.
**Delivers:** Mobile-ready UI; 48px touch targets throughout; one-tap Queue + Notify; per-channel notification status display; search/filter.
**Addresses:** Large touch targets, one-tap flow, visual status at a glance, error feedback, search/filter by name.
**Uses:** shadcn/ui button, badge, card, dialog, sheet; Sonner toasts; date-fns for countdown display.

**Work items:**
- `npx shadcn@latest init` (after all npm installs); add button, badge, card, dialog, sheet
- Install Sonner; add `<Toaster>` to `app/layout.tsx`
- Install date-fns; add `formatDistanceToNow` to GroupCard countdown
- Refactor `GroupCard.tsx` — pure display, remove status dropdown as primary action, add "Queue + Notify", "Arrived", "Re-queue" action buttons with 48px targets
- Add per-channel notification status indicators (SMS/WhatsApp/Email)
- Add name search/filter
- Actionable error messages per channel

### Phase 4: Polish and Resilience

**Rationale:** Low-risk, high-value additions that don't affect the core flow. Ship after Phase 3 is validated against the real event environment.
**Delivers:** Progressive enhancements; swipe gestures; group member count headline; auto-advance after completion.
**Addresses:** Haptic/visual feedback, auto-advance to next group, swipe gestures (progressive enhancement only).
**Uses:** react-swipeable (install now, implement here).

**Work items:**
- Install react-swipeable; add swipe-right to queue, swipe-left to skip on GroupCard
- Browser vibration API on primary actions
- Auto-advance scroll after group completion
- Group member count as headline element on card
- Offline resilience assessment (test venue WiFi; add service worker only if needed)

### Phase Ordering Rationale

- Phase 1 before everything: the type schema must be settled before any code reads from localStorage. Building hooks on an unstable schema causes cascading rewrites.
- Phase 2 before Phase 3: UI work on GroupCard will break repeatedly if the callback interfaces (onNotify, onRequeue, onConfirm) are still changing. Lock the data contracts first.
- Phase 3 before Phase 4: swipe gestures and haptics are progressive enhancements on top of a working tap-based UI. Never block on polish.
- Auto-resend (Phase 2) before per-channel status display (Phase 3): you cannot display real delivery receipts until real sends are happening.

### Research Flags

Phases likely needing no additional research (standard patterns, well-documented):
- **Phase 1:** Zustand persist middleware and TanStack Query setup are extensively documented with official examples
- **Phase 3:** shadcn/ui component installation is mechanical; Tailwind v4 compatibility is confirmed

Phases that may benefit from targeted research during planning:
- **Phase 2:** The `useAutoResend` hook is custom logic with no off-the-shelf solution. Review Dan Abramov's canonical interval article before implementation. Consider a brief spike to validate the 30s check / 3-minute threshold behavior in a dev environment before committing to the production cadence.
- **Phase 4:** Offline resilience (service worker + cache) is genuinely complex if venue WiFi proves unreliable. Do not attempt without dedicated research. Treat as optional until connectivity is tested.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All additions verified against official docs; Tailwind v4 + shadcn/ui compatibility explicitly confirmed |
| Features | HIGH | Feature set cross-referenced against 3 queue management system analogs (TablesReady, Qminder, Skiplino); coordinator UX principles drawn from Apple HIG and Material Design |
| Architecture | HIGH | Core patterns (useRef bridge, localStorage schema, re-queue ordering) sourced from canonical references (Dan Abramov, Vercel docs, Twilio docs) |
| Pitfalls | MEDIUM | PITFALLS.md not generated; pitfalls inferred from ARCHITECTURE.md anti-patterns and FEATURES.md notes. No independent pitfall research was completed. |

**Overall confidence:** HIGH for implementation; MEDIUM for pitfall completeness.

### Gaps to Address

- **PITFALLS.md missing:** The pitfall research agent did not produce output. The pitfalls listed above are inferred, not independently researched. During Phase 1 planning, manually review: (1) Twilio rate limiting behavior at 100+ notification sends in rapid succession, (2) Vercel Hobby tier cold start latency on the notify route under burst load, (3) localStorage behavior on iOS Safari private browsing mode (quota is 0 in private mode — coordinator should never use private browsing).
- **Email bug specifics unknown:** FEATURES.md notes the bug exists but does not document the root cause. Investigate the SendGrid success/failure logic in `/api/notify/route.ts` before Phase 1 ships.
- **Real notification testing not yet done:** All Twilio/SendGrid integration is test-mode only. The timing assumptions for auto-resend (3-minute threshold) are untested against real delivery latency. Validate in a live test before the event.
- **react-swipeable maintenance:** Last published ~1 year ago. If it becomes a problem during Phase 4, `@use-gesture/react` is the fallback (heavier but actively maintained).

---

## Sources

### Primary (HIGH confidence)
- shadcn/ui Tailwind v4 docs: https://ui.shadcn.com/docs/tailwind-v4
- shadcn/ui React 19 docs: https://ui.shadcn.com/docs/react-19
- TanStack Query v5 auto-refetching: https://tanstack.com/query/v5/docs/framework/react/examples/auto-refetching
- TanStack Query useQuery reference: https://tanstack.com/query/v5/docs/framework/react/reference/useQuery
- Zustand v5 GitHub: https://github.com/pmndrs/zustand
- Dan Abramov, "Making setInterval Declarative with React Hooks": https://overreacted.io/making-setinterval-declarative-with-react-hooks/
- Vercel Functions Duration docs: https://vercel.com/docs/functions/configuring-functions/duration
- Twilio event delivery and duplication: https://www.twilio.com/docs/events/event-delivery-and-duplication
- React official docs, useReducer scaling: https://react.dev/learn/scaling-up-with-reducer-and-context

### Secondary (MEDIUM confidence)
- TablesReady Waitlist Features: https://www.tablesready.com/features/waitlist/
- Qminder Service Dashboard: https://www.qminder.com/features/service-dashboard/
- Qminder Queue Management Features: https://www.qminder.com/blog/queue-management/best-queue-management-system-features/
- Skiplino Queue Management Guide 2025: https://skiplino.com/best-queue-management-systems-in-2025-complete-guide-to-digital-queue-solutions/
- Mobile Dashboard UX Best Practices: https://www.toptal.com/designers/dashboard-design/mobile-dashboard-ui
- Modal UX Design Patterns: https://blog.logrocket.com/ux-design/modal-ux-design-patterns-examples-best-practices/
- SMS API Error Handling and Retry: https://mysmsgate.net/en/blog/sms-api-error-handling-retry-guide
- Sonner comparison: https://blog.logrocket.com/react-toast-libraries-compared-2025/
- Josh W. Comeau, Persisting React State in localStorage: https://www.joshwcomeau.com/react/persisting-react-state-in-localstorage/
- useHooks.com useIntervalWhen: https://usehooks.com/useintervalwhen

### Tertiary (LOW confidence — needs validation)
- react-swipeable: https://github.com/FormidableLabs/react-swipeable (maintenance status MEDIUM; last publish ~1 year ago)
- Event Management App UI/UX Trends 2025: https://vocal.media/01/event-management-app-ui-ux-trends-that-are-winning-in-2025

---
*Research completed: 2026-04-03*
*PITFALLS.md: not generated — pitfalls inferred from ARCHITECTURE.md anti-patterns*
*Ready for roadmap: yes*
