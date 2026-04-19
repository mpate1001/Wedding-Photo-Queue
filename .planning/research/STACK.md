# Technology Stack

**Project:** Wedding Photo Queue — UI/UX Overhaul + Feature Additions
**Researched:** 2026-04-03
**Confidence:** MEDIUM-HIGH (verified against official docs and multiple sources)

## Baseline (Already Installed, Keep As-Is)

| Technology | Version | Role |
|------------|---------|------|
| Next.js | ^16.1.6 | Full-stack framework, App Router, API routes |
| React | ^19.2.4 | UI library |
| TypeScript | ^5 | Type safety, strict mode |
| Tailwind CSS | ^4 | Utility-first styling |
| Twilio | ^5.10.6 | SMS + WhatsApp notifications |
| @sendgrid/mail | ^8.1.6 | Email notifications |

No framework migrations. Everything below is additive.

---

## Recommended Additions

### UI Components: shadcn/ui

**Install:** `npx shadcn@latest init`

**Confidence:** HIGH — official docs confirm full Tailwind v4 + React 19 support as of early 2025.

**Why shadcn/ui and not a pre-bundled library:**
The project already uses Tailwind CSS v4. shadcn/ui copies component source directly into the project — no runtime overhead, no opaque abstractions, full control over markup. Every other option (Flowbite, daisyUI, Preline) ships its own CSS layer that conflicts with or duplicates Tailwind v4's new `@theme` system. shadcn/ui is Tailwind-native.

**Why not daisyUI:** daisyUI v4 works with Tailwind v4 but adds semantic class names as an abstraction layer. That's useful for new projects starting from zero; it's friction on a project that already has custom Tailwind patterns. shadcn/ui slots into existing code with zero class conflicts.

**Why not Flowbite:** Requires JavaScript plugins for interactive components, adds a separate dependency tree. shadcn/ui components are pure React with no external JS runtime.

**Components to install for this milestone:**
```bash
npx shadcn@latest add button badge card dialog sheet toast
```

- `button` — primary action buttons (Queue, Notify, Confirm, Done)
- `badge` — status indicators (Waiting / Queued / Notified / Done)
- `card` — GroupCard wrapper
- `dialog` — confirmation modal for "Mark as Done"
- `sheet` — slide-up panel for group details on mobile
- `toast` — handled separately via Sonner (see below)

**Caveat:** shadcn/ui with Tailwind v4 uses OKLCH color tokens instead of HSL. The `tailwindcss-animate` package is deprecated in favor of native CSS animations. Do not add `tailwindcss-animate` as a dependency.

Source: https://ui.shadcn.com/docs/tailwind-v4

---

### Toast Notifications: Sonner

**Install:** `npm install sonner`
**Version:** Latest (2.x as of research date)

**Confidence:** HIGH — shadcn/ui's official toast primitive IS Sonner. No competing library needed.

**Why Sonner and not react-hot-toast:**
Sonner is the official toast in the shadcn/ui ecosystem. `npx shadcn add toast` installs Sonner under the hood. It has zero React state dependency — you call `toast.success("Group 14 notified")` from anywhere, including inside API callbacks, without hooks or context setup. That pattern fits this app perfectly: toasts need to fire after async notification sends deep in event handlers.

**Why not react-toastify:** Heavy (25KB+), opinionated styles that fight Tailwind, separate CSS import required.

**Integration:**
```tsx
// app/layout.tsx
import { Toaster } from "sonner";
<Toaster position="top-center" richColors />
```

---

### State Management: Zustand v5

**Install:** `npm install zustand`
**Version:** ^5.0.10 (minimum — fixes a race condition in persist middleware below this version)

**Confidence:** HIGH — official GitHub and multiple sources confirm v5 stable with localStorage persistence via built-in middleware.

**Why Zustand and not continuing with raw localStorage:**
The current approach scatters `localStorage.getItem/setItem` calls throughout `page.tsx` (444 lines). Auto-resend timers, confirmation state, re-queue logic, and batch queue state will multiply this complexity. Zustand's `persist` middleware wraps localStorage automatically, provides React hooks for reactive UI updates, and eliminates the manual serialization/deserialization scattered through the current code.

**Why not React Context:** Context re-renders the entire subtree on any state change. With 100+ GroupCards on screen, a single status update would re-render everything. Zustand's selector API re-renders only the card whose status changed.

**Why not Redux Toolkit:** Massive overhead for a single-coordinator app with no server sync. Zustand does the same job in ~20 lines.

**Why not Jotai:** Atom-per-piece-of-state model doesn't map cleanly to "a map of groupId → status" which is the core data shape here.

**Pattern for this app:**
```typescript
// store/queueStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

const useQueueStore = create(
  persist(
    (set, get) => ({
      statuses: {} as Record<string, QueueStatus>,
      setStatus: (groupId: string, status: QueueStatus) =>
        set((s) => ({ statuses: { ...s.statuses, [groupId]: status } })),
    }),
    { name: "wedding-queue-state" }
  )
);
```

This replaces all current localStorage calls and gives reactive hooks to every GroupCard.

---

### Auto-Resend / Polling: TanStack Query v5

**Install:** `npm install @tanstack/react-query`
**Version:** ^5.96.x (latest stable as of research date)

**Confidence:** HIGH — official TanStack docs confirm `refetchInterval` + `refetchIntervalInBackground` for background polling. Next.js App Router integration is documented with official examples.

**Why TanStack Query and not a custom `useInterval` hook:**
The auto-resend feature needs to: (1) detect groups that have been in "queued/notified" state for N minutes, (2) fire a new notification, (3) handle errors gracefully, (4) continue polling even when the phone screen locks. A raw `setInterval` in a `useEffect` silently stops on component unmount, has no error handling, and has no built-in background-tab behavior. TanStack Query's `refetchIntervalInBackground: true` option handles all of this.

**Why not SSE/WebSockets:** Out of scope. Single coordinator, no backend pub/sub needed. Polling every 60 seconds is sufficient for "notify again if not shown up in 5 minutes" logic.

**Pattern for auto-resend:**
```typescript
useQuery({
  queryKey: ["auto-resend-check"],
  queryFn: checkAndResendStaleNotifications,
  refetchInterval: 60_000, // every 60 seconds
  refetchIntervalInBackground: true, // continues when phone screen locks
});
```

**Also use TanStack Query for:** The Google Sheets CSV fetch (`/api/groups`). Replace the current manual fetch in `useEffect` with `useQuery`. This gives automatic error states, loading states, and stale-while-revalidate without any extra code.

**Next.js App Router setup note:** Set `staleTime` above 0 in the QueryClient default options to prevent immediate client-side refetch after SSR hydration.

---

### Swipe Gestures (Mobile): react-swipeable

**Install:** `npm install react-swipeable`
**Version:** ^7.0.2

**Confidence:** MEDIUM — maintained by Formidable Labs, 0 dependencies, actively maintained. Last publish was ~1 year ago which is normal for a stable utility.

**Why react-swipeable:**
Coordinators will use this on a phone at a wedding. Swipe-right on a GroupCard to queue it, swipe-left to skip — reduces taps-per-action from 3 to 1. react-swipeable exposes `useSwipeable` hook with `onSwipedLeft`/`onSwipedRight` callbacks, works with both touch and mouse, and has zero dependencies.

**Why not building swipe from scratch:** Tracking touch coordinates, velocity thresholds, and preventing scroll interference correctly is 200+ lines of fragile code. react-swipeable does it in one hook.

**Why not use-gesture (from @use-gesture/react):** More powerful but significantly heavier. This app only needs basic swipe direction detection, not physics-based gesture animation.

**Scope:** This is a progressive enhancement. Ship the tap-based UI first; add swipe gestures as a polish pass. Do not block the milestone on gesture implementation.

---

### Relative Time Formatting: date-fns

**Install:** `npm install date-fns`
**Version:** ^4.1.0

**Confidence:** HIGH — 25,000+ npm dependents, no dependencies, tree-shakeable, official docs current.

**Why date-fns:**
Auto-resend needs to display "Notified 6 minutes ago" on GroupCards so the coordinator can see at a glance how long a group has been waiting. date-fns's `formatDistanceToNow()` handles this in one line with no locale setup overhead.

**Why not Day.js:** Both are fine. date-fns wins on tree-shaking — only the functions you import are bundled. For a function (`formatDistanceToNow`) used in 100+ rendered cards, bundle size matters.

**Why not Luxon:** Luxon is heavier and ships its own locale system. Overkill for "6 minutes ago."

---

## What NOT to Add

| Library | Reason to Avoid |
|---------|----------------|
| Prisma / any ORM | No database. Google Sheets stays as the data source. |
| Socket.io / Ably / Pusher | No real-time multi-user collaboration in scope. Polling is sufficient. |
| next-auth | Auth is intentionally simple (single password). next-auth adds session complexity for no benefit. |
| Framer Motion | Animations are a polish concern. Use CSS transitions via Tailwind. Framer Motion adds 40KB. |
| Redux Toolkit | Zustand covers all state needs. RTK is excess for a single-coordinator app. |
| react-swipeable-views | Unmaintained (last release 2019, known vulnerabilities). Different package from react-swipeable. |
| tailwindcss-animate | Deprecated in shadcn/ui Tailwind v4 path. Use native CSS animations instead. |
| daisyUI | Semantic class layer conflicts with existing Tailwind patterns. shadcn/ui is the better fit. |

---

## Full Installation Sequence

Run in this order (dependency order matters for shadcn init):

```bash
# 1. State management
npm install zustand

# 2. Data fetching + polling
npm install @tanstack/react-query

# 3. Toast notifications
npm install sonner

# 4. Relative time formatting
npm install date-fns

# 5. Swipe gestures (add during mobile polish phase, not MVP)
npm install react-swipeable

# 6. shadcn/ui — init last because it modifies globals.css
npx shadcn@latest init
npx shadcn@latest add button badge card dialog sheet
```

**shadcn init note:** The CLI will ask about Tailwind v4 — answer yes. It will configure `globals.css` with `@theme` tokens. Do not run init before the npm installs above or the CLI may make wrong assumptions about the project setup.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| UI Components | shadcn/ui | daisyUI | Semantic class layer conflicts with existing Tailwind v4 patterns |
| UI Components | shadcn/ui | Flowbite | Requires external JS runtime for interactive components |
| State | Zustand v5 | React Context | Full subtree re-render on status change — 100+ cards = jank |
| State | Zustand v5 | Redux Toolkit | RTK overhead for single-user, no-server-sync use case |
| Polling | TanStack Query | Custom useInterval | No error handling, stops on unmount, no background-tab support |
| Toast | Sonner | react-hot-toast | Sonner is shadcn/ui's official primitive; one fewer decision |
| Time | date-fns | Day.js | Both fine; date-fns wins on tree-shaking for repeated per-card use |
| Gestures | react-swipeable | @use-gesture/react | Overkill; only need direction detection not physics |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| shadcn/ui + Tailwind v4 compatibility | HIGH | Official shadcn/ui docs verified |
| Zustand v5 localStorage persistence | HIGH | Official GitHub README + multiple sources |
| TanStack Query v5 polling/background | HIGH | Official TanStack docs with code examples |
| Sonner as shadcn/ui toast primitive | HIGH | Verified via shadcn changelog and official docs |
| date-fns v4 tree-shaking + stability | HIGH | npm registry (25k+ dependents, no deps) |
| react-swipeable maintenance status | MEDIUM | Last publish ~1 year ago; stable but not actively iterated |

---

## Sources

- shadcn/ui Tailwind v4 docs: https://ui.shadcn.com/docs/tailwind-v4
- shadcn/ui React 19 docs: https://ui.shadcn.com/docs/react-19
- TanStack Query auto-refetching: https://tanstack.com/query/v5/docs/framework/react/examples/auto-refetching
- TanStack Query useQuery reference: https://tanstack.com/query/v5/docs/framework/react/reference/useQuery
- Zustand v5 GitHub: https://github.com/pmndrs/zustand
- Sonner comparison: https://blog.logrocket.com/react-toast-libraries-compared-2025/
- react-swipeable: https://github.com/FormidableLabs/react-swipeable
- date-fns npm: https://www.npmjs.com/package/date-fns
- Twilio status callbacks: https://www.twilio.com/docs/sms/tutorials/how-to-confirm-delivery-node-js
