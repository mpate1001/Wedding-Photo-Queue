# Codebase Structure

**Analysis Date:** 2026-04-03

## Directory Layout

```
wedding-photo-queue/
├── app/                       # Next.js App Router - all pages and API routes
│   ├── api/                   # API route handlers (backend)
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── route.ts   # POST - password validation, token generation
│   │   │   └── verify/
│   │   │       └── route.ts   # POST - token validation for session
│   │   ├── groups/
│   │   │   └── route.ts       # GET - fetch & parse Google Sheets CSV
│   │   ├── notify/
│   │   │   └── route.ts       # POST - send SMS/WhatsApp/Email notifications
│   │   └── test-mode/
│   │       └── route.ts       # GET - return TEST_MODE env status
│   ├── login/
│   │   └── page.tsx           # Password login form (client)
│   ├── page.tsx               # Main dashboard (client, 444 lines)
│   ├── layout.tsx             # Root layout with metadata & fonts
│   └── globals.css            # Tailwind CSS imports
├── components/                # Reusable React components
│   └── GroupCard.tsx          # Group display card with status/notify controls
├── types/                     # TypeScript type definitions
│   └── index.ts               # Group, GroupMember, QueueStatus, NotificationRequest/Response
├── public/                    # Static assets (favicons, robots.txt, etc.)
├── .planning/codebase/        # GSD planning documents
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript compiler config
├── next.config.ts             # Next.js config (empty)
├── tailwind.config.js         # Tailwind CSS config (auto-generated)
├── postcss.config.js          # PostCSS config (auto-generated)
├── .eslintrc.json             # ESLint config
├── .env.local                 # Environment variables (dev, not committed)
├── .gitignore                 # Git exclusions
└── README.md                  # Project documentation
```

## Directory Purposes

**app/**
- Purpose: Next.js App Router directory - contains all routes (pages and API)
- Contains: Page components (client-side), Route Handlers (server-side)
- Key files: `page.tsx` (dashboard), `login/page.tsx`, `layout.tsx`, `api/**/route.ts`

**app/api/**
- Purpose: Backend API endpoints, all Route Handlers
- Contains: HTTP POST/GET request handlers for authentication, data fetching, notifications
- Key files: `auth/login/route.ts`, `auth/verify/route.ts`, `groups/route.ts`, `notify/route.ts`, `test-mode/route.ts`

**components/**
- Purpose: Reusable React components for UI
- Contains: Client-side components with interactivity
- Key files: `GroupCard.tsx` (displayed in grid on dashboard)

**types/**
- Purpose: Centralized TypeScript type definitions
- Contains: Interfaces for Group, GroupMember, QueueStatus, API request/response shapes
- Key files: `index.ts` (single source for all types)

**public/**
- Purpose: Static files served publicly
- Contains: Favicon, robots.txt, social media images (if any)
- Generated/committed: Yes (committed to git)

## Key File Locations

**Entry Points:**
- `app/page.tsx`: Main dashboard - renders group grid, handles auth, state management (444 lines)
- `app/login/page.tsx`: Login form - password input, redirects to dashboard on success
- `app/layout.tsx`: Root layout - wraps all pages, sets metadata, loads fonts

**Configuration:**
- `tsconfig.json`: TypeScript strict mode enabled, path alias `@/*` → root
- `next.config.ts`: Empty template (no custom Next.js config needed)
- `tailwind.config.js`: Auto-generated, standard Tailwind 4 config
- `package.json`: Dependencies (Next.js 16, React 19, Twilio, SendGrid, Tailwind)

**Core Logic:**
- `app/api/groups/route.ts`: CSV parsing logic (header skip, grouping by number, phone formatting, sorting)
- `app/api/notify/route.ts`: Notification orchestration (Twilio SMS/WhatsApp, SendGrid Email, test mode simulation)
- `app/api/auth/login/route.ts`: Password validation, Base64 token generation
- `app/api/auth/verify/route.ts`: Token decoding and validation
- `types/index.ts`: Type definitions used across all files

**UI Components:**
- `app/page.tsx`: Dashboard page (grid layout, filtering, selection, stats)
- `components/GroupCard.tsx`: Individual group card (status dropdown, notify button, member list, checkbox)
- `app/login/page.tsx`: Login form page

## Naming Conventions

**Files:**
- Route files: `route.ts` (Next.js App Router convention)
- Page files: `page.tsx` (Next.js convention for route segments)
- Layout files: `layout.tsx` (Next.js convention)
- Component files: `PascalCase.tsx` for React components (e.g., `GroupCard.tsx`)
- Type files: `index.ts` (barrel file for exports)
- API grouping: `/api/[feature]/[action]/route.ts` (e.g., `/api/auth/login/route.ts`)

**Functions:**
- React components: `PascalCase` (e.g., `function GroupCard()`)
- Event handlers: `camelCase` with `handle` prefix (e.g., `handleStatusChange`, `handleNotify`)
- Utility functions: `camelCase` (e.g., `parseCSV`, `formatPhoneNumber`, `parseCSVLine`)
- API handlers: `POST`, `GET`, etc. (exported functions matching HTTP method)

**Variables:**
- State variables: `camelCase` (e.g., `groups`, `loading`, `selectedGroups`)
- Constants: `UPPER_SNAKE_CASE` for env vars (e.g., `DASHBOARD_PASSWORD`, `TEST_MODE`)
- Types: `PascalCase` (e.g., `Group`, `GroupMember`, `QueueStatus`)

**Types:**
- Interfaces: `PascalCase` with optional `*Request`, `*Response` suffix for API contracts (e.g., `NotificationRequest`, `NotificationResponse`)
- Type aliases: `PascalCase` (e.g., `QueueStatus = 'waiting' | 'queued' | 'notified' | 'completed'`)
- Generic parameters: `T`, `U`, etc. (standard conventions)

## Where to Add New Code

**New Feature:**
- Primary code: Place new API logic in new `app/api/[feature]/[action]/route.ts`
- UI: Create component in `components/` if reusable, or add to existing `app/page.tsx` if dashboard-specific
- Tests: Create `app/api/[feature]/[action]/route.test.ts` or `components/[Component].test.tsx` (co-located)
- Types: Add to `types/index.ts`

**New Component/Module:**
- Implementation: `components/[ComponentName].tsx` for reusable UI
- If feature-specific: Place inline in `app/page.tsx` or `app/login/page.tsx`
- Export: Export as named export from file

**Utilities:**
- Shared helpers: Create `lib/[utility-name].ts` and export functions
- API-specific utilities: Keep in `app/api/[feature]/route.ts` as internal functions (e.g., `parseCSV`, `formatPhoneNumber`)
- Formatting/validation: Place in `lib/` if used by multiple API routes

**Example: Adding SMS-Only Endpoint**
```
app/api/notify-sms/route.ts    # New API route
  - imports from types/index.ts
  - handles POST request
  - calls Twilio SDK
  - returns NotificationResponse
```

**Example: Adding Bulk Status Update**
```
app/api/groups/[groupNumber]/route.ts    # New route for specific group
  - imports from types/index.ts
  - handles PATCH request to update status
  - persists to database (if added later)
```

## Special Directories

**node_modules/:**
- Purpose: Installed npm dependencies
- Generated: Yes (run `npm install`)
- Committed: No (in .gitignore)

**.next/:**
- Purpose: Next.js build output and development cache
- Generated: Yes (run `npm run dev` or `npm run build`)
- Committed: No (in .gitignore)

**.git/:**
- Purpose: Git version control repository
- Generated: Yes (initialized with `git init`)
- Committed: N/A (git internal)

**.env.local:**
- Purpose: Development environment variables
- Generated: No (must be manually created)
- Committed: No (in .gitignore)
- Contains: GOOGLE_SHEET_CSV_URL, DASHBOARD_PASSWORD, TEST_MODE, Twilio keys, SendGrid keys

**.planning/codebase/:**
- Purpose: GSD codebase mapping documents
- Generated: Yes (created by `/gsd:map-codebase` command)
- Committed: Yes

## Import Path Aliases

The project uses path alias `@/*` pointing to project root:
- `@/types` → `types/index.ts`
- `@/components/GroupCard` → `components/GroupCard.tsx`
- `@/app/page` → `app/page.tsx`

Used consistently in all imports for cleaner relative path handling.

## Data Flow Across Files

```
User Login Flow:
  app/login/page.tsx (render form)
    ↓ (POST password)
  app/api/auth/login/route.ts (validate)
    ↓ (return token)
  localStorage[wedding_auth]

Dashboard Load Flow:
  app/page.tsx (mount, check auth)
    ↓ (POST token)
  app/api/auth/verify/route.ts (validate)
    ↓ (GET groups if valid)
  app/api/groups/route.ts (fetch CSV)
    ↓ (parse)
  app/page.tsx (merge with localStorage statuses)
    ↓ (render)
  components/GroupCard.tsx (display each group)

Notification Flow:
  components/GroupCard.tsx (click Notify)
    ↓ (POST group data)
  app/api/notify/route.ts (orchestrate)
    ↓ (call Twilio/SendGrid or test mode)
  Twilio SDK / SendGrid SDK / console.log
    ↓ (return status)
  app/page.tsx (update local status to 'notified')
    ↓ (localStorage[groupStatuses])
```

---

*Structure analysis: 2026-04-03*
