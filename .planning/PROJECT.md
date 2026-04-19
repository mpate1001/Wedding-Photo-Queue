# Wedding Photo Queue

## What This Is

A wedding-day photo queue management app that lets a coordinator efficiently cycle 700+ guests (organized into family groups) through group photos. The coordinator queues up groups, sends triple-channel notifications (SMS, WhatsApp, Email), confirms arrivals, handles no-shows with auto-resend, and marks groups complete — all from a clean, modern dashboard designed for speed under pressure.

## Core Value

The coordinator can move through 100+ groups as fast as the photographer can shoot — no bottlenecks, no confusion, no missed families.

## Requirements

### Validated

- ✓ Password-protected dashboard — existing
- ✓ Google Sheets CSV as data source for groups — existing
- ✓ Group display with queue status tracking — existing
- ✓ SMS notifications via Twilio — existing (test mode only)
- ✓ WhatsApp notifications via Twilio — existing (test mode only)
- ✓ Email notifications via SendGrid — existing (test mode only)
- ✓ Test mode toggle for simulated sends — existing
- ✓ Bulk notify capability — existing

### Active

- [ ] UI/UX overhaul — clean, modern design that a coordinator can use under pressure
- [ ] Real notification testing — verify SMS, WhatsApp, and Email actually deliver
- [ ] Auto-resend for no-shows — automatically resend notifications every few minutes to groups that were queued but haven't shown up
- [ ] Coordinator confirmation flow — tap to confirm a group has arrived, then mark as done
- [ ] Re-queue to back — move no-show groups to back of active queue while keeping their original group number
- [ ] Queue batching — coordinator queues 3-5 groups at a time, notifications sent as they're queued
- [ ] Dashboard usability — intuitive enough for a coordinator who didn't build the app
- [ ] Performance at scale — handle 100+ groups (700+ guests) without lag

### Out of Scope

- Real-time collaboration (multiple coordinators editing simultaneously) — single coordinator manages the queue
- Guest-facing app or portal — guests only receive notifications, no app needed
- Attendance tracking beyond photo completion — not tracking RSVPs or ceremony attendance
- Custom notification templates per group — same message format for all
- Payment or billing features — this is a personal wedding tool

## Context

- **Wedding timeline:** 1-3 months away, so there's runway to get it right
- **Scale:** ~700 guests, groups not yet defined but likely 90-140+ groups
- **Coordinator:** Saumya's designated coordinator will run this on wedding day — must be self-explanatory
- **Existing state:** App is built and deployed to photos.mikemetsaumone.com but only tested in test mode. Notifications have never been sent to real phones.
- **Data source:** Google Sheets managed by Mahek and Saumya, with group numbers and member details
- **Known issues:** Codebase concerns doc identifies security weaknesses (Base64 auth), missing error handling, no tests, localStorage-only state, and potential notification delivery issues

## Constraints

- **Tech stack**: Next.js 16 + Tailwind CSS on Vercel — no migration, build on what exists
- **Notifications**: Twilio (SMS/WhatsApp) + SendGrid (Email) — already integrated
- **Data source**: Google Sheets CSV — no database migration
- **Timeline**: Must be fully working and tested before the wedding (1-3 months)
- **Users**: Single coordinator on mobile or tablet at the venue

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep Google Sheets as data source | Already set up, familiar to Mahek/Saumya, no migration needed | — Pending |
| Keep localStorage for status | Simple, no backend DB needed for single-coordinator use | — Pending |
| Auto-resend for no-shows | Coordinator shouldn't have to manually chase people | — Pending |
| Single status flow: waiting → queued → done | Keep it simple — no intermediate "taking photo" state | — Pending |
| Move no-shows to back of queue, keep original number | Easier to find them in the sheet, avoids renumbering confusion | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-03 after initialization*
