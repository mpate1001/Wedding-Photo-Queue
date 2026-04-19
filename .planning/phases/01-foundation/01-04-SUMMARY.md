---
phase: 01-foundation
plan: "04"
subsystem: ui
tags: [zustand, tanstack-query, sonner, react, status-machine, persist]
dependency_graph:
  requires:
    - phase: 01-02
      provides: zustand-queue-store-with-persist
    - phase: 01-03
      provides: notify-route-nodemailer-whatsapp
  provides:
    - dashboard-wired-to-zustand-store
    - tanstack-query-groups-fetch
    - sonner-toast-feedback
    - status-aware-groupcard-buttons
    - five-status-stats-bar
  affects:
    - phase-02-auto-resend  # reads lastResendAt/resendCount populated here
    - phase-02-timeline-ui  # will consume GroupStateRecord props on GroupCard
tech_stack:
  added: []  # All libs were added in 01-02; this plan only wires them
  patterns:
    - store-as-single-source-of-truth
    - useQuery-for-server-state-store-for-client-state
    - useMemo-merged-server-and-store-state
    - status-aware-conditional-action-buttons
    - write-once-notifiedAt-via-setStatus
    - resend-path-via-recordResend
key_files:
  created:
    - app/providers.tsx
  modified:
    - app/layout.tsx
    - app/page.tsx
    - components/GroupCard.tsx
key_decisions:
  - "useState-wrapped QueryClient in providers.tsx (not module singleton) to isolate state per browser session"
  - "30s staleTime on QueryClient + 60s staleTime on the groups query — prevents thrash on hydration while still letting manual Refresh work"
  - "useMemo-merged groups array: server data (groupsData) overlaid with store statuses — keeps dashboard reactive to both sources"
  - "Resend vs first-notify branching in handleNotify: wasAlreadyNotified check routes to recordResend() vs setStatus('notified') so Phase 2 auto-resend timers read accurate lastResendAt/resendCount"
  - "Status dropdown retained as safety escape hatch alongside status-aware primary buttons — lets coordinator override any transition under pressure"
  - "Filter + stats bar expanded to 6 columns (Total + 5 statuses) to surface the new 'arrived' state"
patterns_established:
  - "Client components: useQueueStore(selector) pattern for fine-grained subscriptions"
  - "toast feedback over alert(): all user-facing messages flow through sonner with success/warning/error variants"
  - "GroupCard accepts optional record={GroupStateRecord} prop reserved for Phase 2 timestamp display"
requirements_completed:
  - FOUN-01
  - FOUN-02
  - FOUN-03
  - FOUN-04
metrics:
  duration: "~90 min (across two sessions + human verification)"
  completed: "2026-04-11"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 4
---

# Phase 01 Plan 04: Dashboard wired to Zustand + TanStack Query + status-aware UI

**Dashboard migrated from 9 useState hooks + manual localStorage to Zustand store + TanStack Query + Sonner toasts, with GroupCard rendering status-aware action buttons for the full waiting→queued→notified→arrived→completed flow.**

## Performance

- **Duration:** ~90 min (execution + human verification in browser)
- **Completed:** 2026-04-11
- **Tasks:** 4/4 (Task 4 = human-verify checkpoint, confirmed "dashboard verified")
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- **Zero group-state localStorage in page.tsx** — all queue state flows through `useQueueStore`, which handles persistence via Zustand's `persist` middleware (established in 01-02). Status survives hard refresh.
- **TanStack Query owns the /api/groups fetch** — replaces manual `fetchGroups` / `setLoading` / `setError` pattern. Refresh button is now `refetch()`.
- **Sonner toasts replace every alert() dialog** — success/warning/error variants wired throughout single-notify and bulk-notify flows.
- **GroupCard renders status-aware primary actions** — Queue / Notify for waiting+queued, Arrived + Resend for notified, Complete for arrived. Status dropdown kept as an escape hatch.
- **Stats bar + filter expanded to 5 statuses** — the new 'arrived' state is visible in the dashboard header, filterable, and colored purple throughout.
- **Resend path wired correctly** — `handleNotify` branches on `wasAlreadyNotified` so resends call `recordResend()` (bumping `lastResendAt`/`resendCount`) instead of re-calling `setStatus('notified')`, keeping Phase 2's auto-resend timer accurate.

## Task Commits

Each task was committed atomically on `dev`:

1. **Task 1: Mount global providers in layout.tsx** — `0ad0ff0` (feat)
   - Created `app/providers.tsx` as a client component wrapping `QueryClientProvider` + Sonner `<Toaster />`
   - Wired `app/layout.tsx` to render `<Providers>` around `{children}` while keeping layout itself a server component
2. **Task 2: Refactor page.tsx to Zustand + Query + toast** — `eabe890` (feat)
   - Removed 3 of 9 useState hooks (groups, loading, error) — kept 6 local-UI hooks (notifyingGroup, filterStatus, testMode, authenticated, selectedGroups, bulkNotifying)
   - Removed all `localStorage.getItem('groupStatuses')` and `localStorage.setItem('groupStatuses', ...)` calls
   - Wired `useQueueStore` with granular selectors (`statuses`, `setStatus`, `recordResend`, `addToQueue`, `removeFromQueue`, `getRecord`)
   - Wired `useQuery<GroupsApiResponse>` with `queryKey: ['groups']`, `staleTime: 60_000`, `enabled: authenticated`
   - Replaced all `alert()`/`confirm()` calls with `toast.success` / `toast.warning` / `toast.error`
   - Added `useMemo`-merged `groups` array: server data overlaid with store state
   - Added 'arrived' stats card (purple) and 'arrived' filter button between 'notified' and 'completed'
3. **Task 3: Status-aware action buttons in GroupCard** — `f9a6ef2` (feat)
   - Added `arrived` to `statusColors` (purple) and `statusLabels` maps
   - Added optional `record?: GroupStateRecord` prop (reserved for Phase 2 timestamp display)
   - Added `<option value="arrived">` to status dropdown
   - Replaced single Notify button with status-aware primary buttons: Queue (waiting), Notify (waiting+queued), Arrived + Resend (notified), Complete (arrived)
   - Dropdown kept as safety escape hatch
4. **Task 4: Human-verify dashboard flow** — checkpoint (no commit)
   - User ran dev server and confirmed all 6 checks pass: login works, status persists across hard refresh, status-flow buttons work (including arrived→completed), toast feedback fires, 5-status stats bar renders, no console errors
   - User resume signal: "dashboard verified"

**Plan metadata commit:** _(this SUMMARY commit — created after Task 4 verification)_

## Files Created/Modified

- `app/providers.tsx` **(created)** — Client component. `useState`-wrapped `QueryClient` (30s default staleTime) + `<Toaster position="top-center" richColors />`. Keeps queryClient per browser session, never a module-level singleton.
- `app/layout.tsx` **(modified)** — Imports `Providers` from `./providers` and wraps `{children}` in `<Providers>…</Providers>`. Layout itself remains a server component.
- `app/page.tsx` **(modified)** — Rewritten to use `useQueueStore` selectors, `useQuery` for `/api/groups`, `useMemo` for merged-group computation, and `toast` for all feedback. Auth logic (`checkAuth`, `handleLogout`, `wedding_auth` token in localStorage) preserved unchanged per plan.
- `components/GroupCard.tsx` **(modified)** — Extended for 5-status model with status-aware action buttons; added optional `record` prop for future timestamp display.

## Acceptance Criteria Evidence

All criteria verified against the committed source:

| Criterion | Expected | Actual | Result |
|---|---|---|---|
| `grep "localStorage.*groupStatuses" app/page.tsx` | 0 | 0 | pass |
| `grep -c "useQueueStore" app/page.tsx` | ≥1 | 7 | pass |
| `grep -c "useQuery" app/page.tsx` | ≥1 | 2 | pass |
| `grep -c "alert(" app/page.tsx` | 0 | 0 | pass |
| `grep -c "toast\." app/page.tsx` | ≥3 | 10 | pass |
| `grep -c "recordResend" app/page.tsx` | ≥1 | 3 | pass |
| `grep -c "arrived" components/GroupCard.tsx` | ≥4 | 5 | pass |
| `grep -c "Toaster" app/providers.tsx` | ≥1 | 2 | pass |
| `grep -c "QueryClientProvider" app/providers.tsx` | ≥1 | 3 | pass |
| `npx tsc --noEmit` | exit 0 | exit 0 | pass |
| Human: dashboard flow 6-check | all 6 pass | all 6 pass | pass |

_Note: the remaining 4 `localStorage` references in `app/page.tsx` are all for the `wedding_auth` token (auth flow), which the plan explicitly instructs to preserve. Zero references are for group/queue state._

## Decisions Made

All decisions align with the plan spec; no unplanned architectural choices were made. Notable implementation details recorded in frontmatter:

- `useState(() => new QueryClient(...))` in providers (per React Query SSR guidance) — prevents state leak across SSR requests
- Store access via fine-grained selectors (`useQueueStore((s) => s.statuses)` etc.) rather than a single destructuring — minimizes re-renders under the 700-guest load target
- `useMemo` with `[groupsData, statuses]` deps for the merged `groups` array — avoids recomputing on unrelated state changes (filter, selection)

## Deviations from Plan

None — plan executed exactly as written. All code matches the plan's code blocks verbatim, with minor stylistic improvements (granular selectors, `useMemo`) that preserve the plan's contract.

## Downstream Cleanup Flagged

**`/api/notify/route.ts` still contains per-member Twilio SMS code** despite the 01-03 SUMMARY claiming full Twilio removal. The git history shows `6dfc61d feat(01-03): switch to Twilio SMS + Gmail + WhatsApp group posting` — Twilio was re-introduced after 01-03 was summarized, and the SMS path is still active server-side.

**Impact on this plan: none.** The page.tsx `handleNotify` implementation only reads `emailStatus` / `whatsappGroupStatus` from the response (via the `NotificationResponse` type in `types/index.ts`), and branches on `result.success` — it does not inspect SMS-specific fields. The dashboard renders correctly regardless of whether the server sends SMS or not. Bulk notify and single notify both pass the same contract.

**Recommended follow-up (NOT a blocker for 01-04):** A future plan (likely Phase 2 or a 01-05 cleanup plan) should either:
1. Remove the Twilio SMS code path from `/api/notify/route.ts` to match the 01-03 SUMMARY's stated architecture (zero-cost delivery), OR
2. Update the 01-03 SUMMARY and NotificationResponse type to document SMS as an active channel, and add SMS status surfacing to the dashboard

Tracking this as **downstream debt**, not a deviation — 01-04's scope is strictly the UI wiring, and the UI wiring is correct against the current server contract.

## Issues Encountered

None blocking. The previous executor surfaced the Twilio-SMS-in-notify-route observation during implementation (documented above). Human verification of the full dashboard flow passed on first run — login, refresh persistence, all status transitions, toast feedback, stats bar, and console all clean.

## User Setup Required

None — no new environment variables or external service configuration. Sonner and TanStack Query were added as dependencies in Plan 01-02 and are already installed.

## Next Phase Readiness

**Ready for Phase 2 (auto-resend + timeline UI):**
- `GroupStateRecord` timestamps (`notifiedAt`, `lastResendAt`, `resendCount`, `confirmedAt`) are tracked in the store and already available via `getRecord(groupNumber)` — Phase 2's auto-resend hook can read them directly
- `GroupCard` already accepts an optional `record` prop, so timestamp display can be added without a props-interface change
- Resend path calls `recordResend()` — Phase 2's time-until-next-resend calculator will see accurate `lastResendAt` and `resendCount` values
- `queueOrder` is populated on `setStatus('queued')` and `addToQueue()` — Phase 2's queue reordering UI can bind to it directly

**Known debt going into Phase 2:**
- Twilio SMS path in `/api/notify/route.ts` (see Downstream Cleanup Flagged above)

## Self-Check: PASSED

- `app/providers.tsx` — exists, exports `Providers`, uses `useState` for QueryClient, mounts Sonner `<Toaster>` — verified via Read
- `app/layout.tsx` — imports `Providers` from `./providers`, wraps `{children}` — verified via Read
- `app/page.tsx` — zero `localStorage.*groupStatuses` / `localStorage.*queueOrder` references, 7 `useQueueStore` usages, 2 `useQuery` references, 0 `alert(` calls, 10 `toast.` calls, 3 `recordResend` references — verified via grep
- `components/GroupCard.tsx` — 5 `arrived` references (statusColors, statusLabels, select option, status check, button label) — verified via grep
- Commits `0ad0ff0`, `eabe890`, `f9a6ef2` — all present on `dev` branch — verified via `git log --oneline`
- `npx tsc --noEmit` — exit 0 (no output) — verified
- Human verification: user reported "dashboard verified" after exercising all 6 checks in the browser at http://localhost:3001

---
*Phase: 01-foundation*
*Plan: 04*
*Completed: 2026-04-11*
