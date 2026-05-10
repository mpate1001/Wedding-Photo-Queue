---
quick_id: 260509-wfl
slug: fix-lid-is-missing-in-chat-table-when-ad
type: quick-task
branch: dev
files_modified:
  - lib/resolve-lid.ts
  - app/api/guests/add-one/route.ts
  - app/api/guests/add-batch/route.ts
autonomous: true
---

<objective>
Fix the "Lid is missing in chat table" error thrown by `groupChat.addParticipants([id])` in whatsapp-web.js for contacts the WhatsApp account has never DM'd before.

Purpose: Without this fix, the bulk add flow fails for the majority of the ~700 wedding guests (May 24 2026, 15 days out) the coordinator must add to the announcements and photo groups via this dashboard. The current `add-one/route.ts` calls `client.getChatById(resolvedId)` as a pre-resolve, but `getChatById` alone does NOT trigger the chat-table sync that populates the LID. `add-batch/route.ts` has no pre-resolve at all.

Output: A shared `resolveLidForAdd()` helper that forces the LID sync via `fetchMessages({limit:1})` + `getProfilePicUrl()` (belt-and-suspenders side effects), wired into both add routes.
</objective>

<scope_boundary>
**In scope (exactly 3 files):**
- NEW: `lib/resolve-lid.ts`
- MODIFY: `app/api/guests/add-one/route.ts` (add import + replace pre-resolve block)
- MODIFY: `app/api/guests/add-batch/route.ts` (add import + replace per-guest add block + rename `contactId`→`resolvedId` in log/lookup lines)

**Out of scope — DO NOT touch:**
- Do NOT change `requireAuth` or any auth code
- Do NOT modify `lib/whatsapp-session.ts`
- Do NOT change route signatures or response schemas
- Do NOT add new endpoints
- Do NOT touch any other file
- Do NOT add tests (no existing whatsapp-web.js test fixtures)
</scope_boundary>

<context>
@CLAUDE.md
@app/api/guests/add-one/route.ts
@app/api/guests/add-batch/route.ts
</context>

<tasks>

<task type="auto" id="1">
  <name>Task 1: Create lib/resolve-lid.ts helper</name>
  <files>lib/resolve-lid.ts</files>
  <action>
Use the Write tool to create `lib/resolve-lid.ts` with the EXACT content below. This is a new file — no Read first required.

```ts
import type { Client } from 'whatsapp-web.js';

/**
 * Resolves a raw phone number to a WhatsApp _serialized WID and forces the
 * LID metadata sync that addParticipants requires. Returns null if the number
 * is not registered on WhatsApp.
 *
 * Why: getChatById() alone returns a Chat instance without triggering the
 * chat-table populate that holds the LID. fetchMessages and getProfilePicUrl
 * both have the side effect of forcing that sync — running both as
 * belt-and-suspenders covers contacts who block one or the other.
 */
export async function resolveLidForAdd(
  client: Client,
  rawPhone: string
): Promise<string | null> {
  const numberId = await client.getNumberId(rawPhone);
  if (!numberId) return null;
  const resolvedId = numberId._serialized;

  try {
    const chat = await client.getChatById(resolvedId);
    await chat.fetchMessages({ limit: 1 });
  } catch (e) {
    console.warn(`[resolve-lid] fetchMessages failed for ${resolvedId}:`, e);
  }

  try {
    await client.getProfilePicUrl(resolvedId);
  } catch {
    // Profile pic privacy-blocked contacts throw — but the side effect of
    // contact metadata fetch already populated LID. Silently ignore.
  }

  return resolvedId;
}
```
  </action>
  <verify>
    <automated>test -f lib/resolve-lid.ts &amp;&amp; grep -c "export async function resolveLidForAdd" lib/resolve-lid.ts | grep -q "^1$"</automated>
  </verify>
  <done>File `lib/resolve-lid.ts` exists with the exact content above. Exports `resolveLidForAdd(client, rawPhone)`.</done>
</task>

<task type="auto" id="2">
  <name>Task 2: Wire resolveLidForAdd into add-one route</name>
  <files>app/api/guests/add-one/route.ts</files>
  <action>
Make TWO Edit-tool changes to `app/api/guests/add-one/route.ts`. Use full-line `old_string` so substitutions are unambiguous.

**Edit 2a — Add import.** Insert the new import on the line immediately after the existing `normalizePhone` import.

old_string:
```
import { normalizePhone } from '@/lib/phone-match';
import type { GroupType } from '@/lib/batch-state';
```

new_string:
```
import { normalizePhone } from '@/lib/phone-match';
import { resolveLidForAdd } from '@/lib/resolve-lid';
import type { GroupType } from '@/lib/batch-state';
```

**Edit 2b — Replace pre-resolve block.** Replace the entire `// Pre-resolve: ...` comment block plus the `getNumberId`, `not-on-whatsapp` early-return, `resolvedId` assignment, and inner try/catch around `getChatById(resolvedId)` (current lines 61–79) with a single call to `resolveLidForAdd`. The line `const result = await groupChat.addParticipants([resolvedId]);` and everything after it MUST remain unchanged.

old_string:
```
    // Pre-resolve: WhatsApp requires the contact's LID cached in its local chat
    // table before addParticipants works. Without this, the library throws
    // "Lid is missing in chat table". getNumberId forces number resolution;
    // getChatById populates the chat table entry.
    const numberId = await client.getNumberId(raw);
    if (!numberId) {
      console.log(`[add-one] not-on-whatsapp ${contactId}`);
      return NextResponse.json({
        success: false,
        outcome: 'not-on-whatsapp' as AddOutcome,
        message: 'Phone number is not registered on WhatsApp',
      });
    }
    const resolvedId = numberId._serialized;
    try {
      await client.getChatById(resolvedId);
    } catch (resolveErr) {
      console.warn(`[add-one] pre-resolve getChatById failed for ${resolvedId}:`, resolveErr);
    }
```

new_string:
```
    // Resolve LID for addParticipants — see lib/resolve-lid.ts for why
    const resolvedId = await resolveLidForAdd(client, raw);
    if (!resolvedId) {
      console.log(`[add-one] not-on-whatsapp ${contactId}`);
      return NextResponse.json({
        success: false,
        outcome: 'not-on-whatsapp' as AddOutcome,
        message: 'Phone number is not registered on WhatsApp',
      });
    }
```

Note: `contactId` (declared on line 52 as `${raw}@c.us`) is still referenced inside the new `not-on-whatsapp` log line, so it MUST remain declared at line 52. Do not delete it.
  </action>
  <verify>
    <automated>grep -c "resolveLidForAdd" app/api/guests/add-one/route.ts | awk '{ if ($1 &gt;= 2) exit 0; else exit 1 }' &amp;&amp; ! grep -q "client.getNumberId(raw)" app/api/guests/add-one/route.ts &amp;&amp; ! grep -q "pre-resolve getChatById failed" app/api/guests/add-one/route.ts</automated>
  </verify>
  <done>Import line for `resolveLidForAdd` present. Old `getNumberId(raw)` + inner `getChatById(resolvedId)` block removed. New single-call resolve block in place. The `addParticipants([resolvedId])` line and everything after it untouched. `contactId` declaration on line 52 still present (used in the not-on-whatsapp log).</done>
</task>

<task type="auto" id="3">
  <name>Task 3: Wire resolveLidForAdd into add-batch route + rename contactId→resolvedId in per-guest loop</name>
  <files>app/api/guests/add-batch/route.ts</files>
  <action>
Make THREE Edit-tool changes to `app/api/guests/add-batch/route.ts`. Use full-line `old_string` so substitutions are unambiguous.

**Edit 3a — Add import.** Insert the new import on the line immediately after the existing `fetchFinalGuestList` import.

old_string:
```
import { fetchFinalGuestList } from '@/lib/sheets';
```

new_string:
```
import { fetchFinalGuestList } from '@/lib/sheets';
import { resolveLidForAdd } from '@/lib/resolve-lid';
```

**Edit 3b — Replace per-guest add block.** Replace the lines that build `contactId` and call `addParticipants([contactId])` so they instead call `resolveLidForAdd` and then `addParticipants([resolvedId])`. Removes the `const contactId = ...` line entirely (no longer needed; uses `resolvedId` everywhere downstream).

old_string:
```
      const raw = guest.phone.replace(/\D/g, '');
      const contactId = `${raw}@c.us`;

      try {
        // whatsapp-web.js returns either:
        //   - object: { [contactId]: { code, message, isInviteV4Sent } } for per-contact results
        //   - string: a group-level error message (e.g. bot is not admin, empty group)
        // Codes: 200 added, 403 privacy-blocked (invite DM sent if isInviteV4Sent),
        //        404 not on WhatsApp, 408 recently left, 409 already in, 417/419 community/full.
        const result = await groupChat.addParticipants([contactId]);
```

new_string:
```
      const raw = guest.phone.replace(/\D/g, '');

      try {
        const resolvedId = await resolveLidForAdd(client, raw);
        if (!resolvedId) {
          console.log(`[add-batch] not-on-whatsapp ${guest.name} (${raw})`);
          failed += 1;
          await sleep(DELAY_BETWEEN_ADDS_MS);
          continue;
        }
        // whatsapp-web.js returns either:
        //   - object: { [resolvedId]: { code, message, isInviteV4Sent } } for per-contact results
        //   - string: a group-level error message (e.g. bot is not admin, empty group)
        // Codes: 200 added, 403 privacy-blocked (invite DM sent if isInviteV4Sent),
        //        404 not on WhatsApp, 408 recently left, 409 already in, 417/419 community/full.
        const result = await groupChat.addParticipants([resolvedId]);
```

**Edit 3c — Rename `contactId` → `resolvedId` in the 4 remaining usages inside the loop body.** The 5 remaining `contactId` references are: `result[contactId]` (per-contact result object lookup) plus 4 occurrences in console.log/error log lines. Make the following four full-line edits one at a time (each `old_string` is unique because it includes its surrounding log text):

3c-i (the result lookup line — also wraps `contactId` to `resolvedId`):

old_string:
```
        const entry = result && typeof result === 'object' ? result[contactId] : undefined;
```
new_string:
```
        const entry = result && typeof result === 'object' ? result[resolvedId] : undefined;
```

3c-ii (added log):

old_string:
```
          console.log(`[add-batch] added ${guest.name} (${contactId}) to ${groupType}`);
```
new_string:
```
          console.log(`[add-batch] added ${guest.name} (${resolvedId}) to ${groupType}`);
```

3c-iii (invite-sent log):

old_string:
```
            `[add-batch] invite-sent ${guest.name} (${contactId}) to ${groupType} — code=${code} msg=${message}`
```
new_string:
```
            `[add-batch] invite-sent ${guest.name} (${resolvedId}) to ${groupType} — code=${code} msg=${message}`
```

3c-iv (already-in log):

old_string:
```
          console.log(`[add-batch] already-in ${guest.name} (${contactId}) in ${groupType}`);
```
new_string:
```
          console.log(`[add-batch] already-in ${guest.name} (${resolvedId}) in ${groupType}`);
```

3c-v (not-added error log):

old_string:
```
            `[add-batch] not-added ${guest.name} (${contactId}) — code=${code} msg=${message} raw=${JSON.stringify(entry)}`
```
new_string:
```
            `[add-batch] not-added ${guest.name} (${resolvedId}) — code=${code} msg=${message} raw=${JSON.stringify(entry)}`
```

After all edits, the loop body must contain ZERO references to `contactId`. The trailing `await sleep(DELAY_BETWEEN_ADDS_MS);` at the end of the loop body MUST remain.
  </action>
  <verify>
    <automated>grep -c "resolveLidForAdd" app/api/guests/add-batch/route.ts | awk '{ if ($1 &gt;= 2) exit 0; else exit 1 }' &amp;&amp; ! grep -q "contactId" app/api/guests/add-batch/route.ts &amp;&amp; grep -q "await sleep(DELAY_BETWEEN_ADDS_MS);" app/api/guests/add-batch/route.ts</automated>
  </verify>
  <done>Import line present. `const contactId = ...` declaration removed. All 5 in-loop `contactId` references renamed to `resolvedId`. `addParticipants([resolvedId])` in place. The early-return path for unregistered numbers increments `failed`, sleeps, and `continue`s. `await sleep(DELAY_BETWEEN_ADDS_MS);` at end of loop body still present.</done>
</task>

</tasks>

<verification>
After all tasks complete, run the following from the repo root. Long-running compile/build commands should be run with `run_in_background`.

```bash
npx tsc --noEmit                                                         # exit 0
npm run build                                                            # exit 0
grep -c "resolveLidForAdd" app/api/guests/add-one/route.ts               # >= 2 (import + call)
grep -c "resolveLidForAdd" app/api/guests/add-batch/route.ts             # >= 2 (import + call)
test -f lib/resolve-lid.ts                                               # exists
git diff --name-only HEAD                                                # exactly 3 files (excluding PLAN.md): lib/resolve-lid.ts, app/api/guests/add-one/route.ts, app/api/guests/add-batch/route.ts
```

Manual / runtime verification (not blocking the executor — coordinator confirms post-deploy):
1. With `whenReady()` connected, call `POST /api/guests/add-one` with a phone number the WhatsApp account has never DM'd. Previously this threw "Lid is missing in chat table"; now it should return `{ success: true, outcome: 'added' | 'invited' | 'already-in' }` or `outcome: 'not-on-whatsapp'` for unregistered numbers.
2. Call `POST /api/guests/add-batch` against a small batch (e.g. `batchSize: 5`) with mixed never-DM'd phones. Confirm at least one previously-failing number now succeeds, and `not-on-whatsapp` returns are paced via the existing `DELAY_BETWEEN_ADDS_MS` sleep.
</verification>

<success_criteria>
- `lib/resolve-lid.ts` exists and exports `resolveLidForAdd(client: Client, rawPhone: string): Promise<string | null>` with both `fetchMessages({ limit: 1 })` AND `getProfilePicUrl(resolvedId)` side effects.
- `app/api/guests/add-one/route.ts` imports `resolveLidForAdd` from `@/lib/resolve-lid` and uses it in place of the previous `getNumberId` + inner `getChatById(resolvedId)` block. The original `addParticipants([resolvedId])` line and everything after is unchanged.
- `app/api/guests/add-batch/route.ts` imports `resolveLidForAdd`, calls it before `addParticipants`, removes the `const contactId = ...` declaration, renames all 5 in-loop `contactId` usages to `resolvedId`, and preserves the trailing `await sleep(DELAY_BETWEEN_ADDS_MS);`.
- `npx tsc --noEmit` exits 0 (no type errors). `npm run build` exits 0.
- `git diff --name-only HEAD` shows exactly the 3 in-scope files modified (PLAN.md excluded).
- Auth (`requireAuth`), `lib/whatsapp-session.ts`, route signatures, response schemas, and any other files are untouched.
</success_criteria>

<commit>
After verification passes, commit with this exact message (HEREDOC):

```
fix(guests): force LID sync via fetchMessages + getProfilePicUrl

addParticipants requires WhatsApp's chat table to have the contact's LID
populated, which getChatById alone does not trigger. Extract a shared
resolveLidForAdd() helper that calls fetchMessages({limit:1}) and
getProfilePicUrl as belt-and-suspenders side effects to force the sync.
Use the helper in both add-one and add-batch routes (the latter previously
had no pre-resolve at all).

Resolves the "Lid is missing in chat table" error users hit when adding
contacts the WhatsApp account had never DM'd before.
```
</commit>

<output>
No SUMMARY.md required for quick-task. Final reporter output:
- Files changed: `lib/resolve-lid.ts` (new), `app/api/guests/add-one/route.ts`, `app/api/guests/add-batch/route.ts`
- Verification results from the `<verification>` block
- Commit SHA
</output>
