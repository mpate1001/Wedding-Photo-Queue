---
quick_id: 260509-v4h
slug: fix-auth-failure-leaving-whatsapp-init-p
type: quick-task
mode: bugfix
branch: dev
autonomous: true
files_modified:
  - lib/whatsapp-session.ts
must_haves:
  truths:
    - "auth_failure handler clears global.__whatsappInitPromise so the next whenReady() rebuilds the client"
    - "TypeScript still compiles with no errors"
    - "Project still builds successfully"
  artifacts:
    - path: "lib/whatsapp-session.ts"
      provides: "WhatsApp session lifecycle handlers"
      contains: "global.__whatsappInitPromise = undefined"
  key_links:
    - from: "auth_failure event handler"
      to: "global.__whatsappInitPromise"
      via: "assignment to undefined"
      pattern: "global\\.__whatsappInitPromise = undefined"
---

<objective>
Fix a wedding-day risk in the WhatsApp session module: when whatsapp-web.js emits `auth_failure` (e.g. user logs out from their phone, server-side session invalidation), the rejected init promise stays cached on `globalThis` forever. Every subsequent `whenReady()` call awaits the same rejection until a `pm2 restart`. The `disconnected` handler already clears `__whatsappInitPromise`; mirror that single line into the `auth_failure` handler so the client can self-heal.

Purpose: Prevent a single auth_failure event from permanently breaking the notify pipeline before the wedding on 2026-05-24 (15 days out).
Output: One-line defensive change in `lib/whatsapp-session.ts`.
</objective>

<scope_boundary>
**In scope:**
- A single-line addition inside the existing `auth_failure` handler in `lib/whatsapp-session.ts`.

**Out of scope (do NOT do):**
- Do NOT refactor the WhatsApp session module.
- Do NOT add tests.
- Do NOT touch any other file under `app/`, `lib/` (other than `lib/whatsapp-session.ts`), `components/`, `types/`, or `package*.json`.
- Do NOT add comments explaining the fix beyond what is strictly necessary (project `CLAUDE.md` defaults to no comments).
- Do NOT modify the `disconnected` handler, the `ready` handler, or the `whenReady` / `getClient` accessors.
- Do NOT change error message text or logging behavior.
</scope_boundary>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@CLAUDE.md
@lib/whatsapp-session.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Clear cached init promise on auth_failure</name>
  <files>lib/whatsapp-session.ts</files>
  <action>
Use the Edit tool on `lib/whatsapp-session.ts` with the following exact substitution. Do NOT modify any other line. Do NOT add comments.

old_string:
```
    client.on('auth_failure', (msg) => {
      global.__whatsappStatus = 'auth_failure';
      console.error('[WhatsApp] Auth failure:', msg);
      reject(new Error(`WhatsApp auth failure: ${msg}`));
    });
```

new_string:
```
    client.on('auth_failure', (msg) => {
      global.__whatsappStatus = 'auth_failure';
      global.__whatsappInitPromise = undefined;
      console.error('[WhatsApp] Auth failure:', msg);
      reject(new Error(`WhatsApp auth failure: ${msg}`));
    });
```

This mirrors the existing `disconnected` handler (which already clears `__whatsappInitPromise`) so the next `whenReady()` invocation rebuilds the client instead of awaiting the cached rejected promise forever.

If the `old_string` does not match exactly (e.g. whitespace drift, prior unrelated edit), STOP and surface the discrepancy. Do not improvise an alternative edit. Do not refactor surrounding code.
  </action>
  <verify>
    <automated>grep -c 'global.__whatsappInitPromise = undefined' lib/whatsapp-session.ts | awk '{ if ($1 >= 2) exit 0; else exit 1 }' &amp;&amp; npx tsc --noEmit &amp;&amp; npm run build</automated>
  </verify>
  <done>
- `grep -c 'global.__whatsappInitPromise = undefined' lib/whatsapp-session.ts` returns at least 2 (the existing occurrence in the `disconnected` handler plus the new occurrence in the `auth_failure` handler).
- The new line sits between `global.__whatsappStatus = 'auth_failure';` and `console.error('[WhatsApp] Auth failure:', msg);` inside the `auth_failure` callback.
- `npx tsc --noEmit` exits 0.
- `npm run build` exits 0.
- No other lines in `lib/whatsapp-session.ts` are changed.
- No other files in the repository are modified.
  </done>
</task>

</tasks>

<verification>
Run from the project root:

```bash
# 1. The new line exists; total occurrences >= 2 (disconnected + auth_failure handlers).
test "$(grep -c 'global.__whatsappInitPromise = undefined' lib/whatsapp-session.ts)" -ge 2

# 2. The new line is specifically inside the auth_failure handler block.
#    (The 5 lines following the auth_failure handler line should contain the assignment.)
grep -A 5 "client.on('auth_failure'" lib/whatsapp-session.ts | grep -q 'global.__whatsappInitPromise = undefined'

# 3. TypeScript still compiles.
npx tsc --noEmit

# 4. Project still builds.
npm run build

# 5. No unrelated files were modified (only lib/whatsapp-session.ts should appear).
git diff --name-only
```

All five checks must pass. The `git diff --name-only` output must list exactly one file: `lib/whatsapp-session.ts`.
</verification>

<success_criteria>
- `lib/whatsapp-session.ts` contains `global.__whatsappInitPromise = undefined;` inside the `auth_failure` handler.
- The total occurrences of `global.__whatsappInitPromise = undefined` in `lib/whatsapp-session.ts` is at least 2 (existing `disconnected` handler + new `auth_failure` handler).
- `npx tsc --noEmit` exits 0.
- `npm run build` exits 0.
- `git diff --name-only` shows exactly one modified file: `lib/whatsapp-session.ts`.
- No new comments were added.
- Suggested commit message:

  ```
  fix(whatsapp): clear cached init promise on auth_failure

  When whatsapp-web.js emits auth_failure, the init promise was left in
  its rejected state on globalThis, poisoning every subsequent whenReady()
  call until a process restart. The disconnected handler already clears
  __whatsappInitPromise; this mirrors the same behavior for auth_failure
  so the next whenReady() can rebuild the client cleanly.
  ```
</success_criteria>

<output>
This is a quick-task; no SUMMARY.md is required. After execution, the planning artifact (`PLAN.md`) plus the one-line code change in `lib/whatsapp-session.ts` are the complete deliverables for quick id `260509-v4h`.
</output>
