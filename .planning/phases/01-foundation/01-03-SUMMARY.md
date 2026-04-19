---
phase: 01-foundation
plan: "03"
subsystem: notifications
tags: [nodemailer, gmail, whatsapp-web.js, notifications, package-swap, rewrite]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [notify-route-nodemailer-gmail, whatsapp-session-module, whatsapp-status-endpoint]
  affects: [app/api/notify/route.ts, lib/whatsapp-session.ts, app/api/whatsapp-status/route.ts, types/index.ts]
tech_stack:
  added: [nodemailer, whatsapp-web.js, qrcode-terminal, "@types/nodemailer"]
  removed: [twilio, "@sendgrid/mail"]
  patterns: [singleton-global-client, LocalAuth-session-persistence, server-side-dedup-cooldown, gmail-smtp-transport]
key_files:
  created:
    - lib/whatsapp-session.ts
    - app/api/whatsapp-status/route.ts
  modified:
    - app/api/notify/route.ts
    - types/index.ts
    - package.json
decisions:
  - "Replaced Twilio/SendGrid with Nodemailer+Gmail SMTP (D-07, D-08, D-09) — zero cost per send"
  - "WhatsApp via whatsapp-web.js group posting (D-10, D-12) — one message per notification call, not per member"
  - "WhatsApp singleton stored in globalThis to survive Next.js hot reloads without re-initializing"
  - "LocalAuth persists QR session to .wwebjs_auth/ so coordinator scans once before the wedding"
  - "60-second dedup cooldown preserved verbatim from previous iteration (D-16)"
  - "NotificationResponse updated: removed smsStatus/whatsappStatus per-member fields, added whatsappGroupStatus top-level field"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-05"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 5
requirements_met: [NOTF-01, NOTF-02, NOTF-03, NOTF-05]
---

# Phase 01 Plan 03: Replace Twilio/SendGrid with Nodemailer + whatsapp-web.js Summary

Full notification stack replaced: Twilio and SendGrid removed, Gmail SMTP (Nodemailer) added for per-member emails, whatsapp-web.js added for single WhatsApp group posts — zero cost delivery architecture.

## What Was Built

### Task 1 — Package swap (commit: 132fc2b)

Removed `twilio` (^5.10.6) and `@sendgrid/mail` (^8.1.6) from dependencies. Added:
- `nodemailer` — Gmail SMTP transport
- `whatsapp-web.js` — WhatsApp group posting via linked device
- `qrcode-terminal` — QR display utility
- `@types/nodemailer` (devDependency)

### Task 2 — Files created/rewritten (commit: 0a319d3)

**`lib/whatsapp-session.ts`** — Singleton module:
- Initializes `whatsapp-web.js` Client once, stored in `global.__whatsappClient`
- Uses `LocalAuth({ dataPath: '.wwebjs_auth' })` for session persistence
- Exposes `getWhatsAppClient()` and `getWhatsAppStatus()` — status tracks `initializing | qr_pending | ready | auth_failure | disconnected`
- Puppeteer runs with `--no-sandbox` for Vercel/Linux compatibility

**`app/api/whatsapp-status/route.ts`** — GET endpoint:
- Returns `{ status, qr, instructions }` — coordinator visits this URL to get QR code for scanning
- Initializes client on first call if not yet started

**`app/api/notify/route.ts`** — Full rewrite:
- All Twilio/SendGrid imports and code removed
- Nodemailer Gmail transporter: sends individual email per member
- whatsapp-web.js: sends one message to the group (not one per member) — per D-12
- 60-second dedup cooldown preserved verbatim (HTTP 429 with seconds-remaining message)
- Test mode: console-logs only, no real sends
- Success determined by at least one email sent successfully

**`types/index.ts`** — `NotificationResponse` updated:
- Removed per-member `smsStatus` and `whatsappStatus` fields
- Added top-level `whatsappGroupStatus?: string`
- `emailStatus` in results array changed from optional to required

### Task 3 — Human checkpoint (pending)

Coordinator must:
1. Generate a Gmail App Password at myaccount.google.com
2. Add `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `WHATSAPP_GROUP_ID` to `.env.local`
3. Start dev server, visit `/api/whatsapp-status`, scan QR with phone
4. Run end-to-end delivery test via curl
5. Confirm email arrives in inbox and WhatsApp group receives the post

## Required Environment Variables

New variables required in `.env.local` (and Vercel dashboard):

```
GMAIL_USER=saum.mahek26@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop   # 16-char Gmail App Password (no spaces)
WHATSAPP_GROUP_ID=120363XXXXXXXXXX@g.us
TEST_MODE=false
```

Old variables now unused (can be removed):
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WHATSAPP_NUMBER`
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`

## WhatsApp Session

Session persists to `.wwebjs_auth/` in the repo root after first QR scan. This directory should be added to `.gitignore`.

## Deviations from Plan

None — plan executed exactly as written. The LocalAuth `dataPath` and puppeteer args match the plan spec verbatim.

## Known Stubs

None in code. Task 3 (delivery verification) is a human-action checkpoint — real end-to-end delivery has not been confirmed yet. The code is complete; the human gate is pending.

## Self-Check: PASSED

- `lib/whatsapp-session.ts` — exists with LocalAuth singleton
- `app/api/whatsapp-status/route.ts` — exists
- `app/api/notify/route.ts` — zero Twilio/SendGrid references, nodemailer + getWhatsAppClient present
- `types/index.ts` — `whatsappGroupStatus` present, `smsStatus` absent
- Commit `132fc2b` — package swap present in git log
- Commit `0a319d3` — file rewrite present in git log
- `npx tsc --noEmit` — exits 0 (verified during execution)
