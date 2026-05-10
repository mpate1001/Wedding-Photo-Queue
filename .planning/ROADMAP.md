# Roadmap: Wedding Photo Queue

## Overview

Four phases that transform a test-mode demo into a wedding-day-ready tool. Phase 1 locks in the data schema and verifies real notifications actually deliver to phones — nothing else can be validated without that. Phase 2 builds the queue mechanics on top of a verified notification stack. Phase 3 overhauls the UI into a mobile-ready, one-tap coordinator interface. Phase 4 adds progressive enhancements that make a fast tool even faster.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Extend the data schema, wire Zustand state, and verify real notifications deliver to phones
- [x] **Phase 01.1: Security Hardening + Twilio Removal** - Auth-gate all API routes, remove dead Twilio/SMS code, fix email XSS, server-side dedup, WhatsApp init race fix
- [ ] **Phase 2: Queue Mechanics** - Build auto-resend, re-queue-to-back, and coordinator arrival confirmation on top of a verified stack
- [ ] **Phase 3: UI/UX Overhaul** - Redesign the dashboard for mobile-first, one-tap coordinator use with shadcn/ui components
- [ ] **Phase 4: Polish** - Add progressive enhancements: haptics, batch queue, auto-advance, and performance hardening

## Phase Details

### Phase 1: Foundation
**Goal**: Real notifications deliver to coordinator's test phones and the data schema supports all future features
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-02, FOUN-03, FOUN-04, NOTF-01, NOTF-02, NOTF-03, NOTF-05
**Success Criteria** (what must be TRUE):
  1. Coordinator can send an SMS, WhatsApp message, and Email to a real phone and all three arrive
  2. Sending the same notification twice does not result in a duplicate message to the guest
  3. The existing 444-line page.tsx state logic has been extracted into a dedicated Zustand store that survives page refresh
  4. Group status records include notifiedAt, lastResendAt, resendCount, and confirmedAt fields persisted in localStorage
  5. Queue ordering is stored in a separate queueOrder array independent of group numbers
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Install packages (zustand, @tanstack/react-query, sonner, date-fns) and extend TypeScript type definitions
- [x] 01-02-PLAN.md — Create Zustand store with persist middleware, all actions, and localStorage migration
- [x] 01-03-PLAN.md — Fix email bug, add server-side dedup cooldown, verify real notification delivery
- [x] 01-04-PLAN.md — Wire page.tsx to Zustand store, update GroupCard for extended status model, mount providers

### Phase 01.1: Security Hardening + Twilio Removal (INSERTED)

**Goal:** Harden the notification stack for wedding-day production: auth-gate all sensitive API routes, remove dead Twilio/SMS channel, fix email XSS, enforce server-side dedup cooldown, and fix WhatsApp singleton init race
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06
**Depends on:** Phase 01
**Plans:** 3 plans

Plans:
- [x] 01.1-01-PLAN.md — Create requireAuth + escapeHtml helpers, wire auth into diagnostic routes, update dashboard Authorization headers, clean up types
- [x] 01.1-02-PLAN.md — Overhaul notify route (auth gate + remove Twilio/SMS + escapeHtml + server-side dedup + whenReady), remove twilio package
- [x] 01.1-03-PLAN.md — Fix WhatsApp singleton init race (cache init promise, add whenReady), remove hardcoded Chromium path

### Phase 2: Queue Mechanics
**Goal**: The coordinator can manage no-shows automatically and confirm arrivals without manual intervention
**Depends on**: Phase 1
**Requirements**: NOTF-06, NOTF-07, NOTF-08, QUEUE-02, QUEUE-03, QUEUE-04, QUEUE-05
**Success Criteria** (what must be TRUE):
  1. A group that was notified but has not arrived automatically receives a follow-up notification every few minutes without coordinator action
  2. A countdown timer on each notified group card shows how long until the next auto-resend fires
  3. The coordinator can tap "Arrived" to confirm a group is present, which stops the auto-resend immediately
  4. The coordinator can re-queue a no-show group to the back of the active queue while its original group number stays unchanged
  5. Active and queued groups are always pinned to the top of the dashboard; completed groups appear at the bottom
  6. When a notification channel fails, the error message names the specific channel and group that failed
**Plans**: TBD

### Phase 3: UI/UX Overhaul
**Goal**: A coordinator who did not build this app can run it confidently on a phone under wedding-day pressure
**Depends on**: Phase 2
**Requirements**: NOTF-04, QUEUE-01, QUEUE-07, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07
**Success Criteria** (what must be TRUE):
  1. Every tap target on the dashboard is at least 48x48px and reachable with one thumb on a phone
  2. The coordinator can queue and notify a group with a single tap — no dropdown or two-step flow
  3. Group status (waiting, queued, notified, arrived, complete) is distinguishable by color at a glance without reading any text
  4. The coordinator can search or filter groups by family name and find any group within two seconds
  5. Every tap produces a visible UI change within 100ms (optimistic update) and haptic feedback on supported devices
  6. Per-channel delivery status (SMS, WhatsApp, Email) is visible on each group card after notification
**Plans**: TBD
**UI hint**: yes

### Phase 4: Polish
**Goal**: The coordinator moves through groups as fast as the photographer can shoot, with no manual overhead between groups
**Depends on**: Phase 3
**Requirements**: QUEUE-06, QUEUE-08
**Success Criteria** (what must be TRUE):
  1. The coordinator can select 3-5 groups at once and queue and notify all of them in a single action
  2. After marking a group complete, the dashboard automatically scrolls to or highlights the next waiting group
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 01.1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete | 2026-04-12 |
| 01.1 Security Hardening | 3/3 | Complete | 2026-05-09 |
| 2. Queue Mechanics | 0/TBD | Not started | - |
| 3. UI/UX Overhaul | 0/TBD | Not started | - |
| 4. Polish | 0/TBD | Not started | - |
