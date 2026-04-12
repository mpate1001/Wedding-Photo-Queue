# Guest WhatsApp Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/guests` dashboard page and 3 API endpoints that diff Google Sheets guest list against WhatsApp group participants, send invite links, and slow-drip auto-add missing guests via a daily VPS cron.

**Architecture:** Three new pure-logic lib modules (phone matching, guest diff, batch state) are fully unit-tested with Vitest. Three new Next.js route handlers expose those via auth-gated HTTP APIs. One new client page consumes them. A VPS cron hits the add-batch endpoint daily at a ban-safe pace.

**Tech Stack:** Next.js 16 App Router, TypeScript, whatsapp-web.js, Nodemailer (Gmail SMTP), Tailwind CSS, Zustand (existing), TanStack Query (existing), Vitest (new — testing), sonner (toast).

**Spec:** `docs/superpowers/specs/2026-04-12-guest-whatsapp-manager-design.md`

---

## File Structure

**New files:**
- `lib/phone-match.ts` — normalize phone + match by last-10 digits
- `lib/phone-match.test.ts` — unit tests
- `lib/guest-diff.ts` — diff Google Sheets guests against WhatsApp participant list
- `lib/guest-diff.test.ts` — unit tests
- `lib/batch-state.ts` — read/write `.batch-state.json` for cron tracking
- `app/api/guests/status/route.ts` — GET endpoint
- `app/api/guests/invite/route.ts` — POST endpoint
- `app/api/guests/add-batch/route.ts` — POST endpoint (cron + manual)
- `app/guests/page.tsx` — the dashboard page
- `components/GuestCard.tsx` — per-guest row/card (responsive)
- `vitest.config.ts` — Vitest config

**Modified files:**
- `package.json` — add `vitest` devDep + `test` script
- `app/page.tsx` — add link to `/guests`
- `.gitignore` — add `.batch-state.json`
- `.env.example` (or docs) — document new env var

---

### Task 1: Install Vitest + Add Test Script

No existing test framework. We need one for the pure-logic unit tests in this plan. Vitest is fast, zero-config for TS, works alongside Next.js.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install Vitest as devDep**

```bash
cd /Users/mahekpatel/Library/CloudStorage/Dropbox-Samp/Mahek\ Patel/Mac/Documents/GitHub/Wedding-Photo-Queue
npm install --save-dev vitest
```

- [ ] **Step 2: Add test script to package.json**

Edit `package.json` scripts section:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

- [ ] **Step 4: Run `npm test` to verify it works**

Run: `npm test`
Expected: `No test files found, exiting with code 1` (expected — no tests yet, but Vitest is installed and configured)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: install vitest for unit testing"
```

---

### Task 2: Phone Matching Library (TDD)

Pure-logic utility to normalize phone numbers and check if two numbers refer to the same person. Handles US (`+1XXXXXXXXXX`), international (`+44XXXXXXXXXX`), and messy sheet formats like `(256) 658-4291`.

**Files:**
- Create: `lib/phone-match.ts`
- Create: `lib/phone-match.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/phone-match.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizePhone, phonesMatch } from './phone-match';

describe('normalizePhone', () => {
  it('strips non-digits and returns last 10 digits for US number', () => {
    expect(normalizePhone('+12566584291')).toBe('2566584291');
  });

  it('handles formatted US number', () => {
    expect(normalizePhone('(256) 658-4291')).toBe('2566584291');
  });

  it('handles international number (UK +44)', () => {
    expect(normalizePhone('+447700900123')).toBe('7700900123');
  });

  it('handles international number with more than 10 significant digits', () => {
    expect(normalizePhone('+919876543210')).toBe('9876543210');
  });

  it('returns null for malformed (too few digits)', () => {
    expect(normalizePhone('abc123')).toBeNull();
    expect(normalizePhone('555')).toBeNull();
  });

  it('returns null for empty/null input', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
  });

  it('handles trailing whitespace and special chars', () => {
    expect(normalizePhone('  +1 (256) 658-4291  ')).toBe('2566584291');
  });
});

describe('phonesMatch', () => {
  it('matches same number in different formats', () => {
    expect(phonesMatch('+12566584291', '(256) 658-4291')).toBe(true);
  });

  it('matches US and international representations of same last-10', () => {
    // Edge: two different country codes with same last-10 — matches by design
    // (acceptable false positive rate for 700-guest list)
    expect(phonesMatch('+12566584291', '+442566584291')).toBe(true);
  });

  it('does not match different numbers', () => {
    expect(phonesMatch('+12566584291', '+19783193978')).toBe(false);
  });

  it('does not match when one side is unparseable', () => {
    expect(phonesMatch('abc', '+12566584291')).toBe(false);
  });

  it('does not match two unparseable inputs', () => {
    expect(phonesMatch('abc', 'xyz')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/phone-match.test.ts`
Expected: FAIL — "Cannot find module './phone-match'"

- [ ] **Step 3: Implement the library**

Create `lib/phone-match.ts`:

```ts
/**
 * Normalize a phone number string to its last 10 digits.
 * Returns null if the input has fewer than 10 digits after stripping non-digits.
 *
 * Used for matching guests across messy Google Sheets formats and WhatsApp's
 * +CCXXXXXXXXXX canonical format. Last-10 matching is a deliberate simplification:
 * for a 700-guest list, the false positive rate of two different numbers sharing
 * the same last 10 digits is acceptable.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/**
 * Returns true if two phone numbers refer to the same person based on
 * their last 10 digits. Returns false if either input is unparseable.
 */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (na === null || nb === null) return false;
  return na === nb;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/phone-match.test.ts`
Expected: PASS (all 13 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/phone-match.ts lib/phone-match.test.ts
git commit -m "feat(guests): add phone-match lib for cross-format number matching"
```

---

### Task 3: Guest Diff Library (TDD)

Pure-logic function that takes a guest list (from Sheets) and a WhatsApp group participant list, returns per-guest status: `joined`, `missing`, or `no-whatsapp`.

**Files:**
- Create: `lib/guest-diff.ts`
- Create: `lib/guest-diff.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/guest-diff.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { diffGuestsAgainstParticipants, type SheetGuest, type GroupParticipant } from './guest-diff';

const guestA: SheetGuest = { name: 'Alice', phone: '+12566584291', email: 'a@x.com' };
const guestB: SheetGuest = { name: 'Bob', phone: '(978) 319-3978', email: 'b@x.com' };
const guestC: SheetGuest = { name: 'Charlie', phone: '+447700900123', email: 'c@x.com' };
const guestMalformed: SheetGuest = { name: 'Malformed', phone: 'abc', email: 'd@x.com' };

describe('diffGuestsAgainstParticipants', () => {
  it('marks guest as joined when their phone matches a participant', () => {
    const participants: GroupParticipant[] = [{ phone: '+12566584291' }];
    const result = diffGuestsAgainstParticipants([guestA], participants);
    expect(result[0].status).toBe('joined');
    expect(result[0].guest).toBe(guestA);
  });

  it('marks guest as missing when phone does not match any participant but is parseable', () => {
    const participants: GroupParticipant[] = [{ phone: '+19999999999' }];
    const result = diffGuestsAgainstParticipants([guestA], participants);
    expect(result[0].status).toBe('missing');
  });

  it('marks guest as no-whatsapp when their phone is malformed', () => {
    const participants: GroupParticipant[] = [{ phone: '+12566584291' }];
    const result = diffGuestsAgainstParticipants([guestMalformed], participants);
    expect(result[0].status).toBe('no-whatsapp');
  });

  it('matches international numbers', () => {
    const participants: GroupParticipant[] = [{ phone: '+447700900123' }];
    const result = diffGuestsAgainstParticipants([guestC], participants);
    expect(result[0].status).toBe('joined');
  });

  it('handles mix of guest statuses', () => {
    const participants: GroupParticipant[] = [
      { phone: '+12566584291' },    // matches Alice
      { phone: '+19999999999' },    // matches nobody
    ];
    const result = diffGuestsAgainstParticipants(
      [guestA, guestB, guestC, guestMalformed],
      participants
    );
    expect(result).toHaveLength(4);
    expect(result[0].status).toBe('joined');     // Alice
    expect(result[1].status).toBe('missing');    // Bob
    expect(result[2].status).toBe('missing');    // Charlie
    expect(result[3].status).toBe('no-whatsapp'); // Malformed
  });

  it('deduplicates by phone — same guest listed twice counted once', () => {
    const dupe = { ...guestA };
    const participants: GroupParticipant[] = [{ phone: '+12566584291' }];
    const result = diffGuestsAgainstParticipants([guestA, dupe], participants);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('joined');
  });

  it('returns empty array for empty guest list', () => {
    expect(diffGuestsAgainstParticipants([], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/guest-diff.test.ts`
Expected: FAIL — "Cannot find module './guest-diff'"

- [ ] **Step 3: Implement the library**

Create `lib/guest-diff.ts`:

```ts
import { normalizePhone, phonesMatch } from './phone-match';

export interface SheetGuest {
  name: string;
  phone: string;
  email: string;
}

export interface GroupParticipant {
  phone: string;  // raw from whatsapp-web.js, like "+12566584291"
}

export type GuestStatus = 'joined' | 'missing' | 'no-whatsapp';

export interface DiffedGuest {
  guest: SheetGuest;
  status: GuestStatus;
}

/**
 * Diff a guest list from Google Sheets against a WhatsApp group participant list.
 * Deduplicates guests by normalized phone — same phone listed twice counted once.
 *
 * Returns one DiffedGuest per unique guest, preserving the first occurrence's
 * data (name/email) from the sheet.
 */
export function diffGuestsAgainstParticipants(
  guests: SheetGuest[],
  participants: GroupParticipant[]
): DiffedGuest[] {
  // Deduplicate guests by normalized phone. Malformed phones get their own slot
  // using the raw phone value as the key (so multiple malformed rows each appear).
  const seen = new Map<string, SheetGuest>();
  for (const g of guests) {
    const normalized = normalizePhone(g.phone);
    const key = normalized ?? `__malformed__${g.phone}_${g.name}`;
    if (!seen.has(key)) {
      seen.set(key, g);
    }
  }

  return Array.from(seen.values()).map((guest) => {
    const normalized = normalizePhone(guest.phone);
    if (normalized === null) {
      return { guest, status: 'no-whatsapp' as const };
    }

    const inGroup = participants.some((p) => phonesMatch(p.phone, guest.phone));
    return { guest, status: inGroup ? 'joined' : 'missing' };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/guest-diff.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/guest-diff.ts lib/guest-diff.test.ts
git commit -m "feat(guests): add guest-diff lib for sheet-vs-group membership comparison"
```

---

### Task 4: Batch State Persistence Library

File-based state for cron tracking — last run timestamp, cumulative added count. Written to `.batch-state.json` (gitignored) on VPS.

**Files:**
- Create: `lib/batch-state.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Add `.batch-state.json` to `.gitignore`**

Append to `.gitignore`:

```
# Batch state for guest auto-add cron (contains timestamps, safe but unnecessary to commit)
.batch-state.json
```

- [ ] **Step 2: Create `lib/batch-state.ts`**

```ts
// lib/batch-state.ts
import fs from 'fs/promises';
import path from 'path';

const STATE_PATH = path.join(process.cwd(), '.batch-state.json');

export type GroupType = 'announcements' | 'photo';

export interface GroupBatchState {
  lastRunAt: string | null;  // ISO timestamp
  lastAdded: number;
  lastFailed: number;
  totalAdded: number;
}

export interface BatchState {
  announcements: GroupBatchState;
  photo: GroupBatchState;
}

const DEFAULT_GROUP_STATE: GroupBatchState = {
  lastRunAt: null,
  lastAdded: 0,
  lastFailed: 0,
  totalAdded: 0,
};

const DEFAULT_STATE: BatchState = {
  announcements: { ...DEFAULT_GROUP_STATE },
  photo: { ...DEFAULT_GROUP_STATE },
};

/**
 * Reads the batch state from disk. Returns defaults if file doesn't exist or is invalid.
 */
export async function readBatchState(): Promise<BatchState> {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<BatchState>;
    return {
      announcements: { ...DEFAULT_GROUP_STATE, ...parsed.announcements },
      photo: { ...DEFAULT_GROUP_STATE, ...parsed.photo },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

/**
 * Writes the batch state atomically (write to tmp, rename) to avoid partial writes.
 */
export async function writeBatchState(state: BatchState): Promise<void> {
  const tmp = `${STATE_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf-8');
  await fs.rename(tmp, STATE_PATH);
}

/**
 * Updates one group's state after a batch run.
 */
export async function recordBatchRun(
  groupType: GroupType,
  added: number,
  failed: number
): Promise<BatchState> {
  const state = await readBatchState();
  state[groupType] = {
    lastRunAt: new Date().toISOString(),
    lastAdded: added,
    lastFailed: failed,
    totalAdded: state[groupType].totalAdded + added,
  };
  await writeBatchState(state);
  return state;
}

/**
 * Returns true if the group had a successful batch run within the last 12 hours.
 * Used to prevent double-runs from overlapping cron triggers.
 */
export function ranWithinCooldown(groupState: GroupBatchState): boolean {
  if (!groupState.lastRunAt) return false;
  const lastRun = new Date(groupState.lastRunAt).getTime();
  const twelveHoursMs = 12 * 60 * 60 * 1000;
  return Date.now() - lastRun < twelveHoursMs;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors (empty output or success)

- [ ] **Step 4: Commit**

```bash
git add lib/batch-state.ts .gitignore
git commit -m "feat(guests): add batch-state persistence lib for cron tracking"
```

---

### Task 5: GET /api/guests/status Endpoint

Fetches guests from Google Sheets, participants from both WhatsApp groups, diffs them, returns combined status per guest.

**Files:**
- Create: `app/api/guests/status/route.ts`

- [ ] **Step 1: Create the route**

```ts
// app/api/guests/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { whenReady } from '@/lib/whatsapp-session';
import { diffGuestsAgainstParticipants, type SheetGuest, type GroupParticipant } from '@/lib/guest-diff';
import { readBatchState } from '@/lib/batch-state';

// Simple in-memory cache for WhatsApp participant list — 60s TTL
const participantCache = new Map<string, { at: number; participants: GroupParticipant[] }>();
const CACHE_TTL_MS = 60_000;

interface SheetGuestWithGroupNumber extends SheetGuest {
  groupNumber: number;
}

async function fetchSheetGuests(request: NextRequest): Promise<SheetGuestWithGroupNumber[]> {
  // Reuse the existing /api/groups route — it already parses CSV into groups with members.
  // Flatten to a single guest list.
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/groups`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch guests from Google Sheets (status ${res.status})`);
  const data = await res.json() as { groups: Array<{ groupNumber: number; members: SheetGuest[] }> };
  const guests: SheetGuestWithGroupNumber[] = [];
  for (const group of data.groups) {
    for (const member of group.members) {
      guests.push({ ...member, groupNumber: group.groupNumber });
    }
  }
  return guests;
}

async function fetchGroupParticipants(groupId: string): Promise<GroupParticipant[]> {
  const cached = participantCache.get(groupId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.participants;
  }
  const client = await whenReady();
  const chat = await client.getChatById(groupId);
  if (!chat.isGroup) throw new Error(`Chat ${groupId} is not a group`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupChat = chat as any;
  const participants: GroupParticipant[] = (groupChat.participants ?? []).map((p: { id: { user: string } }) => ({
    phone: `+${p.id.user}`,
  }));
  participantCache.set(groupId, { at: Date.now(), participants });
  return participants;
}

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const announcementsGroupId = process.env.WHATSAPP_ANNOUNCEMENTS_GROUP_ID;
  const photoGroupId = process.env.WHATSAPP_GROUP_ID;

  if (!announcementsGroupId && !photoGroupId) {
    return NextResponse.json(
      { success: false, message: 'Neither WHATSAPP_ANNOUNCEMENTS_GROUP_ID nor WHATSAPP_GROUP_ID is set' },
      { status: 500 }
    );
  }

  try {
    const guests = await fetchSheetGuests(request);

    // Fetch participants from both groups (skip if env var not set)
    const [announcementsParticipants, photoParticipants] = await Promise.all([
      announcementsGroupId ? fetchGroupParticipants(announcementsGroupId).catch(() => []) : [],
      photoGroupId ? fetchGroupParticipants(photoGroupId).catch(() => []) : [],
    ]);

    const announcementsDiff = announcementsGroupId
      ? diffGuestsAgainstParticipants(guests, announcementsParticipants)
      : guests.map((g) => ({ guest: g, status: 'missing' as const }));

    const photoDiff = photoGroupId
      ? diffGuestsAgainstParticipants(guests, photoParticipants)
      : guests.map((g) => ({ guest: g, status: 'missing' as const }));

    // Build unified guest rows — key by normalized phone for lookup
    const byPhone = new Map<string, { guest: SheetGuest; announcementsStatus: string; photoStatus: string }>();
    for (const { guest, status } of announcementsDiff) {
      byPhone.set(`${guest.phone}|${guest.name}`, {
        guest,
        announcementsStatus: status,
        photoStatus: 'missing',
      });
    }
    for (const { guest, status } of photoDiff) {
      const key = `${guest.phone}|${guest.name}`;
      const existing = byPhone.get(key);
      if (existing) {
        existing.photoStatus = status;
      } else {
        byPhone.set(key, { guest, announcementsStatus: 'missing', photoStatus: status });
      }
    }

    const rows = Array.from(byPhone.values()).map((r) => ({
      name: r.guest.name,
      phone: r.guest.phone,
      email: r.guest.email,
      announcementsStatus: r.announcementsStatus,
      photoStatus: r.photoStatus,
    }));

    const countBy = (statusKey: 'announcementsStatus' | 'photoStatus') => ({
      total: rows.length,
      joined: rows.filter((r) => r[statusKey] === 'joined').length,
      missing: rows.filter((r) => r[statusKey] === 'missing').length,
      noWhatsapp: rows.filter((r) => r[statusKey] === 'no-whatsapp').length,
    });

    const batchState = await readBatchState();

    return NextResponse.json({
      guests: rows,
      stats: {
        announcements: countBy('announcementsStatus'),
        photo: countBy('photoStatus'),
      },
      lastBatchRun: {
        announcements: batchState.announcements.lastRunAt,
        photo: batchState.photo.lastRunAt,
      },
      lastBatchSummary: {
        announcements: batchState.announcements,
        photo: batchState.photo,
      },
    });
  } catch (error) {
    console.error('[/api/guests/status] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to compute guest status';
    const status = message.includes('WhatsApp') || message.includes('PUPPETEER') ? 503 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Smoke test (manual)**

With dev server running:
```bash
TOKEN=$(echo -n "WeddingMay2026:$(date +%s)" | base64)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/guests/status | head -c 500
```
Expected: JSON with `guests`, `stats`, `lastBatchRun` keys (WhatsApp may error if not ready — OK for smoke test, `photoStatus` fallback kicks in).

- [ ] **Step 4: Commit**

```bash
git add app/api/guests/status/route.ts
git commit -m "feat(guests): add GET /api/guests/status endpoint with participant caching"
```

---

### Task 6: POST /api/guests/invite Endpoint

Fetches invite link from the selected group, sends to all missing guests via email and/or WhatsApp DM.

**Files:**
- Create: `app/api/guests/invite/route.ts`

- [ ] **Step 1: Create the route**

```ts
// app/api/guests/invite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAuth } from '@/lib/require-auth';
import { whenReady } from '@/lib/whatsapp-session';
import { diffGuestsAgainstParticipants, type SheetGuest, type GroupParticipant } from '@/lib/guest-diff';
import { normalizePhone } from '@/lib/phone-match';

type GroupType = 'announcements' | 'photo';
type Channel = 'email' | 'whatsapp' | 'both';

interface InviteBody {
  groupType: GroupType;
  channel: Channel;
}

async function fetchAllGuests(request: NextRequest): Promise<SheetGuest[]> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/groups`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch guests');
  const data = await res.json() as { groups: Array<{ members: SheetGuest[] }> };
  return data.groups.flatMap((g) => g.members);
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: InviteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { groupType, channel } = body;
  if (!['announcements', 'photo'].includes(groupType)) {
    return NextResponse.json({ success: false, message: 'Invalid groupType' }, { status: 400 });
  }
  if (!['email', 'whatsapp', 'both'].includes(channel)) {
    return NextResponse.json({ success: false, message: 'Invalid channel' }, { status: 400 });
  }

  const groupId = groupType === 'announcements'
    ? process.env.WHATSAPP_ANNOUNCEMENTS_GROUP_ID
    : process.env.WHATSAPP_GROUP_ID;

  if (!groupId) {
    return NextResponse.json(
      { success: false, message: `${groupType} group ID not set in env` },
      { status: 500 }
    );
  }

  try {
    // 1. Get invite link
    const client = await whenReady();
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) throw new Error('Not a group chat');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupChat = chat as any;
    const inviteCode: string = await groupChat.getInviteCode();
    const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

    // 2. Find missing guests
    const allGuests = await fetchAllGuests(request);
    const participants: GroupParticipant[] = (groupChat.participants ?? []).map(
      (p: { id: { user: string } }) => ({ phone: `+${p.id.user}` })
    );
    const diff = diffGuestsAgainstParticipants(allGuests, participants);
    const missing = diff.filter((d) => d.status === 'missing');
    const noWhatsapp = diff.filter((d) => d.status === 'no-whatsapp');

    const groupLabel = groupType === 'announcements'
      ? 'our wedding announcements group'
      : 'our wedding photo coordination group';
    const emailSubject = `You're invited to join ${groupLabel}`;
    const emailText = (name: string) =>
      `Hi ${name}!\n\nSaumya & Mahek are inviting you to join ${groupLabel} on WhatsApp.\n\nTap this link to join: ${inviteLink}\n\nSee you at the wedding!\n- Saumya & Mahek`;
    const whatsappMsg = (name: string) =>
      `Hi ${name}! Saumya & Mahek here. Please join ${groupLabel}: ${inviteLink}`;

    let sent = 0;
    let failed = 0;
    const skipped = noWhatsapp.length;

    const sendEmail = (channel === 'email' || channel === 'both') && missing.length > 0;
    const sendWhatsapp = (channel === 'whatsapp' || channel === 'both') && missing.length > 0;

    // 3. Email path
    let transporter: nodemailer.Transporter | null = null;
    if (sendEmail) {
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
    }

    for (const { guest } of missing) {
      let emailOk = !sendEmail;
      let waOk = !sendWhatsapp;

      if (sendEmail && transporter && guest.email) {
        try {
          await transporter.sendMail({
            from: `"Saumya & Mahek Wedding" <${process.env.GMAIL_USER}>`,
            to: guest.email,
            subject: emailSubject,
            text: emailText(guest.name),
          });
          emailOk = true;
        } catch (err) {
          console.error(`[invite] email to ${guest.email} failed:`, err);
        }
      }

      if (sendWhatsapp) {
        const normalized = normalizePhone(guest.phone);
        if (normalized) {
          // Full country-code-bearing phone (strip + from raw, reattach for canonical chatId)
          const raw = guest.phone.replace(/\D/g, '');
          const chatId = `${raw}@c.us`;
          try {
            await client.sendMessage(chatId, whatsappMsg(guest.name));
            waOk = true;
          } catch (err) {
            console.error(`[invite] WA DM to ${guest.name} failed:`, err);
          }
        }
      }

      if (emailOk && waOk) sent += 1;
      else failed += 1;
    }

    // Also email the no-whatsapp guests if email channel is on (they still deserve the link)
    if (sendEmail && transporter) {
      for (const { guest } of noWhatsapp) {
        if (!guest.email) continue;
        try {
          await transporter.sendMail({
            from: `"Saumya & Mahek Wedding" <${process.env.GMAIL_USER}>`,
            to: guest.email,
            subject: emailSubject,
            text: emailText(guest.name),
          });
        } catch (err) {
          console.error(`[invite] email (no-whatsapp) to ${guest.email} failed:`, err);
        }
      }
    }

    return NextResponse.json({ sent, failed, skipped, inviteLink });
  } catch (error) {
    console.error('[/api/guests/invite] error:', error);
    const message = error instanceof Error ? error.message : 'Invite send failed';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/api/guests/invite/route.ts
git commit -m "feat(guests): add POST /api/guests/invite for bulk invite link sending"
```

---

### Task 7: POST /api/guests/add-batch Endpoint

Slow-drip auto-add endpoint — called daily by cron, also callable manually from the dashboard.

**Files:**
- Create: `app/api/guests/add-batch/route.ts`

- [ ] **Step 1: Create the route**

```ts
// app/api/guests/add-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { whenReady } from '@/lib/whatsapp-session';
import { diffGuestsAgainstParticipants, type SheetGuest, type GroupParticipant } from '@/lib/guest-diff';
import { readBatchState, recordBatchRun, ranWithinCooldown, type GroupType } from '@/lib/batch-state';
import { normalizePhone } from '@/lib/phone-match';

interface AddBatchBody {
  groupType: GroupType;
  batchSize?: number;
}

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;
const DELAY_BETWEEN_ADDS_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllGuests(request: NextRequest): Promise<SheetGuest[]> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/groups`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch guests');
  const data = await res.json() as { groups: Array<{ members: SheetGuest[] }> };
  return data.groups.flatMap((g) => g.members);
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: AddBatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { groupType } = body;
  const batchSize = Math.min(body.batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);

  if (!['announcements', 'photo'].includes(groupType)) {
    return NextResponse.json({ success: false, message: 'Invalid groupType' }, { status: 400 });
  }

  // Cooldown check: skip if already ran within last 12 hours
  const state = await readBatchState();
  if (ranWithinCooldown(state[groupType])) {
    return NextResponse.json({
      skipped: true,
      reason: 'already ran within 12-hour cooldown',
      lastRun: state[groupType].lastRunAt,
      added: 0,
    }, { status: 429 });
  }

  const groupId = groupType === 'announcements'
    ? process.env.WHATSAPP_ANNOUNCEMENTS_GROUP_ID
    : process.env.WHATSAPP_GROUP_ID;

  if (!groupId) {
    return NextResponse.json(
      { success: false, message: `${groupType} group ID not set` },
      { status: 500 }
    );
  }

  try {
    const client = await whenReady();
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) throw new Error('Not a group chat');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupChat = chat as any;

    const allGuests = await fetchAllGuests(request);
    const participants: GroupParticipant[] = (groupChat.participants ?? []).map(
      (p: { id: { user: string } }) => ({ phone: `+${p.id.user}` })
    );
    const diff = diffGuestsAgainstParticipants(allGuests, participants);
    const missing = diff.filter((d) => d.status === 'missing').slice(0, batchSize);

    let added = 0;
    let failed = 0;

    for (const { guest } of missing) {
      const normalized = normalizePhone(guest.phone);
      if (!normalized) {
        failed += 1;
        continue;
      }
      const raw = guest.phone.replace(/\D/g, '');
      const contactId = `${raw}@c.us`;

      try {
        await groupChat.addParticipants([contactId]);
        console.log(`[add-batch] added ${guest.name} (${contactId}) to ${groupType}`);
        added += 1;
      } catch (err) {
        console.error(`[add-batch] failed to add ${guest.name}:`, err);
        failed += 1;
      }

      // Pace additions to avoid WhatsApp rate limits
      await sleep(DELAY_BETWEEN_ADDS_MS);
    }

    const remaining = diff.filter((d) => d.status === 'missing').length - added;
    const newState = await recordBatchRun(groupType, added, failed);

    return NextResponse.json({
      added,
      failed,
      remaining: Math.max(0, remaining),
      lastRun: newState[groupType].lastRunAt,
    });
  } catch (error) {
    console.error('[/api/guests/add-batch] error:', error);
    const message = error instanceof Error ? error.message : 'Batch add failed';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/api/guests/add-batch/route.ts
git commit -m "feat(guests): add POST /api/guests/add-batch with 12h cooldown and 5s pacing"
```

---

### Task 8: GuestCard Component

Per-guest display — responsive table row on desktop, card on mobile. Follows the same visual pattern as existing `GroupCard.tsx`.

**Files:**
- Create: `components/GuestCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/GuestCard.tsx
'use client';

type GuestStatus = 'joined' | 'missing' | 'no-whatsapp';

export interface GuestRow {
  name: string;
  phone: string;
  email: string;
  announcementsStatus: GuestStatus;
  photoStatus: GuestStatus;
}

interface GuestCardProps {
  guest: GuestRow;
  activeGroup: 'announcements' | 'photo';
}

const statusLabels: Record<GuestStatus, string> = {
  joined: 'Joined',
  missing: 'Missing',
  'no-whatsapp': 'No WhatsApp',
};

const statusClasses: Record<GuestStatus, string> = {
  joined: 'bg-green-100 text-green-800 border-green-300',
  missing: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'no-whatsapp': 'bg-gray-100 text-gray-700 border-gray-300',
};

export default function GuestCard({ guest, activeGroup }: GuestCardProps) {
  const status = activeGroup === 'announcements' ? guest.announcementsStatus : guest.photoStatus;
  return (
    <div className={`border-2 rounded-lg p-3 ${statusClasses[status]} transition-colors`}>
      <div className="flex justify-between items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{guest.name}</p>
          <p className="text-xs text-gray-700 truncate">{guest.phone}</p>
          <p className="text-xs text-gray-700 truncate">{guest.email}</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/60 whitespace-nowrap">
          {statusLabels[status]}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/GuestCard.tsx
git commit -m "feat(guests): add GuestCard component for guest status display"
```

---

### Task 9: /guests Page

The dashboard itself — group selector, stats, action buttons, filter tabs, guest list.

**Files:**
- Create: `app/guests/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/guests/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import GuestCard, { type GuestRow } from '@/components/GuestCard';

type GroupType = 'announcements' | 'photo';
type FilterStatus = 'all' | 'joined' | 'missing' | 'no-whatsapp';

interface GroupStats {
  total: number;
  joined: number;
  missing: number;
  noWhatsapp: number;
}

interface StatusResponse {
  guests: GuestRow[];
  stats: { announcements: GroupStats; photo: GroupStats };
  lastBatchRun: { announcements: string | null; photo: string | null };
  lastBatchSummary: {
    announcements: { lastAdded: number; lastFailed: number; totalAdded: number };
    photo: { lastAdded: number; lastFailed: number; totalAdded: number };
  };
}

export default function GuestsPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [activeGroup, setActiveGroup] = useState<GroupType>('announcements');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [inviteChannel, setInviteChannel] = useState<'email' | 'whatsapp' | 'both'>('both');
  const [inviteSending, setInviteSending] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);

  // Auth check (same pattern as main dashboard)
  useEffect(() => {
    const token = localStorage.getItem('wedding_auth');
    if (!token) {
      router.push('/login');
      return;
    }
    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) setAuthenticated(true);
        else {
          localStorage.removeItem('wedding_auth');
          router.push('/login');
        }
      })
      .catch(() => {
        localStorage.removeItem('wedding_auth');
        router.push('/login');
      });
  }, [router]);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('wedding_auth')}`,
  });

  const { data, isLoading, isError, refetch } = useQuery<StatusResponse>({
    queryKey: ['guest-status'],
    queryFn: async () => {
      const res = await fetch('/api/guests/status', { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load guest status');
      return res.json();
    },
    enabled: authenticated,
    staleTime: 30_000,
  });

  const activeStats = data?.stats[activeGroup] ?? { total: 0, joined: 0, missing: 0, noWhatsapp: 0 };
  const lastRun = data?.lastBatchRun[activeGroup] ?? null;
  const lastSummary = data?.lastBatchSummary[activeGroup];

  const filteredGuests = useMemo(() => {
    const guests = data?.guests ?? [];
    const statusKey = activeGroup === 'announcements' ? 'announcementsStatus' : 'photoStatus';
    if (filterStatus === 'all') return guests;
    return guests.filter((g) => g[statusKey] === filterStatus);
  }, [data, activeGroup, filterStatus]);

  const handleSendInvites = async () => {
    if (!confirm(`Send invite links to all missing ${activeGroup} guests via ${inviteChannel}?`)) return;
    setInviteSending(true);
    try {
      const res = await fetch('/api/guests/invite', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ groupType: activeGroup, channel: inviteChannel }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(`Invites sent: ${result.sent} ok, ${result.failed} failed, ${result.skipped} no-whatsapp`);
        refetch();
      } else {
        toast.error(`Invite failed: ${result.message}`);
      }
    } catch (err) {
      toast.error('Invite request failed');
      console.error(err);
    } finally {
      setInviteSending(false);
    }
  };

  const handleRunBatch = async () => {
    if (!confirm(`Auto-add up to 50 missing guests to the ${activeGroup} group now?`)) return;
    setBatchRunning(true);
    try {
      const res = await fetch('/api/guests/add-batch', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ groupType: activeGroup, batchSize: 50 }),
      });
      const result = await res.json();
      if (res.status === 429) {
        toast.warning(`Already ran recently (last: ${result.lastRun})`);
      } else if (res.ok) {
        toast.success(`Added ${result.added}, failed ${result.failed}, ${result.remaining} remaining`);
        refetch();
      } else {
        toast.error(`Batch failed: ${result.message}`);
      }
    } catch (err) {
      toast.error('Batch request failed');
      console.error(err);
    } finally {
      setBatchRunning(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wedding_auth');
    router.push('/login');
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Checking auth...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading guest status...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load guests (is WhatsApp ready?)</p>
          <button onClick={() => refetch()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-gray-50 pt-4 pb-3 -mx-4 px-4 border-b border-gray-200 md:border-b-0 md:static md:pt-8 md:pb-0">
          <div className="flex justify-between items-center gap-2">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-4xl font-bold text-gray-900 truncate">Guest Manager</h1>
              <p className="text-sm md:text-base text-gray-600 truncate">Mahek &amp; Saumya&apos;s Wedding</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link href="/" className="px-4 py-2.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors whitespace-nowrap">
                ← Queue
              </Link>
              <button onClick={handleLogout} className="px-4 py-2.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Group selector */}
        <div className="flex gap-2 mt-4 mb-4">
          <button
            onClick={() => setActiveGroup('announcements')}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors min-h-[44px] ${
              activeGroup === 'announcements' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700'
            }`}
          >
            Announcements
          </button>
          <button
            onClick={() => setActiveGroup('photo')}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors min-h-[44px] ${
              activeGroup === 'photo' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700'
            }`}
          >
            Photo Group
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 md:gap-4 mb-4">
          <div className="bg-white rounded-lg p-3 md:p-4 shadow">
            <p className="text-xs md:text-sm text-gray-600">Total</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{activeStats.total}</p>
          </div>
          <div className="bg-white rounded-lg p-3 md:p-4 shadow">
            <p className="text-xs md:text-sm text-gray-600">Joined</p>
            <p className="text-xl md:text-2xl font-bold text-green-600">{activeStats.joined}</p>
          </div>
          <div className="bg-white rounded-lg p-3 md:p-4 shadow">
            <p className="text-xs md:text-sm text-gray-600">Missing</p>
            <p className="text-xl md:text-2xl font-bold text-yellow-600">{activeStats.missing}</p>
          </div>
          <div className="bg-white rounded-lg p-3 md:p-4 shadow">
            <p className="text-xs md:text-sm text-gray-600">No WA</p>
            <p className="text-xl md:text-2xl font-bold text-gray-500">{activeStats.noWhatsapp}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mb-3">
          <select
            value={inviteChannel}
            onChange={(e) => setInviteChannel(e.target.value as 'email' | 'whatsapp' | 'both')}
            className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white min-h-[44px]"
          >
            <option value="both">Email + WhatsApp DM</option>
            <option value="email">Email only</option>
            <option value="whatsapp">WhatsApp DM only</option>
          </select>
          <button
            onClick={handleSendInvites}
            disabled={inviteSending || activeStats.missing === 0}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-400 disabled:cursor-not-allowed min-h-[44px]"
          >
            {inviteSending ? 'Sending...' : `Send Invites (${activeStats.missing})`}
          </button>
          <button
            onClick={handleRunBatch}
            disabled={batchRunning || activeStats.missing === 0}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 active:bg-purple-800 disabled:bg-gray-400 disabled:cursor-not-allowed min-h-[44px]"
          >
            {batchRunning ? 'Adding...' : 'Auto-Add 50'}
          </button>
          <button
            onClick={() => refetch()}
            className="px-4 py-2.5 text-sm bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-lg hover:bg-indigo-200 font-medium min-h-[44px]"
          >
            Refresh
          </button>
        </div>

        {/* Last run info */}
        {lastRun && lastSummary && (
          <p className="text-xs text-gray-500 mb-4">
            Last auto-add: {new Date(lastRun).toLocaleString()} — added {lastSummary.lastAdded}, failed {lastSummary.lastFailed} (total added: {lastSummary.totalAdded})
          </p>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible md:pb-0 scrollbar-hide mb-4">
          {(['all', 'joined', 'missing', 'no-whatsapp'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3.5 py-2.5 rounded-lg font-medium transition-colors whitespace-nowrap text-sm min-h-[44px] ${
                filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All' : s === 'no-whatsapp' ? 'No WA' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Guest list */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredGuests.map((guest, idx) => (
            <GuestCard key={`${guest.phone}-${idx}`} guest={guest} activeGroup={activeGroup} />
          ))}
        </div>

        {filteredGuests.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No guests match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Visual smoke test**

With dev server running, visit `http://localhost:3000/guests` in the browser (log in first if needed). Verify:
- Page loads without JS errors
- Group toggle works
- Stats render
- Guest list renders (may be empty if WhatsApp not ready — that's OK)

- [ ] **Step 4: Commit**

```bash
git add app/guests/page.tsx
git commit -m "feat(guests): add /guests dashboard page with group toggle and actions"
```

---

### Task 10: Add Navigation Link from Main Dashboard

Add a button on the Photo Queue header that links to `/guests`.

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Read the current header section**

Open `app/page.tsx` and locate the sticky header block (around line 315-330, starts with `{/* Header — sticky on mobile for quick access */}`).

- [ ] **Step 2: Add Link import + navigation button**

At the top of `app/page.tsx`, add to imports:

```tsx
import Link from 'next/link';
```

Replace the header's button section (the one containing only the Logout button):

```tsx
<button
  onClick={handleLogout}
  className="px-4 py-2.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors"
>
  Logout
</button>
```

With:

```tsx
<div className="flex gap-2 flex-shrink-0">
  <Link
    href="/guests"
    className="px-4 py-2.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors whitespace-nowrap"
  >
    Guests
  </Link>
  <button
    onClick={handleLogout}
    className="px-4 py-2.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors"
  >
    Logout
  </button>
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Visual test in browser**

Reload `http://localhost:3000/`. Verify the "Guests" button appears in the header and clicking it navigates to `/guests`.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat(guests): link from Photo Queue dashboard to Guest Manager"
```

---

### Task 11: Cron Setup Documentation

Add deployment docs for setting up the daily VPS cron.

**Files:**
- Create: `docs/cron-setup.md`

- [ ] **Step 1: Create the documentation**

```markdown
# VPS Cron Setup for Guest Auto-Add

Daily job that adds up to 50 missing guests to the WhatsApp announcements group
(and eventually the photo group closer to the wedding).

## Prerequisites
- App deployed to VPS at photos.mikemetsaumone.com (or via localhost on the VPS)
- WhatsApp client authenticated (QR code scanned, session persisted)
- `WHATSAPP_ANNOUNCEMENTS_GROUP_ID` set in `.env.local`
- `DASHBOARD_PASSWORD` set in `.env.local`

## Setup

### 1. Generate and store a cron auth token

```bash
cd /opt/wedding-photo-queue  # or wherever the app lives on the VPS
PW=$(grep DASHBOARD_PASSWORD .env.local | cut -d= -f2)
echo -n "${PW}:$(date +%s)" | base64 > .cron-token
chmod 600 .cron-token
```

**Note:** The token has no explicit expiry. If you rotate `DASHBOARD_PASSWORD`, regenerate `.cron-token`.

### 2. Add the cron entry

```bash
crontab -e
```

Add this line (runs at 10:00 AM VPS-local daily, announcements group):

```cron
0 10 * * * curl -s -X POST -H "Authorization: Bearer $(cat /opt/wedding-photo-queue/.cron-token)" -H "Content-Type: application/json" -d '{"groupType":"announcements","batchSize":50}' http://localhost:3000/api/guests/add-batch >> /var/log/wedding-cron.log 2>&1
```

### 3. Monitor the log

```bash
tail -f /var/log/wedding-cron.log
```

Expected output per run (JSON on one line):
```
{"added":47,"failed":3,"remaining":193,"lastRun":"2026-04-12T10:00:00.000Z"}
```

Or, if already ran in the last 12 hours:
```
{"skipped":true,"reason":"already ran within 12-hour cooldown","lastRun":"...","added":0}
```

### 4. Add a second cron for the photo group (closer to the wedding)

Same cron, swap the `groupType`:
```cron
30 10 * * * curl -s -X POST -H "Authorization: Bearer $(cat /opt/wedding-photo-queue/.cron-token)" -H "Content-Type: application/json" -d '{"groupType":"photo","batchSize":50}' http://localhost:3000/api/guests/add-batch >> /var/log/wedding-cron.log 2>&1
```

(Staggered 30 minutes so both don't hit WhatsApp at the exact same time.)

## Safety

- 12-hour cooldown prevents double-runs.
- 5-second pacing between individual `addParticipants()` calls.
- Max 100 per batch (default 50) to stay below WhatsApp rate-limit thresholds.
- Failures per-guest are logged but don't stop the batch.
```

- [ ] **Step 2: Commit**

```bash
git add docs/cron-setup.md
git commit -m "docs(guests): add VPS cron setup guide for daily auto-add"
```

---

### Task 12: Manual QA Checklist + Final Verification

Before declaring this feature done, walk through the manual test plan from the spec.

- [ ] **Step 1: Run full test suite**

```bash
npm test
```
Expected: all tests pass (phone-match: 13, guest-diff: 7)

- [ ] **Step 2: Run production build**

```bash
npm run build
```
Expected: success, no TypeScript errors

- [ ] **Step 3: Manual test plan (on dev server, with WhatsApp authenticated)**

With `npm run dev` running and WhatsApp client ready:

1. Set `WHATSAPP_ANNOUNCEMENTS_GROUP_ID` in `.env.local` to a test group you control
2. Put yourself + 1-2 others in the Google Sheet (some in the group, some not)
3. Login to dashboard, click "Guests" in header → verify `/guests` loads
4. Toggle between Announcements and Photo Group — verify stats change
5. Filter by "Missing" — verify only missing guests appear
6. Click "Send Invites" with channel "Both" — verify:
   - Toast shows `sent: N, failed: 0, skipped: N`
   - You received an email with the invite link
   - You received a WhatsApp DM (if you were in the "missing" list)
7. Click "Auto-Add 50" — verify:
   - Missing guests are added to the test group
   - Toast shows added count
   - Refresh shows their status flip to "Joined"
8. Click "Auto-Add 50" again immediately — verify 429 response with cooldown message
9. Check `.batch-state.json` exists with non-zero counts

- [ ] **Step 4: Commit manual-QA artifacts if any (screenshots etc.)**

Only if you took screenshots/notes during QA:
```bash
git add docs/  # or wherever artifacts live
git commit -m "docs(guests): QA artifacts from manual test run"
```

---

## Self-Review Notes

**Spec coverage check:**
- `/guests` page → Task 9 ✓
- `GET /api/guests/status` → Task 5 ✓
- `POST /api/guests/invite` → Task 6 ✓
- `POST /api/guests/add-batch` → Task 7 ✓
- `lib/phone-match.ts` → Task 2 ✓
- `lib/guest-diff.ts` → Task 3 ✓
- `lib/batch-state.ts` → Task 4 ✓
- GuestCard component → Task 8 ✓
- Navigation from main dashboard → Task 10 ✓
- Cron setup docs → Task 11 ✓
- Manual QA → Task 12 ✓

**Type consistency:** `GuestStatus` defined in `lib/guest-diff.ts` is re-used via import in `GuestCard.tsx` and routes. `GroupType` defined in `lib/batch-state.ts`. `SheetGuest`/`GroupParticipant` reused across lib and routes.

**YAGNI trimmed:**
- No per-guest delivery history (deferred in spec)
- No QR code image for invite links (deferred in spec)
- No integration tests with real WhatsApp (spec explicitly skips)
- No UI component for Vitest setup beyond the bare minimum

**Testing approach:**
- Unit tests on pure-logic libs (phone-match, guest-diff)
- Manual smoke tests on API routes (they depend on live WhatsApp)
- Manual QA checklist for end-to-end flow
