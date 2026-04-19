# Architecture Patterns

**Domain:** Wedding event queue management — auto-resend timers, re-queue mechanics, confirmation flow
**Researched:** 2026-04-03
**Overall confidence:** HIGH (patterns verified against official React docs, Vercel docs, and Dan Abramov's canonical useInterval article)

---

## Existing Architecture Summary

The app is a single-coordinator tool with this data topology:

```
Google Sheets CSV (source of truth for group data)
        |
  /api/groups (Next.js Route Handler — fetches and parses CSV)
        |
  app/page.tsx (client component — all state lives here)
        |
  localStorage (persists QueueStatus per group number)
        |
  GroupCard.tsx (display + interaction per group)
        |
  /api/notify (Route Handler — calls Twilio + SendGrid)
```

Key constraint: there is no database. All runtime state that must survive a page refresh lives in `localStorage`. All business logic that must not lose state across refreshes must serialize to localStorage at the moment it changes.

---

## Recommended Architecture for New Features

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `app/page.tsx` | Root orchestrator — owns all group state, timer registrations, confirmation flow state | All child components, all API routes |
| `components/GroupCard.tsx` | Renders one group's status, countdown, confirm/done actions | Calls parent callbacks (no direct API access) |
| `hooks/useGroupState.ts` (new) | Extracts localStorage read/write, status transitions, and re-queue logic out of page.tsx | Called by page.tsx only |
| `hooks/useAutoResend.ts` (new) | Owns the interval engine, reads notified groups with timestamps, fires resend via callback | Called by page.tsx only |
| `app/api/notify/route.ts` | Existing — sends SMS/WhatsApp/Email; no changes needed for retry logic | Called by page.tsx via fetch |

The core principle: **GroupCard is pure display**. It receives data and callbacks; it never reads from localStorage or calls the API directly. All state mutations flow up to page.tsx (or the extracted hooks), then back down as props.

### Data Flow

```
[localStorage: groupStatuses]
        |
        v
page.tsx (on mount: load statuses, merge with fetched groups)
        |
        v
useAutoResend hook (on interval: scan for notified groups past threshold,
                    call handleResend callback → POST /api/notify)
        |
        v
handleResend → POST /api/notify → success → update notifiedAt timestamp in localStorage
        |
        v
GroupCard receives: group data + countdown remaining + onConfirm + onComplete callbacks
        |
        v
Coordinator taps "Arrived" → onConfirm → status = 'completed', timer cleared in localStorage
Coordinator taps "Re-queue" → onRequeue → status = 'queued', append to back of queue order
```

---

## Pattern: Auto-Resend Timer

### The Core Challenge

`setInterval` in React has a stale closure problem: the callback captures state at creation time and never sees updates. The canonical solution (Dan Abramov, overreacted.io, HIGH confidence) uses a mutable ref as a bridge.

**Confidence: HIGH** — This is the documented, production-proven pattern for declarative intervals in React.

### useAutoResend Hook Design

```typescript
// hooks/useAutoResend.ts
import { useEffect, useRef } from 'react';

export function useAutoResend(
  groups: Group[],
  onResend: (group: Group) => Promise<void>,
  intervalMs = 3 * 60 * 1000  // 3 minutes default
) {
  const callbackRef = useRef(onResend);

  // Always keep ref current so the interval sees latest state
  useEffect(() => {
    callbackRef.current = onResend;
  }); // No dep array — runs after every render intentionally

  useEffect(() => {
    const tick = async () => {
      const now = Date.now();
      for (const group of groups) {
        if (group.status !== 'notified') continue;
        if (!group.notifiedAt) continue;
        const elapsed = now - group.notifiedAt;
        if (elapsed >= intervalMs) {
          await callbackRef.current(group);
        }
      }
    };

    const id = setInterval(tick, 30_000); // Check every 30s, fire if threshold crossed
    return () => clearInterval(id);
  }, [intervalMs]); // Not on `groups` — ref handles freshness
}
```

The 30-second polling check (not 3-minute interval) means a group is resent within 30 seconds of crossing the threshold, rather than waiting for an exact 3-minute tick to align. This is the correct pattern when threshold precision matters more than exact timing.

### Timestamp Storage in localStorage

Auto-resend needs to survive page refresh. Store `notifiedAt` as a Unix timestamp alongside status:

```typescript
// Extended localStorage schema
interface GroupStateRecord {
  status: QueueStatus;
  notifiedAt?: number;     // Date.now() when first notified
  resendCount?: number;    // How many resends have occurred
  requeuedFrom?: number;   // Original group number if re-queued
}

// localStorage key: 'groupStatuses'
// Value: Record<number, GroupStateRecord>
```

On page load, reconstruct countdown from `notifiedAt`:
```typescript
const elapsed = Date.now() - (savedState.notifiedAt ?? Date.now());
const remaining = Math.max(0, resendIntervalMs - elapsed);
```

This means if the coordinator refreshes the page 2 minutes into a 3-minute resend timer, the countdown picks up at 1 minute remaining — not reset to 3 minutes. This is the correct behavior for a live event.

### Resend Guard: Prevent Duplicate Sends

Twilio does not deduplicate at the API level (HIGH confidence — Twilio docs confirm at-least-once delivery). The app must guard itself:

```typescript
// In handleResend: check resendCount and last resend time
const lastResendAt = savedState.lastResendAt ?? savedState.notifiedAt;
const timeSinceLastSend = Date.now() - lastResendAt;
if (timeSinceLastSend < intervalMs * 0.9) {
  return; // Already sent recently — skip this tick
}
```

Update `lastResendAt` in localStorage immediately before the API call, not after success. This prevents double-fire if the interval ticks twice during a slow network response.

---

## Pattern: Re-Queue Mechanics

### The Problem

"Move to back of queue" means the group keeps its original group number (for Google Sheets traceability) but appears at the end of the active queue visually.

The current architecture has no explicit ordering concept — groups render in array order from the API (which is group number order from the CSV).

### Solution: Explicit Order Array in localStorage

Introduce a `queueOrder` array in localStorage that tracks the active queue sequence:

```typescript
// localStorage key: 'queueOrder'
// Value: number[]  — group numbers in display order for 'queued'/'notified' groups

// On re-queue:
function handleRequeue(groupNumber: number) {
  // 1. Update status back to 'queued'
  updateStatus(groupNumber, 'queued');
  // 2. Remove from current position, append to end
  setQueueOrder(prev => [...prev.filter(n => n !== groupNumber), groupNumber]);
  // 3. Clear notifiedAt and resendCount so timer resets
  clearTimerState(groupNumber);
}
```

The dashboard renders groups in this priority order:
1. `notified` groups (grouped at top — coordinator is watching these)
2. `queued` groups in `queueOrder` sequence
3. `waiting` groups in original CSV order

This avoids needing drag-and-drop (HIGH complexity, overkill for this use case). Re-queue is the only reorder operation; manual drag-and-drop is explicitly out of scope.

### Build Order Implication

Queue order depends on the status system. Build status management first, then layer the order array on top of it.

---

## Pattern: Coordinator Confirmation Flow

### Current State

Status transitions are via a dropdown with no guardrails. Any status can transition to any other status. There is no confirmation step.

### Proposed Flow

```
[notified] → coordinator sees group arrive
    |
    v
"Arrived" button tap (new action on GroupCard)
    |
    v
status = 'confirmed' (new status value)
    |
    v
Coordinator taps "Done" (or it auto-transitions after 30s)
    |
    v
status = 'completed', timer cleared
```

Alternatively, keep the two-step as a single confirm:

```
[notified] → "Mark Arrived" tap → status = 'completed' immediately
```

Given the coordinator is under pressure, the simpler one-tap "Done" is better than a two-step confirmation. The dropdown becomes a safety escape hatch for corrections, not the primary interaction.

### New QueueStatus Type

```typescript
// types/index.ts — extend existing type
export type QueueStatus = 'waiting' | 'queued' | 'notified' | 'completed';
// No new status needed if confirmation is one-tap to 'completed'

// BUT: need to track confirmation timestamp for resend suppression
export interface GroupStateRecord {
  status: QueueStatus;
  notifiedAt?: number;
  lastResendAt?: number;
  resendCount?: number;
  confirmedAt?: number;  // Set when coordinator marks arrived — suppresses further resends
}
```

When `confirmedAt` is set, the `useAutoResend` hook skips the group even if it is still technically in `notified` status during the transition. This prevents a resend firing between the tap and the status update propagating.

---

## Component Dependency Graph (Build Order)

```
1. types/index.ts
   └── Extend GroupStateRecord with timer fields (notifiedAt, lastResendAt, etc.)

2. hooks/useGroupState.ts
   └── Centralizes localStorage read/write, status transitions
   └── Exposes: groups, updateStatus, requeueGroup, clearTimerState
   └── Depends on: types/index.ts

3. hooks/useAutoResend.ts
   └── Interval engine, scans notified groups, fires resend callback
   └── Depends on: types/index.ts, useGroupState

4. app/api/notify/route.ts
   └── No changes needed for retry; the client calls it the same way
   └── Consider adding resendCount to request body for logging only

5. components/GroupCard.tsx
   └── Add: countdown display, "Done" button, "Re-queue" button
   └── Remove: status dropdown as primary action (keep as escape hatch)
   └── New props: notifiedAt, resendCount, onConfirm, onRequeue

6. app/page.tsx
   └── Wire useGroupState + useAutoResend together
   └── Pass new callbacks and timer data down to GroupCard
```

**Critical dependency:** Steps 1-2 must complete before 3, 5, or 6. The localStorage schema must be settled before anything reads from it.

---

## Scalability Considerations

| Concern | At 90-140 groups (current scale) | Notes |
|---------|----------------------------------|-------|
| localStorage size | Not an issue — 140 groups × ~100 bytes = ~14KB | localStorage limit is 5-10MB |
| Interval scan cost | Negligible — O(n) over 140 items every 30s | No optimization needed |
| Notification API calls | Sequential per-member within a group; fine for 2-5 members | Existing pattern works |
| Vercel function timeout | Hobby tier: 300s default max | Notification route for a 5-member group completes in <5s; no issue |
| Page render at 140 groups | CSS grid with 140 cards may be slow without virtualization | Use `filter` view by default to keep rendered count low; defer virtualization |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Timer Logic in setInterval with Stale Closures

**What goes wrong:** `setInterval(() => checkGroups(groups), 3_000)` where `groups` is captured at creation — the callback always sees the initial empty array.

**Why it happens:** JavaScript closures capture the value at creation, not a reference to the variable.

**Instead:** Use the `useRef`-as-bridge pattern from `useAutoResend` above. The ref always points to the latest callback, which closes over the latest state.

### Anti-Pattern 2: Resetting notifiedAt on Every Re-render

**What goes wrong:** `notifiedAt` gets overwritten on each status change or page refresh, so the resend timer always starts from zero.

**Instead:** Write `notifiedAt` exactly once — when status transitions to `notified`. Guard it: `if (!existing.notifiedAt) { record.notifiedAt = Date.now(); }`.

### Anti-Pattern 3: Re-queue by Mutating Group Number

**What goes wrong:** Assigning a new high group number to a re-queued group breaks the Google Sheets reference. The coordinator can no longer correlate "Group 47" in the app to row 47 in the sheet.

**Instead:** Keep group number immutable. Use the separate `queueOrder` array for visual ordering only.

### Anti-Pattern 4: Calling /api/notify Directly from GroupCard

**What goes wrong:** Notification logic (including resend guard, timestamp updates, status changes) gets duplicated or split across components. GroupCard and page.tsx both manage timer state independently.

**Instead:** GroupCard calls `onNotify(group)` (a callback). The parent owns the full notification sequence including localStorage writes.

### Anti-Pattern 5: Using setTimeout Chains Instead of setInterval

**What goes wrong:** Chaining `setTimeout` for resend creates drift and is not restartable after a page refresh because the chain is lost.

**Instead:** `setInterval` checking against a stored `notifiedAt` timestamp is restart-safe. The check runs every 30s; if the page was refreshed mid-interval, the next 30s tick will catch the overdue group.

---

## Vercel / Serverless Constraints (HIGH confidence)

- Hobby tier default function duration: 300 seconds. The notify route (3 Twilio + 1 SendGrid calls per member, sequential) for a 5-member group takes ~3-8 seconds. No timeout risk.
- Auto-resend fires from the client (browser timer), not from a Vercel cron or background function. This is correct for this app — the coordinator's device is the trigger. If the coordinator closes the browser during a photo session, resend stops. This is acceptable (coordinator is present at the venue).
- No need for Vercel Cron or background jobs. The client-side timer pattern is sufficient and simpler.

---

## Sources

- Dan Abramov, "Making setInterval Declarative with React Hooks": https://overreacted.io/making-setinterval-declarative-with-react-hooks/ (HIGH confidence — canonical ref pattern)
- Vercel Functions Duration docs: https://vercel.com/docs/functions/configuring-functions/duration (HIGH confidence — Hobby tier 300s confirmed)
- Twilio event delivery and duplication: https://www.twilio.com/docs/events/event-delivery-and-duplication (HIGH confidence — at-least-once, client must dedup)
- useHooks.com useIntervalWhen: https://usehooks.com/useintervalwhen (MEDIUM — community hook, conditional interval control)
- React official docs, useReducer scaling: https://react.dev/learn/scaling-up-with-reducer-and-context (HIGH — when to extract state management)
- Josh W. Comeau, Persisting React State in localStorage: https://www.joshwcomeau.com/react/persisting-react-state-in-localstorage/ (MEDIUM — timestamp-based timer survival pattern)
