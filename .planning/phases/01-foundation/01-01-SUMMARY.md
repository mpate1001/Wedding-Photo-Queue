---
phase: 01-foundation
plan: 01
subsystem: types-and-deps
tags: [dependencies, typescript, types, zustand, react-query, sonner, date-fns]
dependency_graph:
  requires: []
  provides: [QueueStatus, Group, GroupMember, GroupStateRecord, NotificationRequest, NotificationResponse, zustand, react-query, sonner, date-fns]
  affects: [store/queueStore.ts, components/GroupCard.tsx, app/page.tsx]
tech_stack:
  added: [zustand@^5.0.12, "@tanstack/react-query@^5.96.2", sonner@^2.0.7, date-fns@^4.1.0]
  patterns: [TypeScript strict interfaces, union type status model, optional timestamp fields]
key_files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - types/index.ts
    - components/GroupCard.tsx
decisions:
  - "Added 'arrived' status between 'notified' and 'completed' to support coordinator confirmation flow"
  - "GroupStateRecord is a separate interface from Group to cleanly separate persisted state from data shape"
  - "lastNotifiedAt added to NotificationRequest for server-side dedup cooldown (Plan 03 ready)"
metrics:
  duration: "2 minutes"
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_modified: 4
---

# Phase 01 Plan 01: Dependencies and Type Definitions Summary

Installed four runtime packages (zustand, @tanstack/react-query, sonner, date-fns) and extended TypeScript type definitions to support the extended status model with 'arrived' state and per-group timestamp tracking via GroupStateRecord.

## What Was Built

### Task 1: Install packages

Installed the four required runtime packages as project dependencies:

- `zustand@^5.0.12` — state management for queue store (Plan 02)
- `@tanstack/react-query@^5.96.2` — server state and data fetching (Plan 03+)
- `sonner@^2.0.7` — toast notifications for user feedback
- `date-fns@^4.1.0` — date/time formatting utilities

All four appear in `package.json` "dependencies" (not devDependencies). Node modules installed and verified.

### Task 2: Extend TypeScript type definitions

Updated `types/index.ts` with:

- `QueueStatus` extended from 4 values to 5: `'waiting' | 'queued' | 'notified' | 'arrived' | 'completed'`
- `Group` interface extended with four optional timestamp fields: `notifiedAt`, `lastResendAt`, `resendCount`, `confirmedAt`
- `GroupStateRecord` new exported interface with same timestamp fields — this is what Zustand persist stores per group
- `NotificationRequest` extended with `lastNotifiedAt?: number` for server-side dedup
- `NotificationResponse` unchanged

TypeScript compiles with zero errors (`npx tsc --noEmit` exits 0).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed GroupCard.tsx statusColors and statusLabels missing 'arrived'**

- **Found during:** Task 2 verification (`npx tsc --noEmit`)
- **Issue:** Adding 'arrived' to QueueStatus caused TS7053 errors in GroupCard.tsx because `statusColors` and `statusLabels` objects only had 4 keys and TypeScript couldn't index them with the new 5-value union
- **Fix:** Added `arrived: 'bg-purple-100 text-purple-800 border-purple-300'` to statusColors, `arrived: 'Arrived'` to statusLabels, and `<option value="arrived">Arrived</option>` to the status select dropdown
- **Files modified:** `components/GroupCard.tsx`
- **Commit:** bbdc4c4

### Out-of-Scope Issues (Deferred)

Pre-existing lint errors in files not touched by this plan were discovered during `npm run lint`:
- `app/api/auth/verify/route.ts` — unused 'error' variable (warning)
- `app/api/notify/route.ts` — unused 'groupNumber' variable (warning)
- `app/login/page.tsx` — unused 'err', unescaped apostrophe (warning + error)
- `app/page.tsx` — missing useEffect dependency, two `any` types, unescaped apostrophe (warnings + errors)

These are pre-existing issues not introduced by this plan. Logged to deferred items.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | faeaccb | chore(01-01): install zustand, react-query, sonner, date-fns |
| 2 | bbdc4c4 | feat(01-01): extend type definitions with arrived status and GroupStateRecord |

## Known Stubs

None — no UI stubs or placeholder data introduced in this plan.

## Self-Check

Files exist:
- types/index.ts — modified (verified)
- package.json — modified (verified)
- components/GroupCard.tsx — modified (verified)

Commits exist: faeaccb, bbdc4c4 — verified via git log
