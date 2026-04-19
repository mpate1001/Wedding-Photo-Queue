# Feature Landscape

**Domain:** Live event queue coordination — wedding group photo management
**Researched:** 2026-04-03
**Context:** Single coordinator on mobile/tablet at venue, 100+ groups, 700+ guests, high-pressure real-time operations

---

## Existing Features (Already Built)

| Feature | State | Notes |
|---------|-------|-------|
| Password-protected dashboard | Working | Auth is insecure (Base64) but functional |
| Google Sheets CSV data source | Working | Fragile custom CSV parser |
| Group display with status tracking | Working | 4 states: waiting → queued → notified → completed |
| SMS notifications via Twilio | Test mode only | Never sent to real phones |
| WhatsApp notifications via Twilio | Test mode only | Never sent to real phones |
| Email notifications via SendGrid | Test mode only | Email success logic has a bug |
| Test mode toggle | Working | Yellow banner appears |
| Bulk notify (select + send) | Working | Not idempotent, no rate limiting |
| Status filter | Working | Filter by status type |
| Status change dropdown per group | Working | Dropdown is wrong UX for mobile — too small |

---

## Table Stakes

Features the coordinator will struggle without. Missing any of these = painful wedding day.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real notification delivery | Without this the app is a demo, not a tool | Low (config + testing) | Twilio/SendGrid are integrated; needs env vars, live testing, and the email bug fix |
| Large touch targets on all actions | Coordinator is on a phone under pressure, possibly in poor lighting | Low | Current buttons and dropdown are too small; 48px minimum for all interactive elements |
| One-tap "Queue + Notify" flow | Coordinator should be able to activate a group in a single deliberate action | Medium | Current flow requires status dropdown change + separate notify button — two steps, wrong UX |
| Visual status at a glance | Need to see which groups are waiting, queued, notified, done without reading text | Low | Color-coded cards exist but labels are small; needs larger status indicators |
| Auto-resend for no-shows | Coordinator cannot babysit a timer and manually resend every few minutes | High | Core feature of the milestone; requires timestamp tracking and interval-based retry |
| Re-queue to back | No-shows should not block the queue; coordinator needs to park them and move on | Medium | Requires ordering/position concept and a deliberate "send to back" action |
| Coordinator arrival confirmation | Coordinator needs to mark a group as "here, taking photo now" before marking done | Low-Medium | Prevents premature completion; adds an "arrived" state or confirmation tap |
| Mark complete (one tap) | Fastest possible way to clear a group after the photo is taken | Low | Should be the primary/largest button on an active group card |
| Error feedback on notification failure | If SMS/Email fails, coordinator must know immediately and retry | Medium | Currently errors are silent or generic; needs per-channel status display |
| Prevent duplicate notification sends | Tapping notify twice during stress sends duplicate messages to guests | Medium | Rate limiting + UI debounce + server-side idempotency key |

---

## Differentiators

Features that go beyond baseline and make the coordinator significantly faster or more confident.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Batch queue: 3-5 groups at once | Coordinator can stay 3-5 groups ahead of the photographer without going group by group | Medium | Select multiple, queue + notify all at once; notifications fire as each is queued |
| Resend timer countdown visible | Coordinator can see "resending in 2m 30s" without guessing | Low | Visual timer on notified group cards; reduces anxiety and prevents manual over-sending |
| Active queue section (pinned at top) | Groups in "queued" or "notified" state float to the top automatically | Low | Eliminates scrolling through 100+ groups to find who is currently active |
| Quick undo (last action reversal) | Under stress, coordinators make mistakes; one-tap undo for the last status change | Medium | 5-10 second grace window with "Undo" toast before action commits |
| Per-group notification status detail | Show which channels succeeded (SMS sent, WhatsApp failed, Email sent) per group | Low-Medium | Coordinator knows whether to verbally find someone if SMS failed |
| Group member count prominent | "6 members" visible on card so coordinator can eyeball if the right number of people showed | Low | Already exists but small; needs to be a headline element |
| Search/filter by name | For 100+ groups, coordinator may need to find a specific family by name quickly | Low | Simple text filter on the group list |
| Offline resilience (cached group list) | Venue WiFi can be unreliable; coordinator should not lose the group list if connection drops | High | Service worker + cached groups; status still writes to localStorage |
| Haptic/visual feedback on action | Confirms the tap registered without coordinator looking away | Low | CSS active states, brief color flash, browser vibration API on mobile |
| Auto-advance to next waiting group | After marking a group complete, the next waiting group scrolls into view | Low | Eliminates manual scrolling after each completion |

---

## Anti-Features

Things to deliberately NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time multi-coordinator sync | Out of scope per PROJECT.md; adds significant backend complexity (WebSockets/server state) for zero benefit with a single coordinator | Accept that single-tab use is the constraint; document it clearly |
| Guest-facing status portal ("you are #3 in queue") | Guests only need the notification, not a live view; adds complexity and a separate UI surface | Send clear SMS/WhatsApp/Email with all info guests need |
| Custom notification templates per group | Every family getting a different message adds a data model, an edit UI, and template validation for negligible coordinator value | One well-crafted template serves all groups |
| Analytics dashboard / charts | Not useful during the event; after-the-fact data is low value for a one-time wedding | Skip entirely; localStorage is not a data warehouse |
| Drag-to-reorder queue | Visual reordering adds complexity; the re-queue-to-back pattern covers all real reordering needs | Use "send to back" action on individual cards |
| Guest RSVP or attendance tracking | Out of scope; this is a photo queue tool, not an event RSVP system | Keep the domain boundary clean |
| Push notifications to coordinator device | The coordinator IS the app; they do not need to be notified of their own actions | Use in-app feedback (toasts, vibration) instead |
| Undo history beyond last action | Full undo history adds state management complexity; coordinators need a quick escape hatch, not a history log | One-level undo with a short time window is sufficient |
| Dark mode | Nice-to-have but not a priority for a time-bound single-use tool; adds CSS overhead | Use high-contrast light theme optimized for outdoor/bright venue lighting |
| Internationalization / multi-language | Single coordinator, one venue, one language | Hardcode English; use env vars for couple name only |

---

## Feature Dependencies

```
Real notification delivery
  └── Auto-resend for no-shows (needs real sends to validate timing)
  └── Per-group notification status detail (needs real delivery receipts)

Auto-resend for no-shows
  └── Timestamp tracking on notifiedAt (new field in group status)
  └── Re-queue to back (no-show workflow: resend N times → re-queue)

Re-queue to back
  └── Queue ordering concept (currently no explicit order, just status)

Batch queue 3-5 groups
  └── One-tap Queue + Notify flow (batch is an extension of single-group flow)

Active queue section pinned at top
  └── Queue ordering concept

Quick undo
  └── Action commit delay (short timeout before persisting state change)

Resend timer countdown
  └── Timestamp tracking on notifiedAt

Coordinator arrival confirmation
  └── Status model change (adds "arrived" or "confirmed" state between notified → completed)
```

---

## Status Model Recommendation

The current 4-state model is almost right but missing one state for the coordinator confirmation flow:

```
waiting → queued → notified → [arrived] → completed
                     ↑
                  auto-resend fires here
                  re-queue to back fires here (after N resends)
```

The `arrived` state (or "confirmed") is what the coordinator taps when the group shows up at the camera. It:
- Stops the auto-resend timer immediately
- Signals the coordinator to now watch for photo completion
- Makes it clear which group is "at the camera" vs "on their way"

Complexity to add this state: Low. It is a new enum value and a new button on notified cards.

---

## MVP Recommendation for This Milestone

**Prioritize (blocking the milestone):**
1. Real notification delivery — app is useless without it
2. Large touch targets + UI overhaul — coordinator cannot reliably use the current UI
3. One-tap Queue + Notify flow — replaces the dropdown + button two-step
4. Auto-resend for no-shows — core stated requirement
5. Re-queue to back — core stated requirement
6. Coordinator arrival confirmation — core stated requirement
7. Duplicate notification prevention — prevents embarrassing double-sends on wedding day
8. Active queue section pinned at top — mandatory for 100+ group scale

**Include (high value, low effort):**
9. Resend timer countdown visible — removes coordinator anxiety at no cost
10. Per-group notification status detail — SMS/WhatsApp/Email success per channel
11. Search/filter by name — essential at 100+ groups
12. Error feedback on failure — coordinator must know when to use verbal backup

**Defer (nice-to-have, not blocking):**
- Quick undo — useful but adds complexity; manual workaround exists (change status back)
- Offline resilience — venue WiFi is probably fine; add if connectivity tests poorly
- Auto-advance to next group — polish, not blocking
- Batch queue 3-5 groups — listed in milestone requirements but can ship as V2 if time-constrained

---

## Coordinator UX Principles (from Research)

These are the design rules that the feature implementation must follow, drawn from queue management system research and high-stress mobile UX patterns:

1. **Primary action is always one tap.** The most common action (notify next group, mark done) must never require more than one deliberate tap. No dropdowns for primary flow.
2. **Touch targets minimum 48x48px.** Apple HIG and Material Design both specify this. Under stress with one hand, smaller targets cause mis-taps.
3. **Status must be visible without reading.** Color alone (+ shape/icon) should communicate waiting / active / notified / done at a glance.
4. **Destructive or irreversible actions require confirmation.** Re-queue and bulk notify are the two candidates. A quick bottom sheet or inline confirm button is enough — not a modal dialog.
5. **Feedback is immediate.** Every tap should produce a visible change within 100ms (optimistic UI update) even if the server call is pending.
6. **Error messages are actionable.** "Failed to send SMS to +1-555..." is useful. "Notification failed" is not.
7. **Scrolling is minimized.** Active groups float to top. Completed groups are collapsed or moved to bottom. Coordinator should never scroll past done groups to find active ones.
8. **The app works when stressed.** No tiny icons, no multi-step dropdowns, no confirmation dialogs for common actions.

---

## Sources

- [TablesReady Waitlist Features](https://www.tablesready.com/features/waitlist/) — restaurant pager system; closest analog to wedding photo queue
- [Qminder Service Dashboard](https://www.qminder.com/features/service-dashboard/) — operator action patterns: call, reassign, mark no-show, mark complete
- [Qminder Queue Management Features](https://www.qminder.com/blog/queue-management/best-queue-management-system-features/) — standard feature set for operator-facing queue tools
- [Skiplino Queue Management Guide 2025](https://skiplino.com/best-queue-management-systems-in-2025-complete-guide-to-digital-queue-solutions/) — digital queue design patterns
- [Mobile Dashboard UX Best Practices](https://www.toptal.com/designers/dashboard-design/mobile-dashboard-ui) — touch target sizing, swipeable cards, progressive disclosure
- [Modal UX Design Patterns](https://blog.logrocket.com/ux-design/modal-ux-design-patterns-examples-best-practices/) — when to use confirmation dialogs vs inline confirm
- [SMS API Error Handling and Retry](https://mysmsgate.net/en/blog/sms-api-error-handling-retry-guide) — retry strategy, progressive backoff, dead letter patterns
- [Event Management App UI/UX Trends 2025](https://vocal.media/01/event-management-app-ui-ux-trends-that-are-winning-in-2025) — simplicity, large tap targets, real-time feedback
- [Qminder Queue Management Dashboard](https://www.qminder.com/product/queue-management-dashboard/) — no-show marking, reorder, reassign patterns
