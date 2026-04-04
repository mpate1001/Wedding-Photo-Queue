# Requirements: Wedding Photo Queue

**Defined:** 2026-04-03
**Core Value:** The coordinator can move through 100+ groups as fast as the photographer can shoot — no bottlenecks, no confusion, no missed families.

## v1 Requirements

Requirements for the UI/UX overhaul + feature milestone. Each maps to roadmap phases.

### Notifications

- [x] **NOTF-01**: Real SMS notifications deliver to guest phones via Twilio
- [x] **NOTF-02**: Real WhatsApp notifications deliver to guest phones via Twilio
- [x] **NOTF-03**: Real Email notifications deliver to guest inboxes via SendGrid (fix existing email bug)
- [ ] **NOTF-04**: Per-channel delivery status displayed on each group card (SMS ✓, WhatsApp ✗, Email ✓)
- [x] **NOTF-05**: Duplicate notification prevention — tapping notify twice does not send duplicate messages
- [ ] **NOTF-06**: Auto-resend notifications every few minutes to groups that were notified but haven't arrived
- [ ] **NOTF-07**: Visible countdown timer on notified group cards showing time until next auto-resend
- [ ] **NOTF-08**: Actionable error messages when a notification channel fails (which channel, which group)

### Queue Management

- [ ] **QUEUE-01**: One-tap "Queue + Notify" action replaces the current dropdown + button two-step flow
- [ ] **QUEUE-02**: Re-queue no-show groups to back of active queue while keeping their original group number
- [ ] **QUEUE-03**: Coordinator can confirm a group has arrived (stops auto-resend, shows group is "here")
- [ ] **QUEUE-04**: One-tap mark complete after photo is taken
- [ ] **QUEUE-05**: Active/queued groups are pinned to the top of the dashboard, completed groups move to bottom
- [ ] **QUEUE-06**: Batch queue 3-5 groups at once — select multiple, queue + notify all
- [ ] **QUEUE-07**: Search/filter groups by family name for quick lookup across 100+ groups
- [ ] **QUEUE-08**: Auto-advance to next waiting group after marking a group complete

### UI/UX

- [ ] **UI-01**: Clean, modern dashboard redesign with professional visual design
- [ ] **UI-02**: All interactive elements have minimum 48x48px touch targets
- [ ] **UI-03**: Color-coded status indicators visible at a glance without reading text
- [ ] **UI-04**: Fully mobile-responsive layout optimized for coordinator on phone/tablet
- [ ] **UI-05**: Immediate visual feedback on every tap (optimistic UI update within 100ms)
- [ ] **UI-06**: Haptic/vibration feedback on mobile for primary actions
- [ ] **UI-07**: Group member count prominently displayed on each card

### Foundation

- [ ] **FOUN-01**: Extract state management from 444-line page.tsx into dedicated hooks/store
- [x] **FOUN-02**: Status model extended: waiting → queued → notified → arrived → completed
- [ ] **FOUN-03**: Queue ordering stored separately from group numbers (queueOrder array)
- [x] **FOUN-04**: Timestamp tracking on notification events (notifiedAt, lastResendAt, resendCount)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Resilience

- **RESL-01**: Offline resilience with cached group list via service worker
- **RESL-02**: Quick undo for last action with 5-10 second grace window
- **RESL-03**: Auto-retry failed notification sends with exponential backoff

### Polish

- **PLSH-01**: Swipe gestures on group cards (swipe to queue, swipe to complete)
- **PLSH-02**: Dark mode support
- **PLSH-03**: Sound/chime feedback for notifications sent

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time multi-coordinator sync | Single coordinator manages the queue; WebSocket complexity not justified |
| Guest-facing status portal | Guests only need the notification, not a live view |
| Custom notification templates per group | One well-crafted template serves all groups |
| Analytics dashboard | Not useful during the event; localStorage is not a data warehouse |
| Drag-to-reorder queue | "Re-queue to back" covers all real reordering needs |
| Guest RSVP / attendance tracking | This is a photo queue tool, not an event RSVP system |
| Push notifications to coordinator | The coordinator IS the app; in-app feedback is sufficient |
| Internationalization | Single coordinator, one venue, English only |
| Undo history beyond last action | One-level undo deferred to v2; manual status change is workaround |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Pending |
| FOUN-02 | Phase 1 | Complete |
| FOUN-03 | Phase 1 | Pending |
| FOUN-04 | Phase 1 | Complete |
| NOTF-01 | Phase 1 | Complete |
| NOTF-02 | Phase 1 | Complete |
| NOTF-03 | Phase 1 | Complete |
| NOTF-05 | Phase 1 | Complete |
| NOTF-06 | Phase 2 | Pending |
| NOTF-07 | Phase 2 | Pending |
| NOTF-08 | Phase 2 | Pending |
| QUEUE-02 | Phase 2 | Pending |
| QUEUE-03 | Phase 2 | Pending |
| QUEUE-04 | Phase 2 | Pending |
| QUEUE-05 | Phase 2 | Pending |
| NOTF-04 | Phase 3 | Pending |
| QUEUE-01 | Phase 3 | Pending |
| QUEUE-07 | Phase 3 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 3 | Pending |
| UI-06 | Phase 3 | Pending |
| UI-07 | Phase 3 | Pending |
| QUEUE-06 | Phase 4 | Pending |
| QUEUE-08 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 after roadmap creation — all 27 v1 requirements mapped*
