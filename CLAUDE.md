# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wedding Photo Queue is a password-protected web app for managing group photo queuing at a wedding. Event planners track groups, queue them, and send SMS + WhatsApp + Email notifications when it's time for photos.

**Live URL:** photos.mikemetsaumone.com

## Development Commands

```bash
npm run dev      # Start development server at http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

### Tech Stack
- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4
- **Notifications:** Twilio (SMS/WhatsApp) + SendGrid (Email)
- **Data Source:** Google Sheets published as CSV
- **Hosting:** Vercel

### Key Directories

```
app/
├── api/
│   ├── auth/login/route.ts    # Password validation, returns Base64 token
│   ├── auth/verify/route.ts   # Session verification
│   ├── groups/route.ts        # Fetches & parses Google Sheets CSV
│   ├── notify/route.ts        # Sends SMS + WhatsApp + Email via Twilio/SendGrid
│   └── test-mode/route.ts     # Returns TEST_MODE env status
├── login/page.tsx             # Login form
└── page.tsx                   # Main dashboard (444 lines)

components/
└── GroupCard.tsx              # Reusable group display with status colors

types/
└── index.ts                   # TypeScript definitions (QueueStatus, Group, GroupMember)
```

### Data Flow

1. User authenticates via `/api/auth/login` → receives Base64 token stored in localStorage
2. Dashboard fetches groups from `/api/groups` → parses Google Sheets CSV
3. Group statuses persist in localStorage (waiting → queued → notified → completed)
4. Notifications sent via `/api/notify` → triple redundancy (SMS + WhatsApp + Email)

### Test Mode

When `TEST_MODE=true`, notifications are simulated (console logged) without using Twilio/SendGrid credits. A yellow banner appears on the dashboard.

## Environment Variables

Required in `.env.local` (and Vercel dashboard for production):

- `GOOGLE_SHEET_CSV_URL` - Published Google Sheets CSV URL
- `DASHBOARD_PASSWORD` - Login password
- `TEST_MODE` - `true` for simulation, `false` for real sends
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WHATSAPP_NUMBER`
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`

## Google Sheets Format

Columns: Group Number | Name | Phone | Email

Multiple rows with the same group number = multiple members in that group. Phone numbers auto-format with +1 prefix.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Wedding Photo Queue**

A wedding-day photo queue management app that lets a coordinator efficiently cycle 700+ guests (organized into family groups) through group photos. The coordinator queues up groups, sends triple-channel notifications (SMS, WhatsApp, Email), confirms arrivals, handles no-shows with auto-resend, and marks groups complete — all from a clean, modern dashboard designed for speed under pressure.

**Core Value:** The coordinator can move through 100+ groups as fast as the photographer can shoot — no bottlenecks, no confusion, no missed families.

### Constraints

- **Tech stack**: Next.js 16 + Tailwind CSS on Vercel — no migration, build on what exists
- **Notifications**: Twilio (SMS/WhatsApp) + SendGrid (Email) — already integrated
- **Data source**: Google Sheets CSV — no database migration
- **Timeline**: Must be fully working and tested before the wedding (1-3 months)
- **Users**: Single coordinator on mobile or tablet at the venue
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.x - Full codebase including app routes, components, and types
- JavaScript (JSX/TSX) - React components and configuration files
- CSS - Tailwind CSS via PostCSS
- Bash - Build and development scripts (npm scripts only)
## Runtime
- Node.js (managed by Vercel/Next.js) - Default runtime for all API routes
- Browser - Client-side React components
- npm - Version not specified in package.json, uses lockfile `package-lock.json`
- Lockfile: `package-lock.json` present (241 KB)
## Frameworks
- Next.js 16.1.6 - Full-stack framework for App Router, API routes, and deployment to Vercel
- React 19.2.4 - UI library for components and hooks
- React DOM 19.2.4 - DOM rendering for React components
- Tailwind CSS 4.x - Utility-first CSS framework via PostCSS
- @tailwindcss/postcss 4.x - PostCSS plugin for Tailwind
- TypeScript 5.x - Static type checking and compilation
- PostCSS - CSS transformation pipeline (config: `postcss.config.mjs`)
- ESLint 9.x - Code linting (config: `eslint.config.mjs`)
- eslint-config-next 16.0.3 - Next.js linting rules and configurations
## Key Dependencies
- twilio 5.10.6 - SMS and WhatsApp messaging service client
- @sendgrid/mail 8.1.6 - Email delivery service client
- next - Handles server-side rendering, API routes, and deployment
- @types/node 20.x - Node.js type definitions for TypeScript
- @types/react 19.x - React type definitions
- @types/react-dom 19.x - React DOM type definitions
## Configuration
- Environment variables managed via `.env.local` (local development) and Vercel dashboard (production)
- No git-tracked `.env` files; `.env.local` is in `.gitignore`
- `GOOGLE_SHEET_CSV_URL` - Published Google Sheets CSV endpoint for group data
- `DASHBOARD_PASSWORD` - Single password for dashboard access
- `TEST_MODE` - Boolean (`true`/`false`) to simulate notifications without Twilio/SendGrid costs
- `TWILIO_ACCOUNT_SID` - Twilio authentication SID
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `TWILIO_PHONE_NUMBER` - Twilio SMS sender phone number
- `TWILIO_WHATSAPP_NUMBER` - Twilio WhatsApp sender number
- `SENDGRID_API_KEY` - SendGrid API key for email delivery
- `SENDGRID_FROM_EMAIL` - Sender email address for transactional emails
- `next.config.ts` - Minimal Next.js configuration (no custom options currently)
- `tsconfig.json` - TypeScript compiler options with Next.js plugin support
- `postcss.config.mjs` - PostCSS pipeline with @tailwindcss/postcss plugin
- `eslint.config.mjs` - ESLint configuration with next/core-web-vitals and next/typescript configs
## Platform Requirements
- Node.js (compatible with package versions)
- npm (v7+ recommended for lockfile format)
- Modern browser with ES2017+ support
- Vercel hosting platform (primary deployment target)
- Environment variables configured in Vercel dashboard
- Google Sheets with published CSV export accessible via public URL
- Twilio account with SMS/WhatsApp messaging enabled
- SendGrid account with API key provisioned for email delivery
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Route files: `route.ts` for API endpoints
- Page files: `page.tsx` for Next.js pages
- Component files: PascalCase (e.g., `GroupCard.tsx`)
- Type definition files: `index.ts` in dedicated `types/` directory
- Config files: camelCase with descriptive names (e.g., `next.config.ts`, `eslint.config.mjs`)
- camelCase for all functions (e.g., `formatPhoneNumber`, `parseCSV`, `handleSubmit`)
- Prefix event handlers with `handle` (e.g., `handleStatusChange`, `handleNotify`, `handleLogout`)
- Prefix async operations with verb (e.g., `fetchGroups`, `checkAuth`, `checkTestMode`)
- Private/helper functions: lowercase, no special prefix (e.g., `parseCSVLine`, `formatPhoneNumber`)
- camelCase for all variables and constants
- useState hooks: descriptive names like `groups`, `loading`, `error`, `notifyingGroup`, `selectedGroups`
- Boolean variables prefix with `is`, `has`, or `can` (e.g., `isNotifying`, `isSelected`, `isTestMode`, `authenticated`)
- State setters follow React convention: `set[StateName]` (e.g., `setGroups`, `setLoading`, `setError`)
- PascalCase for all types and interfaces (e.g., `Group`, `GroupMember`, `QueueStatus`, `NotificationResponse`)
- Type definitions organized in `types/index.ts`
- Type imports use `import type` syntax
- Union types for status: `type QueueStatus = 'waiting' | 'queued' | 'notified' | 'completed'`
## Code Style
- Tool: Tailwind CSS for styling with inline classes
- Indentation: 2 spaces (inferred from package.json configuration)
- Line length: No explicit limit detected, but files kept under 444 lines max
- JSX formatting: Props on same line when brief, otherwise multi-line
- Tool: ESLint 9 with flat config format
- Config file: `eslint.config.mjs` (using `defineConfig` from ESLint)
- Presets: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts` (via `globalIgnores`)
- Strict mode enabled: `"strict": true` in `tsconfig.json`
- Target: ES2017
- Module resolution: bundler
- JSX: `react-jsx`
- Path aliases: `@/*` maps to project root for relative imports
## Import Organization
- `@/*` resolves to project root
- Used consistently across all files: `@/types`, `@/components`
## Error Handling
- Try-catch blocks wrap all async operations
- Errors logged with `console.error()` for server-side errors
- Error messages user-friendly: "Failed to fetch groups from Google Sheets" rather than stack traces
- API routes return structured error responses: `{ success: false, message: string }`
- HTTP status codes used appropriately: 400 (bad request), 401 (unauthorized), 500 (server error)
- Component state tracks errors: `error` state with conditional rendering of error UI
## Logging
- Use `console.error()` for errors in try-catch blocks
- Use `console.log()` for debug information in test mode
- Log at key decision points: auth checks, API failures, external service calls
- Include context in error messages: `console.error('Auth check failed:', err)`
- Test mode logging uses emoji prefixes: `console.log('🧪 TEST MODE - Would send SMS to:', member.phone)`
- `app/page.tsx`: Authentication checks, group fetching, bulk notification flows
- `app/api/groups/route.ts`: CSV parsing and data fetching errors
- `app/api/auth/login/route.ts`: Login attempt failures
- `app/api/notify/route.ts`: Per-member notification results and service errors
## Comments
- Complex logic requiring explanation (e.g., CSV parsing with quote handling in `parseCSVLine`)
- Business logic requiring context (e.g., "Skip header row (index 0)" in `parseCSV`)
- Important implementation details (e.g., "Always fetch fresh data" on `cache: 'no-store'`)
- Edge cases and special handling (e.g., phone number formatting logic)
- Not extensively used in current codebase
- Type definitions self-document through interface structure
- Function parameters documented through TypeScript types rather than JSDoc comments
## Function Design
- Small to medium (3-40 lines typical)
- Main page component: 444 lines maximum (largest in codebase)
- Helper functions kept under 25 lines
- Props interface for component parameters
- Destructured parameters in function signatures
- Type annotations on all parameters
- Avoid more than 5-6 parameters (use interfaces instead)
- Explicit return types on all functions
- API routes return `NextResponse.json()` or `NextResponse`
- Components return JSX
- Helper functions return typed values (string, number, Group[], etc.)
- No implicit undefined returns; use explicit `return` or `return null`
## Module Design
- Named exports for types and interfaces
- Default export for components and pages
- API routes use named exports for HTTP methods: `export async function GET()`, `export async function POST()`
- Type exports use `export type` syntax for clarity
- `types/index.ts` acts as barrel file for all type definitions
- No other barrel files in current structure
## React Client/Server Patterns
- Pages with state management: `app/page.tsx`, `app/login/page.tsx`
- Interactive components: `components/GroupCard.tsx`
- Components using hooks: `useState`, `useEffect`, `useRouter`
- Always marked with `'use client'` directive at top
- Layout files: `app/layout.tsx`
- API routes: All files in `app/api/**` (implicit server code)
- Metadata export: `app/layout.tsx`
- Located in `app/api/**` directory
- Use named exports for HTTP methods: `GET`, `POST`, etc.
- Parameters: `NextRequest` for request, return `NextResponse` for response
- No client-side JavaScript bundled for API routes
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Next.js 16 App Router with server-side API routes and client-side UI
- Stateless authentication via Base64-encoded tokens stored in localStorage
- Client-side state management for group statuses persisted in localStorage
- External data source (Google Sheets CSV) fetched on-demand by API layer
- Multi-channel notification system (SMS, WhatsApp, Email) via Twilio and SendGrid
## Layers
- Purpose: Display group queue status, handle user interactions, manage local state
- Location: `app/page.tsx`, `app/login/page.tsx`, `components/GroupCard.tsx`
- Contains: React client components using hooks (useState, useEffect, useRouter), UI with Tailwind CSS
- Depends on: Authentication API (`/api/auth/*`), Groups API (`/api/groups`), Notification API (`/api/notify`), Test Mode API (`/api/test-mode`)
- Used by: End users (event planners)
- Purpose: Handle authentication, data fetching, validation, and notification orchestration
- Location: `app/api/auth/login/route.ts`, `app/api/auth/verify/route.ts`, `app/api/groups/route.ts`, `app/api/notify/route.ts`, `app/api/test-mode/route.ts`
- Contains: Next.js Route Handlers (POST/GET), request validation, external service orchestration
- Depends on: Environment variables, Twilio SDK, SendGrid SDK, Google Sheets CSV URL
- Used by: Client layer (fetch calls from React components)
- Purpose: Provide source-of-truth for group information
- Location: Google Sheets (external, via CSV published URL in `GOOGLE_SHEET_CSV_URL`)
- Contains: CSV with columns: Group Number | Name | Phone | Email
- Multiple rows with same group number = multiple members in group
- No persistence in application (status stored client-side in localStorage)
- Purpose: Send SMS, WhatsApp, and Email notifications via third-party providers
- Location: `/api/notify/route.ts`
- Depends on: Twilio (SMS/WhatsApp), SendGrid (Email)
- Behavior: TEST_MODE skips actual sends and logs to console; production mode sends real messages
## Data Flow
- **Authentication state:** localStorage (`wedding_auth` token)
- **Group statuses:** localStorage (`groupStatuses` JSON map)
- **UI state:** React component state (loading, error, filtering, selection, notification in-progress)
- **Source-of-truth for groups:** Google Sheets (fetched fresh each time `/api/groups` called)
- **No server-side session:** Each request validates token independently
## Key Abstractions
- Purpose: Represents a logical group of people for photo queue
- Location: `types/index.ts`
- Definition: `{ groupNumber: number, members: GroupMember[], status: QueueStatus }`
- Pattern: Immutable data structure, status updated via new object creation in React state
- Purpose: Individual person in a group with contact info
- Location: `types/index.ts`
- Definition: `{ name: string, phone: string, email: string }`
- Pattern: Parsed from CSV and passed through to notification API
- Purpose: Represents progression of group through photo queue
- Location: `types/index.ts`
- Values: `'waiting' | 'queued' | 'notified' | 'completed'`
- Pattern: User can transition in any direction via dropdown; transitions not validated/locked
- Purpose: Structured API contract for notification endpoint
- Location: `types/index.ts`
- Pattern: Request carries group number and members; Response includes per-member per-channel status
## Entry Points
- Location: `app/login/page.tsx`
- Triggers: User navigates to `/login` or auth check fails
- Responsibilities: Render password input, POST to `/api/auth/login`, store token, redirect to dashboard
- Location: `app/page.tsx` (444 lines)
- Triggers: User navigates to `/` after successful auth
- Responsibilities: 
- Location: `components/GroupCard.tsx`
- Triggers: Rendered for each group in dashboard grid
- Responsibilities: Display group info, member list, status dropdown, notify button, checkbox for bulk selection
- Location: `app/layout.tsx`
- Triggers: Server-side wrapper for all pages
- Responsibilities: Set metadata, load fonts (Geist Sans/Mono), import Tailwind CSS
## Error Handling
- API routes catch exceptions and return `{ success: false, message: '...' }` with appropriate HTTP status
- Client wraps fetch calls in try-catch, displays user-friendly alert on error
- Auth failures redirect to login
- Network errors show "Failed to load groups" message with Retry button
- Notification failures show per-member breakdown of which channels failed
- Missing env vars return 500 status in API routes
- `app/api/groups/route.ts`: Catches fetch errors, returns 500 if CSV URL missing
- `app/api/notify/route.ts`: Wraps each Twilio/SendGrid call in try-catch, logs error, marks channel as failed
- `app/page.tsx`: checkAuth catches verify failures, clears auth token, redirects to login
## Cross-Cutting Concerns
- Development: console.error/log for debugging (auth failures, API errors, notification attempts)
- Production: Same console logs, relies on Vercel platform logs
- No structured logging framework
- Frontend: HTML5 form validation (required password field)
- Backend: Type checking via TypeScript, request.json() parsing, basic null checks for members array
- No schema validation library (e.g., Zod) in use
- Token generation: Base64 encoding of "password:timestamp" (weak security, not production-grade)
- Token storage: localStorage (vulnerable to XSS, no HttpOnly cookie)
- Token validation: Decode Base64, compare embedded password with env var (stateless)
- No CSRF protection (simple password auth, not form-based)
- Auto-prepends +1 to 10-digit US numbers
- Accepts international formats
- Implemented in `app/api/groups/route.ts` function `formatPhoneNumber()`
- Flag: `TEST_MODE=true` environment variable
- Behavior: Notifications logged to console, no API calls to Twilio/SendGrid
- UI indicator: Yellow banner on dashboard
- Useful for development without consuming SMS/WhatsApp/Email credits
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
