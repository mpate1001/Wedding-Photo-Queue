# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 01-foundation
**Areas discussed:** State management migration, Notification testing strategy, Status model extension, Duplicate send prevention, Email bug fix approach, Package installation order, Notification message content

---

## State Management Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Zustand store | Single store with persist middleware for localStorage. Reactive, survives refresh, clean API. | ✓ |
| React Context + useReducer | Built-in React, no dependency. More boilerplate but zero new packages. | |
| You decide | Claude picks the best approach based on codebase patterns | |

**User's choice:** Zustand store (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Single store | One store for groups, queue state, and notification status. Simpler for single-coordinator app. | ✓ |
| Split stores | Separate stores: groupStore, queueStore, notificationStore. More modular but adds coordination overhead. | |
| You decide | Claude picks based on app complexity | |

**User's choice:** Single store (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| stores/useQueueStore.ts | Dedicated stores/ directory at project root | |
| lib/store.ts | Single file in lib/ directory | |
| hooks/useQueueStore.ts | In a hooks/ directory alongside custom hooks | |
| You decide | Claude picks based on conventions | ✓ |

**User's choice:** You decide

---

## Notification Testing Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Test with my phone | Send real messages to personal number first | |
| Twilio test credentials | Use Twilio's magic test numbers | |
| Both in sequence | Test credentials first to validate code, then real phone to validate delivery | ✓ |

**User's choice:** Both in sequence

| Option | Description | Selected |
|--------|-------------|----------|
| Not yet | Need to set up Twilio WhatsApp sandbox first | ✓ |
| Yes, sandbox ready | Already joined the Twilio sandbox | |
| Skip WhatsApp for now | Focus on SMS + Email first | |

**User's choice:** Not yet (WhatsApp sandbox)

| Option | Description | Selected |
|--------|-------------|----------|
| Not sure | Haven't checked SendGrid sender verification | |
| Yes, verified | Sender identity is verified in SendGrid | |
| Need to set up | Haven't configured SendGrid beyond the API key | ✓ |

**User's choice:** Need to set up (SendGrid verification)

---

## Status Model Extension

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add 'arrived' | waiting → queued → notified → arrived → completed | ✓ |
| Keep 4 states | Skip 'arrived' | |
| Let me think | Discuss more | |

**User's choice:** Yes, add 'arrived'

| Option | Description | Selected |
|--------|-------------|----------|
| All recommended | notifiedAt, lastResendAt, resendCount, confirmedAt | ✓ |
| Minimal | Just notifiedAt and resendCount | |
| You decide | Claude picks | |

**User's choice:** All recommended

| Option | Description | Selected |
|--------|-------------|----------|
| Simple array | [5, 12, 3, 8] — position is index | ✓ |
| With metadata | [{groupNumber: 5, queuedAt: timestamp}, ...] | |
| You decide | Claude picks | |

**User's choice:** Simple array (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Reset to 'queued' | Treat as freshly queued, new notification on re-notify | ✓ |
| Stay 'notified' | Auto-resend keeps going from the back | |
| You decide | Claude picks | |

**User's choice:** Reset to 'queued'

---

## Duplicate Send Prevention

| Option | Description | Selected |
|--------|-------------|----------|
| Client + server | UI disables button + server checks lastResendAt timestamp | ✓ |
| Client-side only | UI disables button + loading state | |
| Server-side only | Server rejects if sent within cooldown | |
| You decide | Claude picks | |

**User's choice:** Client + server (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| 30 seconds | Short enough for intentional resends | |
| 60 seconds | More conservative | |
| You decide | Claude picks a reasonable default | ✓ |

**User's choice:** You decide (cooldown duration)

---

## Email Bug Fix Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Fix bug only | Just fix the inverted check | |
| Restructure endpoint | Fix bug + refactor for per-channel status | |
| You decide | Claude picks based on what Phase 2+ needs | ✓ |

**User's choice:** You decide

---

## Package Installation Order

| Option | Description | Selected |
|--------|-------------|----------|
| Wait for Phase 3 | Keep Phase 1 focused on state + notifications | ✓ |
| Install now | Get shadcn/ui in early | |
| You decide | Claude picks based on risk | |

**User's choice:** Wait for Phase 3 (shadcn/ui deferred)

---

## Notification Message Content

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed template is fine | Hardcode a good message | ✓ |
| Make it configurable | Store in env var or config | |
| Let me write the message | Provide exact wording | |

**User's choice:** Fixed template is fine

---

## Claude's Discretion

- File location for Zustand store
- Cooldown window duration for duplicate prevention
- Whether to restructure notify endpoint beyond the bug fix
- Exact notification message wording refinements

## Deferred Ideas

None — discussion stayed within phase scope.
