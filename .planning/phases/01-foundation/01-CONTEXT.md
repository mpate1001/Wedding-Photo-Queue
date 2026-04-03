# Phase 1: Foundation - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the data schema, wire Zustand state management, fix the email bug, and verify real notifications (SMS, WhatsApp, Email) deliver to phones. This phase locks the data model and state architecture that all subsequent phases build on.

</domain>

<decisions>
## Implementation Decisions

### State Management Migration
- **D-01:** Use Zustand with persist middleware to replace all 9 useState hooks in page.tsx (lines 10-18) and localStorage calls
- **D-02:** Single store (not split by concern) — one store for groups, queue state, and notification status. Simple enough for single-coordinator app.
- **D-03:** Queue ordering stored as a simple array of group numbers `[5, 12, 3, 8]` — position is index, re-queue = move to end

### Status Model Extension
- **D-04:** Add 'arrived' state: `waiting → queued → notified → arrived → completed`
- **D-05:** Track all recommended timestamp fields: `notifiedAt`, `lastResendAt`, `resendCount`, `confirmedAt`
- **D-06:** When a group is re-queued to the back, their status resets to 'queued' (treated as freshly queued, will get new notification)

### Notification Testing Strategy
- **D-07:** Test with Twilio test credentials first (validate API flow), then test with real phone number (validate delivery)
- **D-08:** WhatsApp sandbox needs setup — Twilio WhatsApp sandbox not yet configured
- **D-09:** SendGrid sender verification needed — saum.mahek26@gmail.com not yet verified as sender identity

### Duplicate Send Prevention
- **D-10:** Client + server dedup: UI disables button after tap (client debounce) + server checks lastResendAt timestamp to reject sends within cooldown window
- **D-11:** Cooldown window duration — Claude's discretion to pick a reasonable default

### Email Bug Fix
- **D-12:** Line 120 of `app/api/notify/route.ts` has inverted success check: `emailStatus !== 'sent'` should be `=== 'sent'`. Claude's discretion on whether to also restructure the endpoint for better per-channel status reporting (Phase 2+ will need per-channel status).

### Package Installation
- **D-13:** Install Zustand + TanStack Query + Sonner in Phase 1. Do NOT install shadcn/ui — defer to Phase 3 (UI Overhaul) since it modifies globals.css
- **D-14:** Fixed notification message template is fine — no need to make configurable. This is a one-time-use wedding app.

### Claude's Discretion
- File location for Zustand store (stores/ vs lib/ vs hooks/)
- Cooldown window duration for duplicate prevention
- Whether to restructure the notify endpoint beyond the bug fix
- Exact notification message wording refinements

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### State and Types
- `types/index.ts` — Current QueueStatus type definition needs extending with 'arrived' state
- `app/page.tsx` — 444-line file with 9 useState hooks to extract (lines 10-18)

### Notifications
- `app/api/notify/route.ts` — Email bug on line 120 (inverted success check), full notification send logic
- `.env.local` — Current Twilio/SendGrid credentials and config

### Components
- `components/GroupCard.tsx` — Current group display component, will need updated props for new status model

### Research
- `.planning/research/STACK.md` — Zustand v5, TanStack Query v5, Sonner recommendations with install sequence
- `.planning/research/ARCHITECTURE.md` — Timer patterns, localStorage timestamp survival, re-queue ordering
- `.planning/research/PITFALLS.md` — Twilio rate limits, SendGrid verification, localStorage quotas

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GroupCard.tsx`: Reusable shell for group display — needs new props for extended status model and timestamps
- `types/index.ts`: QueueStatus union type, Group interface, GroupMember interface — extend rather than replace
- Auth flow (checkAuth, handleLogout): Functional as-is, no changes needed in Phase 1

### Established Patterns
- API route handlers in `app/api/*/route.ts` — follow this pattern for any new endpoints
- Error handling: try-catch with `console.error` and structured JSON responses `{ success, message }`
- Environment variables via `process.env` — no runtime config library
- `@/` path alias for imports

### Integration Points
- `page.tsx` state → Zustand store: All useState hooks and localStorage calls migrate
- `types/index.ts` QueueStatus → add 'arrived' to union type
- `notify/route.ts` → fix email bug, add dedup check using lastResendAt from request body
- New store file → imported by page.tsx and GroupCard.tsx

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants things clean, working, and tested before the wedding.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-03*
