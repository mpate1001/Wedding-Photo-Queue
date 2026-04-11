---
phase: 01-foundation
type: code-review
depth: standard
reviewed_at: "2026-04-11"
status: issues_found
files_reviewed: 12
findings:
  critical: 4
  warning: 9
  info: 7
  total: 20
---

# Phase 01: Code Review Report

**Depth:** standard
**Files Reviewed:** 12

## Files reviewed

- app/api/notify/route.ts
- app/api/test-notify/route.ts
- app/api/test-whatsapp-cloud/route.ts
- app/api/whatsapp-groups/route.ts
- app/api/whatsapp-status/route.ts
- app/layout.tsx
- app/page.tsx
- app/providers.tsx
- components/GroupCard.tsx
- lib/whatsapp-session.ts
- store/queueStore.ts
- types/index.ts

## Summary

Phase 01 delivered the Zustand + TanStack Query migration cleanly — `page.tsx` is noticeably simpler, the `'arrived'` status flows correctly through store, types, card, and stats, and `providers.tsx` correctly uses a per-session `useState` QueryClient to avoid SSR leaks. The store's write-once `notifiedAt` guard and the dedup cooldown on `/api/notify` are good defensive patterns.

However, several wedding-day reliability and security issues need attention before the event:

1. **Email XSS via unescaped member names** in HTML email bodies — if a Google Sheets row contains `<`, `>`, or a `<script>` tag, it renders as raw HTML in Gmail.
2. **WhatsApp singleton hydration race** — concurrent `getWhatsAppClient()` calls during initialization can spawn duplicate Puppeteer clients.
3. **Hardcoded absolute path to Chromium binary** tied to a specific developer's machine — will fail on Vercel and on any other machine.
4. **Unauthenticated `/api/notify`, `/api/whatsapp-*`, `/api/test-*` routes** — anyone who discovers the domain can blast SMS/email/WhatsApp, rack up Twilio charges, or scrape the linked WhatsApp groups.

---

## Critical Issues

### CR-01: HTML injection / XSS in email notifications via member name

**File:** `app/api/notify/route.ts:84-94`

The HTML email body interpolates `member.name` directly into `<p>` and `<h2>` tags with no escaping. Google Sheets is the source of truth, and nothing in the CSV parser sanitizes names. If a row contains `<img src=x onerror=...>`, `<script>`, or even just `<` / `>`, it will render as HTML inside Gmail. While Gmail strips `<script>`, it will happily render `<img>`, `<a href>`, inline styles, and tracking pixels — and coordinators cc'ing themselves may click through them. Real XSS/phishing surface because the "data source" is a shared editable spreadsheet.

`member.name` also flows into the WhatsApp group template at line 126 — not HTML-rendered, but worth noting that anything in the name column flows out to third-party channels unsanitized.

**Fix:** Escape HTML on name interpolation:
```ts
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// html: `<p>Hi ${escapeHtml(member.name)}!</p>`
```

---

### CR-02: Unauthenticated notification + diagnostic routes

**File:** `app/api/notify/route.ts:8`, `app/api/whatsapp-status/route.ts:5`, `app/api/whatsapp-groups/route.ts:4`, `app/api/test-notify/route.ts:3`, `app/api/test-whatsapp-cloud/route.ts:3`

`/api/notify` is completely unauthenticated. The login token only gates the dashboard UI. Anyone who discovers `https://photos.mikemetsaumone.com/api/notify` can `POST` arbitrary `{groupNumber, members: [{name, phone, email}]}` and cause the server to:
- Send real SMS via your Twilio account (direct fraud / Twilio bill bomb — *especially* critical once the placeholder `+1234567890` is replaced with a real provisioned number).
- Send real email via your Gmail account (reputation damage + Gmail rate-limit lockout mid-wedding).
- Post to your linked WhatsApp group (spam the coordinator group).

The dedup cooldown is client-supplied (`body.lastNotifiedAt`) and trivially bypassed. No rate limiting, no origin check, no bearer-token check. Same goes for `/api/whatsapp-status` (leaks QR code — session hijack risk) and `/api/whatsapp-groups` (enumerates every WhatsApp group the linked number belongs to).

**Fix:** Extract a `requireAuth()` helper that validates the same Base64 `wedding_auth` token the dashboard uses, call it at the top of every mutating/sensitive route, and update `app/page.tsx` `handleNotify` + `handleBulkNotify` to send `Authorization: Bearer ${localStorage.getItem('wedding_auth')}`. Add basic rate limiting (10 notifies/min/token) for defense in depth.

---

### CR-03: Hardcoded absolute Chromium path + Vercel architecture mismatch

**File:** `lib/whatsapp-session.ts:17-18`

```ts
const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
  || '/Users/mahekpatel/.cache/puppeteer/chrome/mac_arm-146.0.7680.153/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
```

Tied to a single developer's home directory on a specific macOS ARM machine with a specific Chrome for Testing version. Beyond the fragility: **`whatsapp-web.js` + Puppeteer fundamentally cannot run on Vercel serverless functions.** Each Vercel invocation is fresh, stateless, 10s (hobby) / 60s (pro) max, with a read-only filesystem except `/tmp`. The `LocalAuth` session store writes to `.wwebjs_auth/` which doesn't persist across invocations, and Chromium binary size exceeds Vercel's function size limits.

**Fix — two-part:**

1. Remove the hardcoded fallback; fail loudly if the env var is missing.
2. **Architectural decision required before wedding day:** either (a) run the Next.js app on a VPS / Fly.io / Railway / laptop at the venue so the WhatsApp client survives, or (b) replace `whatsapp-web.js` with the WhatsApp Cloud API (the `test-whatsapp-cloud` route already proves Cloud API wiring works — use it as the real path). Option (b) is strongly recommended because it removes the QR-scan + session-death failure modes entirely.

---

### CR-04: WhatsApp singleton init race

**File:** `lib/whatsapp-session.ts:63-68`

```ts
export function getWhatsAppClient(): Client {
  if (!global.__whatsappClient) {
    global.__whatsappClient = initClient();
  }
  return global.__whatsappClient;
}
```

`initClient()` fires `client.initialize()` fire-and-forget. If two requests hit `getWhatsAppClient()` in close succession during cold-start, the second caller immediately does `client.sendMessage(...)` on an unready client, which throws. More insidious: concurrent first-call windows (unlikely with Node's single-threaded event loop but not zero) can spawn duplicate Puppeteer Chromium instances and corrupt the `.wwebjs_auth` session store via concurrent writes — potentially bricking the WhatsApp login mid-event.

**Fix:** Cache the *initialization promise*, not just the client, and expose a `whenReady()` helper that all callers await before use.

---

## Warnings

### WR-01: `getWhatsAppStatus()` return type lies about nullability of `global.__whatsappStatus`

**File:** `lib/whatsapp-session.ts:70-86`

Declare the global as `| undefined` and widen the return type to a proper `WhatsAppStatus` union.

### WR-02: Unsafe double cast in WhatsApp group participants

**File:** `app/api/whatsapp-groups/route.ts:21`

```ts
participants: (c as unknown as { groupMetadata?: { participants?: unknown[] } }).groupMetadata?.participants?.length ?? 'unknown',
```

Use the proper `GroupChat` type guard from `whatsapp-web.js`: `chats.filter((c): c is GroupChat => c.isGroup).map(c => ({ ..., participants: c.participants?.length ?? 0 }))`.

### WR-03: `test-notify` hardcodes `http://localhost:3000`

**File:** `app/api/test-notify/route.ts:11`

Derive from `new URL(request.url).origin` so the diagnostic route works on previews/production when `TEST_MODE=true`.

### WR-04: Personal phone + email hardcoded in diagnostic routes

**File:** `app/api/test-notify/route.ts:22-24`, `app/api/test-whatsapp-cloud/route.ts:19`

`+12566584291` and `saum.mahek26@gmail.com` committed to the repo. Move to `TEST_NOTIFY_PHONE` / `TEST_NOTIFY_EMAIL` env vars with clear "not set" error responses.

### WR-05: Bulk notify serializes requests with no per-group progress or retry

**File:** `app/page.tsx:211-239`

100+ groups × ~2s each = minutes of blocked UI. A single Gmail SMTP rate-limit mid-batch silently fails groups with no coordinator visibility. Minimum fix: collect per-group failures and surface them in a toast so the coordinator can retry. Longer term: `Promise.allSettled` with a small concurrency cap + progress counter.

### WR-06: Dedup cooldown is client-controlled — trivially bypassed + double-tap race

**File:** `app/api/notify/route.ts:14-23`, `app/page.tsx:149-196`

Omitting `lastNotifiedAt` from the request body disables the cooldown. And if the coordinator double-taps "Notify" in <300ms, both requests fire before `setNotifyingGroup` updates the button's disabled state — both see the same `record.notifiedAt` from before either succeeded — both proceed. Duplicate SMS/email/WhatsApp to the group.

**Fix:** Server-side cooldown keyed by `groupNumber` using a module-level `Map<number, number>` (on long-running host) or Upstash Redis / Vercel KV (on Vercel). Also add an early-return in `handleNotify` if `notifyingGroup === group.groupNumber`.

### WR-07: `checkAuth` effect uses eslint-disable to mask a real stale-closure dependency

**File:** `app/page.tsx:52-55`

Hoist `checkAuth` out or wrap in `useCallback([router])` and include in effect deps.

### WR-08: Store migration from legacy `groupStatuses` accepts arbitrary strings and `NaN` keys

**File:** `store/queueStore.ts:117-135`

`val as QueueStatus` is unchecked; a typo like `"notifed"` survives into the store and produces an unstyled card. `Number(key)` on `"undefined"` produces `NaN` which Zustand stores as `statuses[NaN]`. Validate both sides against a `readonly QueueStatus[]` array and `Number.isInteger`.

### WR-09: `setStatus` clears `notifiedAt` on status changes — breaks the type's "write once" contract

**File:** `store/queueStore.ts:37-43`

The type comment on `types/index.ts:23` says `notifiedAt` is "written once, never overwritten". The store silently relaxes that when any status change passes through `setStatus`. Decide on the contract: either preserve `notifiedAt` across all transitions except `reset()`/`requeueGroup()`, or update the type comment to reflect the actual behavior.

---

## Info

### IN-01: `NotificationResponse.whatsappStatus` field is semantically overloaded

**File:** `types/index.ts:41`, `app/api/notify/route.ts:119`

Comment says "SMS status via Twilio" but the field is named `whatsappStatus`. Rename to `smsStatus` or use a neutral `channelStatus` with a discriminator. Load-bearing footgun for future readers.

### IN-02: `NotificationResponse.results` is optional but always populated

**File:** `app/api/notify/route.ts`

Every use is `results!.push(...)`. Either make the type non-optional or build a local `const results: ... = []` and assemble the response at the end.

### IN-03: Status dropdown allows illegal transitions

**File:** `components/GroupCard.tsx:84-94`

Dropdown allows any status → any status, including `waiting → completed` (skipping notification entirely — those guests never get a message). Consider confirming jumps that skip `notified`.

### IN-04: `GroupCard` destructures `record` prop but never uses it

**File:** `components/GroupCard.tsx:36-43`

Reserved for Phase 2. Either prefix with `_record`, remove until phase 2 needs it, or document the reservation.

### IN-05: Default Next.js metadata description is still the scaffold placeholder

**File:** `app/layout.tsx:18`

`description: "Generated by create next app"` leaks into link previews. Also add `robots: { index: false, follow: false }` for a private app.

### IN-06: `require('qrcode-terminal')` in an ESM/TS module

**File:** `lib/whatsapp-session.ts:3-4`

Use `import qrcode from 'qrcode-terminal'` with `@ts-expect-error` or `@types/qrcode-terminal` if available.

### IN-07: Stats recomputed on every render without memoization

**File:** `app/page.tsx:271-278`

Trivially cheap for 700 guests, but wrapping in `useMemo([groups])` keeps the reference stable for any memoized downstream child. Noted for code-health only.

---

## Wedding-Day Reliability Summary

Biggest risks to the live event, ordered by severity:

1. **WhatsApp cannot run on Vercel** (CR-03) — blocking architectural decision.
2. **Twilio placeholder `+1234567890` causes 100% SMS failure** (found live during review) — no real number provisioned yet. Plus CR-02 means once a real number exists, `/api/notify` is an unauthenticated bill bomb.
3. **Gmail SMTP rate-limit mid-event** (WR-05) silently fails individual groups.
4. **WhatsApp session death mid-event** — no reconnect/QR-refresh path. Add a dashboard-visible status indicator wired to `/api/whatsapp-status`.
5. **Google Sheets unreachable** — initial load shows a full-screen error, but a failure mid-event will silently keep showing stale data. Add `onError` handling via `useEffect([isError])`.

---

## Not Flagged (per phase context)

- Twilio SMS re-introduction in `/api/notify/route.ts` after the 01-03 SUMMARY claimed removal is acknowledged — but the user has since confirmed SMS is intentionally part of the stack, so the correct cleanup is to provision a real Twilio number and update the 01-03 SUMMARY, not to remove SMS.

---

_Reviewed: 2026-04-11 by gsd-code-reviewer at standard depth_
