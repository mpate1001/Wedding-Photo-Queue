# Architecture

**Analysis Date:** 2026-04-03

## Pattern Overview

**Overall:** Monolithic Client-Server with API-Driven Data Flow

**Key Characteristics:**
- Next.js 16 App Router with server-side API routes and client-side UI
- Stateless authentication via Base64-encoded tokens stored in localStorage
- Client-side state management for group statuses persisted in localStorage
- External data source (Google Sheets CSV) fetched on-demand by API layer
- Multi-channel notification system (SMS, WhatsApp, Email) via Twilio and SendGrid

## Layers

**Presentation Layer (Client):**
- Purpose: Display group queue status, handle user interactions, manage local state
- Location: `app/page.tsx`, `app/login/page.tsx`, `components/GroupCard.tsx`
- Contains: React client components using hooks (useState, useEffect, useRouter), UI with Tailwind CSS
- Depends on: Authentication API (`/api/auth/*`), Groups API (`/api/groups`), Notification API (`/api/notify`), Test Mode API (`/api/test-mode`)
- Used by: End users (event planners)

**API/Route Handler Layer (Backend):**
- Purpose: Handle authentication, data fetching, validation, and notification orchestration
- Location: `app/api/auth/login/route.ts`, `app/api/auth/verify/route.ts`, `app/api/groups/route.ts`, `app/api/notify/route.ts`, `app/api/test-mode/route.ts`
- Contains: Next.js Route Handlers (POST/GET), request validation, external service orchestration
- Depends on: Environment variables, Twilio SDK, SendGrid SDK, Google Sheets CSV URL
- Used by: Client layer (fetch calls from React components)

**Data Source Layer:**
- Purpose: Provide source-of-truth for group information
- Location: Google Sheets (external, via CSV published URL in `GOOGLE_SHEET_CSV_URL`)
- Contains: CSV with columns: Group Number | Name | Phone | Email
- Multiple rows with same group number = multiple members in group
- No persistence in application (status stored client-side in localStorage)

**Notification Service Layer:**
- Purpose: Send SMS, WhatsApp, and Email notifications via third-party providers
- Location: `/api/notify/route.ts`
- Depends on: Twilio (SMS/WhatsApp), SendGrid (Email)
- Behavior: TEST_MODE skips actual sends and logs to console; production mode sends real messages

## Data Flow

**Authentication Flow:**
1. User enters password on `app/login/page.tsx`
2. POST to `/api/auth/login` with password
3. Server compares against `DASHBOARD_PASSWORD` env var
4. If match: returns Base64 token (password:timestamp)
5. Client stores token in localStorage as `wedding_auth`
6. On page load: client verifies token via POST to `/api/auth/verify`
7. If invalid: redirect to login, clear localStorage

**Group Fetching & Display:**
1. After auth succeeds, client calls GET `/api/groups`
2. Server fetches Google Sheets CSV from `GOOGLE_SHEET_CSV_URL`
3. Server parses CSV: skips header, groups rows by group number, aggregates members, formats phone numbers with +1 prefix
4. Returns array of `Group` objects with `groupNumber`, `members[]`, initial `status: 'waiting'`
5. Client loads saved statuses from localStorage key `groupStatuses`
6. Client merges fetched groups with saved statuses
7. Client renders `GroupCard` components in grid with status filters

**Status Management:**
1. User clicks status dropdown in `GroupCard` or "Select All" bulk action
2. Client updates local React state
3. Client serializes status map to `groupStatuses` localStorage key
4. Status persists across page reloads but is NOT saved to server

**Notification Flow:**
1. User clicks "Notify" button on GroupCard or "Bulk Notify" from selection
2. Client POST to `/api/notify` with `{ groupNumber, members: GroupMember[] }`
3. Server checks `TEST_MODE` env var
   - If TEST_MODE=true: console logs notification intent, returns simulated success
   - If TEST_MODE=false: sends actual SMS/WhatsApp via Twilio, Email via SendGrid
4. Server returns `NotificationResponse` with per-member delivery status for each channel
5. On success, client calls `handleStatusChange(groupNumber, 'notified')`
6. Client shows detailed alert with per-member status breakdown

**State Management:**
- **Authentication state:** localStorage (`wedding_auth` token)
- **Group statuses:** localStorage (`groupStatuses` JSON map)
- **UI state:** React component state (loading, error, filtering, selection, notification in-progress)
- **Source-of-truth for groups:** Google Sheets (fetched fresh each time `/api/groups` called)
- **No server-side session:** Each request validates token independently

## Key Abstractions

**Group Type:**
- Purpose: Represents a logical group of people for photo queue
- Location: `types/index.ts`
- Definition: `{ groupNumber: number, members: GroupMember[], status: QueueStatus }`
- Pattern: Immutable data structure, status updated via new object creation in React state

**GroupMember Type:**
- Purpose: Individual person in a group with contact info
- Location: `types/index.ts`
- Definition: `{ name: string, phone: string, email: string }`
- Pattern: Parsed from CSV and passed through to notification API

**QueueStatus Type:**
- Purpose: Represents progression of group through photo queue
- Location: `types/index.ts`
- Values: `'waiting' | 'queued' | 'notified' | 'completed'`
- Pattern: User can transition in any direction via dropdown; transitions not validated/locked

**NotificationRequest/Response:**
- Purpose: Structured API contract for notification endpoint
- Location: `types/index.ts`
- Pattern: Request carries group number and members; Response includes per-member per-channel status

## Entry Points

**Login Page:**
- Location: `app/login/page.tsx`
- Triggers: User navigates to `/login` or auth check fails
- Responsibilities: Render password input, POST to `/api/auth/login`, store token, redirect to dashboard

**Dashboard (Home):**
- Location: `app/page.tsx` (444 lines)
- Triggers: User navigates to `/` after successful auth
- Responsibilities: 
  - Check authentication on mount
  - Fetch groups from API
  - Manage group statuses from localStorage
  - Render filtered group cards
  - Handle single and bulk notifications
  - Manage group selection state
  - Display stats and test mode banner

**GroupCard Component:**
- Location: `components/GroupCard.tsx`
- Triggers: Rendered for each group in dashboard grid
- Responsibilities: Display group info, member list, status dropdown, notify button, checkbox for bulk selection

**Root Layout:**
- Location: `app/layout.tsx`
- Triggers: Server-side wrapper for all pages
- Responsibilities: Set metadata, load fonts (Geist Sans/Mono), import Tailwind CSS

## Error Handling

**Strategy:** Try-catch at API layer with NextResponse error returns; Client-side error alerts

**Patterns:**
- API routes catch exceptions and return `{ success: false, message: '...' }` with appropriate HTTP status
- Client wraps fetch calls in try-catch, displays user-friendly alert on error
- Auth failures redirect to login
- Network errors show "Failed to load groups" message with Retry button
- Notification failures show per-member breakdown of which channels failed
- Missing env vars return 500 status in API routes

**Examples:**
- `app/api/groups/route.ts`: Catches fetch errors, returns 500 if CSV URL missing
- `app/api/notify/route.ts`: Wraps each Twilio/SendGrid call in try-catch, logs error, marks channel as failed
- `app/page.tsx`: checkAuth catches verify failures, clears auth token, redirects to login

## Cross-Cutting Concerns

**Logging:** 
- Development: console.error/log for debugging (auth failures, API errors, notification attempts)
- Production: Same console logs, relies on Vercel platform logs
- No structured logging framework

**Validation:**
- Frontend: HTML5 form validation (required password field)
- Backend: Type checking via TypeScript, request.json() parsing, basic null checks for members array
- No schema validation library (e.g., Zod) in use

**Authentication:**
- Token generation: Base64 encoding of "password:timestamp" (weak security, not production-grade)
- Token storage: localStorage (vulnerable to XSS, no HttpOnly cookie)
- Token validation: Decode Base64, compare embedded password with env var (stateless)
- No CSRF protection (simple password auth, not form-based)

**Phone Number Formatting:**
- Auto-prepends +1 to 10-digit US numbers
- Accepts international formats
- Implemented in `app/api/groups/route.ts` function `formatPhoneNumber()`

**Test Mode:**
- Flag: `TEST_MODE=true` environment variable
- Behavior: Notifications logged to console, no API calls to Twilio/SendGrid
- UI indicator: Yellow banner on dashboard
- Useful for development without consuming SMS/WhatsApp/Email credits

---

*Architecture analysis: 2026-04-03*
