---
quick_id: 260509-wxk
slug: stronger-lid-resolution-via-puppage-eval
branch: dev
type: quick-task
files_modified:
  - lib/resolve-lid.ts
  - app/api/guests/add-one/route.ts
  - app/api/guests/add-batch/route.ts
autonomous: true
---

<objective>
Strengthen `resolveLidForAdd` so `addParticipants` stops throwing "Lid is missing in chat table" by forcing group-side LID metadata sync via `pupPage.evaluate` into WhatsApp Web's internal Store APIs.

Purpose: Previous fix (e6fb030) populated contact-side metadata via `fetchMessages` + `getProfilePicUrl`, but production logs confirm `addParticipants` still throws — the error originates from WhatsApp Web's own server-side JS checking the group's per-participant LID map, which is a separate sync path from contact metadata. Three different test contacts reproduce the failure. Wedding is 15 days out (May 24, 2026) and ~700 guests must be added pre-event via this dashboard.

Output: Updated `resolveLidForAdd(client, groupId, rawPhone)` with three phases (contact metadata → internal Store via pupPage.evaluate → 1s settle delay), plus both call sites updated to pass `groupId`.
</objective>

<scope_boundary>
**In scope:** Exactly the three files listed in `files_modified`.

**Out of scope (do NOT do):**
- Do NOT add tests
- Do NOT touch any file outside the three listed
- Do NOT modify auth, session, route signatures, or response shapes
- Do NOT run `npm install` or add dependencies
- Do NOT add any new exports from `lib/resolve-lid.ts` beyond `resolveLidForAdd`
- Do NOT create a new branch (stay on `dev`)
- Do NOT modify the import statements in either route file (the existing `import { resolveLidForAdd } from ...` already covers the new signature)
</scope_boundary>

<context>
@lib/resolve-lid.ts
@app/api/guests/add-one/route.ts
@app/api/guests/add-batch/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace lib/resolve-lid.ts with 3-phase implementation</name>
  <files>lib/resolve-lid.ts</files>
  <action>
Use the Write tool to OVERWRITE `lib/resolve-lid.ts` with the exact content below. This is a full-file replacement of the existing 36-line file. The new function signature is `resolveLidForAdd(client, groupId, rawPhone)` — `groupId` is a new required positional parameter inserted before `rawPhone`.

Phase 1 = contact-side metadata via documented APIs (unchanged behavior from current file: `fetchMessages({limit:1})` + `getProfilePicUrl`).
Phase 2 = NEW. Reach into WhatsApp Web internals via `(client as any).pupPage.evaluate(...)` and call three Store APIs that are known to populate the group's chat-table per-participant LID map: `Store.QueryExist.queryWidExists`, `Store.Contact.find`, `Store.GroupMetadata.find`. Each call is try-wrapped individually so one Store API breaking from a WhatsApp Web update doesn't kill the others. Results are logged (`[resolve-lid] phase2 internal-Store for ...`) so pm2 logs surface silent breakage.
Phase 3 = `await new Promise(r => setTimeout(r, 1000))` settle delay so the LID propagates before the caller invokes `addParticipants`.

Exact content to write (verbatim, including comments and JSDoc):

```ts
import type { Client } from 'whatsapp-web.js';

/**
 * Resolves a phone to a WhatsApp WID and forces both contact-side AND
 * group-side LID metadata sync that addParticipants requires.
 *
 * Runs three phases:
 *   1. Standard methods (fetchMessages, getProfilePicUrl) — contact metadata
 *   2. pupPage.evaluate calling WhatsApp's internal Store APIs
 *      (QueryExist, Contact.find, GroupMetadata.find) — group-side LID map
 *   3. 1s settle delay so the LID propagates before addParticipants
 *
 * Returns null if the number is not on WhatsApp.
 *
 * Phase 2 reaches into WhatsApp Web internals which change over time. Each
 * call is try-wrapped and the result is logged so silent breakage can be
 * diagnosed from pm2 logs.
 */
export async function resolveLidForAdd(
  client: Client,
  groupId: string,
  rawPhone: string
): Promise<string | null> {
  const numberId = await client.getNumberId(rawPhone);
  if (!numberId) return null;
  const resolvedId = numberId._serialized;

  // Phase 1: contact-side metadata via documented APIs
  try {
    const chat = await client.getChatById(resolvedId);
    await chat.fetchMessages({ limit: 1 });
  } catch (e) {
    console.warn(`[resolve-lid] phase1 fetchMessages failed for ${resolvedId}:`, e);
  }
  try {
    await client.getProfilePicUrl(resolvedId);
  } catch {
    // privacy-blocked profile throws — metadata side effect already happened
  }

  // Phase 2: force WhatsApp internal LID resolution via pupPage.evaluate
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = (client as any).pupPage;
    if (!page) {
      console.warn('[resolve-lid] phase2 pupPage unavailable');
    } else {
      const result = await page.evaluate(
        async (gId: string, cId: string) => {
          const out: Record<string, unknown> = {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const Store = (window as any).Store;
          if (!Store) return { error: 'Store not exposed on window' };

          try {
            const groupWid = Store.WidFactory?.createWid?.(gId);
            const contactWid = Store.WidFactory?.createWid?.(cId);

            if (Store.QueryExist?.queryWidExists && contactWid) {
              try {
                await Store.QueryExist.queryWidExists(contactWid);
                out.queryExist = 'ok';
              } catch (e) {
                out.queryExist = `err: ${e instanceof Error ? e.message : String(e)}`;
              }
            }

            if (Store.Contact?.find && contactWid) {
              try {
                await Store.Contact.find(contactWid);
                out.contactFind = 'ok';
              } catch (e) {
                out.contactFind = `err: ${e instanceof Error ? e.message : String(e)}`;
              }
            }

            if (Store.GroupMetadata?.find && groupWid) {
              try {
                await Store.GroupMetadata.find(groupWid);
                out.groupMetaFind = 'ok';
              } catch (e) {
                out.groupMetaFind = `err: ${e instanceof Error ? e.message : String(e)}`;
              }
            }

            return out;
          } catch (e) {
            return { fatalError: e instanceof Error ? e.message : String(e) };
          }
        },
        groupId,
        resolvedId
      );
      console.log(
        `[resolve-lid] phase2 internal-Store for ${resolvedId} in ${groupId}:`,
        result
      );
    }
  } catch (e) {
    console.warn(`[resolve-lid] phase2 pupPage.evaluate threw for ${resolvedId}:`, e);
  }

  // Phase 3: settle delay so the LID propagates before addParticipants
  await new Promise((r) => setTimeout(r, 1000));

  return resolvedId;
}
```
  </action>
  <verify>
    <automated>grep -c "pupPage" lib/resolve-lid.ts | grep -E "^[2-9]|^[1-9][0-9]" &amp;&amp; grep -c "phase2 internal-Store" lib/resolve-lid.ts | grep -q "^1$" &amp;&amp; grep -q "groupId: string" lib/resolve-lid.ts &amp;&amp; grep -q "rawPhone: string" lib/resolve-lid.ts</automated>
  </verify>
  <done>
File exists with the exact content above. The exported signature is `resolveLidForAdd(client: Client, groupId: string, rawPhone: string)`. Only one export remains (`resolveLidForAdd`).
  </done>
</task>

<task type="auto">
  <name>Task 2: Update add-one route to pass groupId</name>
  <files>app/api/guests/add-one/route.ts</files>
  <action>
Use the Edit tool with a single full-line `old_string` / `new_string` swap. The line is currently around line 64 inside the try block; the line immediately above it is the comment `    // Resolve LID for addParticipants — see lib/resolve-lid.ts for why`.

old_string (preserve exact 4-space indentation):
```
    const resolvedId = await resolveLidForAdd(client, raw);
```

new_string:
```
    const resolvedId = await resolveLidForAdd(client, groupId, raw);
```

`groupId` is already in scope at this call site (it is the route's primary input). Do NOT modify the import statement, do NOT touch any other line, do NOT reformat surrounding code.
  </action>
  <verify>
    <automated>grep -c "groupId, raw" app/api/guests/add-one/route.ts | grep -q "^1$" &amp;&amp; ! grep -q "resolveLidForAdd(client, raw)" app/api/guests/add-one/route.ts</automated>
  </verify>
  <done>
The single call site passes `(client, groupId, raw)`. No other lines in the file changed. The old 2-arg call no longer appears.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update add-batch route to pass groupId</name>
  <files>app/api/guests/add-batch/route.ts</files>
  <action>
Use the Edit tool with a single full-line `old_string` / `new_string` swap. The line lives inside the per-guest loop body with 8-space indentation. `groupId` is already declared near the top of the route handler.

old_string (preserve exact 8-space indentation):
```
        const resolvedId = await resolveLidForAdd(client, raw);
```

new_string:
```
        const resolvedId = await resolveLidForAdd(client, groupId, raw);
```

Do NOT modify the import statement, do NOT touch any other line, do NOT reformat surrounding code.
  </action>
  <verify>
    <automated>grep -c "groupId, raw" app/api/guests/add-batch/route.ts | grep -q "^1$" &amp;&amp; ! grep -q "resolveLidForAdd(client, raw)" app/api/guests/add-batch/route.ts</automated>
  </verify>
  <done>
The single call site passes `(client, groupId, raw)`. No other lines in the file changed. The old 2-arg call no longer appears.
  </done>
</task>

</tasks>

<verification>
After all three tasks complete, run from the project root:

```bash
npx tsc --noEmit                                                     # exit 0
npm run build                                                        # exit 0
grep -c "groupId, raw" app/api/guests/add-one/route.ts               # = 1
grep -c "groupId, raw" app/api/guests/add-batch/route.ts             # = 1
grep -c "pupPage" lib/resolve-lid.ts                                 # >= 2
grep -c "phase2 internal-Store" lib/resolve-lid.ts                   # = 1
git diff --name-only HEAD                                            # exactly 3 source files (PLAN.md staged separately)
```

All commands must pass before commit.
</verification>

<success_criteria>
- `lib/resolve-lid.ts` contains the new 3-phase implementation, signature is `(client, groupId, rawPhone)`, references `pupPage` at least twice, logs `phase2 internal-Store` exactly once.
- `app/api/guests/add-one/route.ts` and `app/api/guests/add-batch/route.ts` each call `resolveLidForAdd(client, groupId, raw)` exactly once with no leftover 2-arg calls.
- `npx tsc --noEmit` exits 0 (the new third parameter type-checks at both call sites).
- `npm run build` exits 0.
- `git diff --name-only HEAD` shows exactly the three source files (PLAN.md is staged separately by the planner).
- No tests added, no other files touched, no new dependencies, no new exports.
</success_criteria>

<commit>
After verification passes, stage the three source files and commit with this exact message:

```
fix(guests): force group LID sync via pupPage.evaluate to internal Store APIs

The previous LID fix populated contact-side metadata but addParticipants
still threw "Lid is missing in chat table" — the error originates in
WhatsApp Web's server-side code checking the group's chat-table per-
participant LID map, a separate sync from contact metadata.

Add a phase 2 to resolveLidForAdd that calls WhatsApp's internal Store
APIs via pupPage.evaluate: QueryExist.queryWidExists for server-side
contact materialization, Contact.find for ContactCollection populate,
and GroupMetadata.find for the group's participant LID map. Each call
is try-wrapped and logged so silent breakage is diagnosable. Add a 1s
settle delay before returning so the LID propagates before the caller
invokes addParticipants.

resolveLidForAdd signature now takes (client, groupId, rawPhone) — both
add-one and add-batch updated to pass the groupId already in their scope.
```
</commit>
