# Phase 1: Foundation - Context

**Gathered:** 2026-04-03
**Updated:** 2026-04-05
**Status:** Ready for planning (replanning 01-03)

<domain>
## Phase Boundary

Extend the data schema, wire Zustand state management, replace notification providers (Twilio/SendGrid → Nodemailer+Gmail + whatsapp-web.js), and verify real notifications deliver. This phase locks the data model and state architecture that all subsequent phases build on.

</domain>

<decisions>
## Implementation Decisions

### State Management Migration
- **D-01:** Use Zustand with persist middleware to replace all 9 useState hooks in page.tsx
- **D-02:** Single store (not split by concern) — one store for groups, queue state, and notification status
- **D-03:** Queue ordering stored as a simple array of group numbers `[5, 12, 3, 8]`

### Status Model Extension
- **D-04:** Add 'arrived' state: `waiting → queued → notified → arrived → completed`
- **D-05:** Track all timestamp fields: `notifiedAt`, `lastResendAt`, `resendCount`, `confirmedAt`
- **D-06:** When a group is re-queued to the back, status resets to 'queued'

### Notification Architecture (UPDATED 2026-04-05)
- **D-07:** DROP Twilio entirely (no SMS, no individual WhatsApp)
- **D-08:** DROP SendGrid entirely
- **D-09:** Email via Nodemailer + Gmail SMTP (saum.mahek26@gmail.com) — individual emails per member, free
- **D-10:** WhatsApp via whatsapp-web.js — auto-post to a dedicated read-only WhatsApp group, free
- **D-11:** WhatsApp group is read-only (only the bot/coordinator posts). Guests join this group before the wedding.
- **D-12:** Two types of WhatsApp group messages:
  - Pre-event: Full photo schedule posted to the group
  - During event: Auto-post as each group is queued ("Group 5 — Patel Family, you're up!")
- **D-13:** whatsapp-web.js connects via QR code scan before the wedding. Coordinator scans once, session persists.
- **D-14:** Total notification cost: $0

### Duplicate Send Prevention
- **D-15:** Client + server dedup: UI disables button after tap + server checks lastResendAt timestamp
- **D-16:** Cooldown window duration — Claude's discretion

### Email Bug Fix → Full Rewrite
- **D-17:** The notify route needs a full rewrite (not just a bug fix) since we're replacing all providers

### Package Changes
- **D-18:** REMOVE: twilio, @sendgrid/mail
- **D-19:** ADD: nodemailer, whatsapp-web.js
- **D-20:** Keep: zustand, @tanstack/react-query, sonner, date-fns (already installed in 01-01)
- **D-21:** Defer shadcn/ui to Phase 3

### Claude's Discretion
- File location for Zustand store
- Cooldown window duration for duplicate prevention
- Notification message wording
- WhatsApp session persistence strategy (file-based vs in-memory)
- Gmail app password setup instructions for checkpoint

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### State and Types
- `types/index.ts` — Extended QueueStatus type with 'arrived' state and GroupStateRecord
- `store/queueStore.ts` — Zustand store (already built in 01-02)
- `app/page.tsx` — 444-line file with useState hooks to extract

### Notifications (REWRITE)
- `app/api/notify/route.ts` — Needs full rewrite: remove Twilio/SendGrid, add Nodemailer+Gmail + whatsapp-web.js group posting

### Components
- `components/GroupCard.tsx` — Current group display component

### Research
- `.planning/research/STACK.md` — Package recommendations
- `.planning/research/ARCHITECTURE.md` — Timer patterns, localStorage

</canonical_refs>

<code_context>
## Existing Code Insights

### Completed in This Phase
- `types/index.ts`: Extended with 5-state QueueStatus, GroupStateRecord, timestamps (01-01)
- `store/queueStore.ts`: Zustand persist store with 7 actions (01-02)
- `app/api/notify/route.ts`: Email bug fixed + 60s dedup added (01-03 task 1) — BUT needs full rewrite for new providers

### Established Patterns
- API route handlers in `app/api/*/route.ts`
- Error handling: try-catch with structured JSON responses
- `@/` path alias for imports

### Integration Points
- notify/route.ts → full rewrite for Nodemailer + whatsapp-web.js
- page.tsx → wire to Zustand store (01-04, still pending)
- GroupCard.tsx → update for new status model (01-04, still pending)

</code_context>

<specifics>
## Specific Ideas

- WhatsApp group should be dedicated and read-only for photo queue notifications
- Pre-event message: full schedule. During event: per-group announcement.
- QR code scan happens once before wedding, session persists.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-03, updated 2026-04-05*
