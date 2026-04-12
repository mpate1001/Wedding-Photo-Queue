# Guest WhatsApp Manager — Design

**Date:** 2026-04-12
**Status:** Approved, pending implementation plan
**Goal:** Automate onboarding of 700+ wedding guests into two WhatsApp groups (announcements + photo coordination) via invite links + daily slow-drip auto-add.

---

## Problem

Manually adding 700+ guests to WhatsApp groups is impractical and risks getting the coordinator's number banned if done in a burst. Guests also need a way to self-onboard, and the coordinator needs visibility into who is still missing — especially with a mix of US and international numbers.

## Core Value

A single password-protected `/guests` page that shows which guests are missing from each WhatsApp group, sends invite links via email + WhatsApp DM, and runs a daily cron to slow-drip auto-add stragglers at a ban-safe pace.

---

## Scope

### In Scope
- New `/guests` page behind existing `requireAuth()` gate
- Live diff of Google Sheets guest list vs WhatsApp group participants
- Send invite links via email (Gmail SMTP) + WhatsApp DM (whatsapp-web.js), channels the app already has
- Daily VPS cron that auto-adds up to 50 missing guests per group
- Support for two groups: announcements (community) + photo (wedding-day)
- Handles US and international phone formats
- Flags guests not registered on WhatsApp as "no whatsapp — email only"

### Out of Scope
- Multi-step escalation workflows (invite → remind → auto-add based on timers)
- Per-guest opt-out / unsubscribe
- Analytics beyond "how many added today"
- Managing the WhatsApp Communities hierarchy itself (groups must exist already)
- Mobile-specific QR code display for invite links

---

## Architecture

### New Route
- `app/guests/page.tsx` — client component, same auth check pattern as `app/page.tsx`
- Link from main Photo Queue header → `/guests`, and back link on `/guests`

### New API Endpoints (all auth-gated)
- `GET /api/guests/status` — returns diff of sheet vs both groups
- `POST /api/guests/invite` — sends invite link to missing guests
- `POST /api/guests/add-batch` — adds next batch to a group (called by cron + manual button)

### New Library Modules
- `lib/phone-match.ts` — normalize & compare phone numbers across formats
- `lib/guest-diff.ts` — diff guest list vs WhatsApp participant list
- `lib/batch-state.ts` — track last-run timestamps per group (JSON file on disk)

### Modified Files
- `app/page.tsx` — add link to `/guests`
- `lib/whatsapp-session.ts` — expose `getGroupParticipants()` and `addParticipantsToGroup()` helpers if not already ergonomic
- `.env.local` — new `WHATSAPP_ANNOUNCEMENTS_GROUP_ID` variable

---

## Data Model

### Guest Status (computed per row)
```ts
type GroupMembership = 'joined' | 'missing' | 'no-whatsapp';

interface GuestStatus {
  name: string;
  phone: string;           // raw from sheet
  phoneNormalized: string; // last-10-digits for matching
  email: string;
  announcementsStatus: GroupMembership;
  photoStatus: GroupMembership;
}
```

### Batch State (persisted on disk)
```ts
// .batch-state.json (gitignored, lives on VPS)
interface BatchState {
  announcements: {
    lastRunAt: string;       // ISO timestamp of last completed batch
    lastAdded: number;       // count added on last run
    lastFailed: number;      // count failed on last run
    totalAdded: number;      // cumulative since feature launched
  };
  photo: { /* same shape */ };
}
```
`lastRunAt` drives the 12-hour cooldown check. Daily counts are derived by comparing timestamps, not tracked separately.

### Phone Matching
- Strip all non-digit characters from both sheet and WhatsApp participant phone
- Match on last 10 digits of the number
- Rationale: handles US `+1XXXXXXXXXX` vs international `+44XXXXXXXXXX` vs malformed `(256) 658-4291` in the sheet. Last 10 digits is unique enough for a 700-guest list.
- Edge case: if a WhatsApp participant is stored with only 9 digits or fewer, skip (non-standard)

---

## API Contracts

### `GET /api/guests/status`
**Auth:** Bearer token required.

**Response (200):**
```json
{
  "guests": [
    {
      "name": "Mahek Patel",
      "phone": "+12566584291",
      "email": "mppatel12@gmail.com",
      "announcementsStatus": "joined",
      "photoStatus": "missing"
    }
  ],
  "stats": {
    "announcements": { "total": 700, "joined": 450, "missing": 240, "noWhatsapp": 10 },
    "photo": { "total": 700, "joined": 0, "missing": 690, "noWhatsapp": 10 }
  },
  "lastBatchRun": {
    "announcements": "2026-04-11T10:00:00Z",
    "photo": null
  }
}
```

**Errors:**
- `401` — unauthorized
- `503` — WhatsApp client not ready (`whenReady()` timeout or throw)
- `500` — Google Sheets fetch failed

**Caching:** participant lists cached in-memory for 60s to avoid hammering WhatsApp API on refreshes.

### `POST /api/guests/invite`
**Auth:** Bearer token required.

**Body:**
```json
{ "groupType": "announcements", "channel": "both" }
```
- `groupType`: `"announcements"` | `"photo"`
- `channel`: `"email"` | `"whatsapp"` | `"both"`

**Response (200):**
```json
{ "sent": 237, "failed": 3, "skipped": 10, "inviteLink": "https://chat.whatsapp.com/..." }
```

**Behavior:**
- Fetches invite link via `chat.getInviteCode()` for the selected group
- For each guest with `status: "missing"`:
  - Email path: send via existing nodemailer setup, subject "You're invited to our wedding WhatsApp group"
  - WhatsApp path: send DM via `client.sendMessage()` with invite link
  - Skip guests with `status: "no-whatsapp"` for WhatsApp channel (email still sent if available)

### `POST /api/guests/add-batch`
**Auth:** Bearer token required.

**Body:**
```json
{ "groupType": "announcements", "batchSize": 50 }
```

**Response (200):**
```json
{ "added": 47, "failed": 3, "remaining": 193, "lastRun": "2026-04-12T10:00:00Z" }
```

**Behavior:**
- Idempotency check: if `batchState.<group>.lastRunAt` is within last 12 hours, return 200 with `{ added: 0, skipped: true, reason: "already ran today" }`
- Fetch current missing guests (reuse diff logic from `/api/guests/status`)
- Take first `batchSize` (default 50, max 100)
- For each guest: `await chat.addParticipants([phoneWithWhatsappSuffix])`, then `await sleep(5000)`
- On `addParticipants` failure: log, count as failed, continue with next guest
- On catastrophic failure (rate limit / network): stop, save progress, return what was done
- Update `.batch-state.json` with new `lastRunAt` and cumulative counts

**Errors:**
- `401` — unauthorized
- `429` — already ran in last 12 hours
- `503` — WhatsApp not ready

---

## UI Layout (`/guests`)

### Header (sticky on mobile, same pattern as Photo Queue)
```
Guest Manager                                      [← Photo Queue]  [Logout]
Mahek & Saumya's Wedding
```

### Group Selector (tabs)
```
[ Announcements Group ]  [ Photo Group ]
```
Filters everything below.

### Stats Bar (3 cols mobile / 4 cols desktop)
```
Total        Joined       Missing       No WhatsApp
 700           450           240             10
```

### Action Buttons (responsive wrap)
```
[Send Invite Links]  [Auto-Add Missing]  [Refresh Status]
```

- **Send Invite Links**: opens small inline dropdown — "Email / WhatsApp DM / Both", then sends
- **Auto-Add Missing**: immediately runs `add-batch` manually (same as daily cron). Shows progress toast.
- **Refresh Status**: re-hits `/api/guests/status`

### Last Run Info (subtle text below buttons)
```
Last daily auto-add ran: 2026-04-11 10:00am — added 47/50
```

### Filter Tabs
```
[ All ]  [ Joined ]  [ Missing ]  [ No WhatsApp ]
```

### Guest List
- Desktop: table (Name | Phone | Status)
- Mobile: card per guest (same pattern as GroupCard)
- Color coding:
  - Green = joined
  - Yellow = missing
  - Gray = no WhatsApp

---

## Error Handling

### Phone Matching
- Duplicates in sheet: match once, log warning
- Malformed numbers (< 7 digits after strip): skip row, log warning, include in "no whatsapp" count

### WhatsApp API
- `whenReady()` timeout: return 503 with actionable message
- `getInviteCode()` fails: surface "Bot may not be admin — check group settings"
- `addParticipants()` per-guest failure: count as failed, continue batch
- Rate limit mid-batch: stop, save progress, return partial success
- Privacy block ("only contacts can add"): mark guest in response as "needs invite link"

### Google Sheets
- Existing `/api/groups` error handling applies
- If sheet structure has new columns: ignore them, match by column name (not index)

### Cron Safety
- Lock file: `.batch-running` created at start of `/api/guests/add-batch`, removed at end
- If lock exists from prior run: return 429 "batch already in progress"
- If lock is stale (> 30 min old): override and continue

---

## Testing

### Manual (pre-wedding)
1. Create a test WhatsApp group with coordinator + 1-2 others
2. Point `WHATSAPP_ANNOUNCEMENTS_GROUP_ID` at it
3. Test Google Sheet with 5 rows (mix of in-group / not-in-group)
4. Visit `/guests`, verify status column accuracy
5. Click "Send Invite Links" with just yourself missing — verify email + WhatsApp DM arrive
6. Click "Auto-Add Missing" — verify second test number joins the group
7. Manually run the cron curl command — verify it adds the next batch

### Automated
- `lib/phone-match.ts` unit tests:
  - US format `(256) 658-4291` matches `+12566584291`
  - International `+447700900123` matches `447700900123`
  - Malformed `abc123` returns null (skipped)
  - Trailing whitespace / special chars normalized
- `lib/guest-diff.ts` unit tests:
  - Guest in sheet, not in group → status `missing`
  - Guest in both → status `joined`
  - Guest in sheet but no WhatsApp match → status `no-whatsapp`
  - Duplicate guests deduped

### Skipped
- Integration tests against real WhatsApp — too fragile, covered by manual testing above

---

## Deployment

### Environment Variables (new)
```bash
# Add to .env.local and VPS .env.local
WHATSAPP_ANNOUNCEMENTS_GROUP_ID=<community-announcements-group-id>
# (existing WHATSAPP_GROUP_ID stays as photo group)
```

### Cron Setup (on VPS)
```bash
# crontab -e
0 10 * * * curl -X POST -H "Authorization: Bearer $(cat /opt/wedding/.cron-token)" \
  -H "Content-Type: application/json" \
  -d '{"groupType":"announcements","batchSize":50}' \
  http://localhost:3000/api/guests/add-batch >> /var/log/wedding-cron.log 2>&1
```
- `.cron-token` is a Base64-encoded valid auth token (generated once, stored with 600 permissions)
- Logs to `/var/log/wedding-cron.log` for post-hoc inspection
- When photo group onboarding starts, add a second cron entry for `"groupType":"photo"`

---

## Open Questions (none blocking)
- Should invite link emails include a QR code image? (Nice-to-have, defer)
- Should we track per-guest invite delivery history? (Nice-to-have, defer)

---

*Design approved by Mahek on 2026-04-12. Next step: `writing-plans` skill to produce implementation plan.*
