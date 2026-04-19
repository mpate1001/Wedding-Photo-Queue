# Coding Conventions

**Analysis Date:** 2026-04-03

## Naming Patterns

**Files:**
- Route files: `route.ts` for API endpoints
- Page files: `page.tsx` for Next.js pages
- Component files: PascalCase (e.g., `GroupCard.tsx`)
- Type definition files: `index.ts` in dedicated `types/` directory
- Config files: camelCase with descriptive names (e.g., `next.config.ts`, `eslint.config.mjs`)

**Functions:**
- camelCase for all functions (e.g., `formatPhoneNumber`, `parseCSV`, `handleSubmit`)
- Prefix event handlers with `handle` (e.g., `handleStatusChange`, `handleNotify`, `handleLogout`)
- Prefix async operations with verb (e.g., `fetchGroups`, `checkAuth`, `checkTestMode`)
- Private/helper functions: lowercase, no special prefix (e.g., `parseCSVLine`, `formatPhoneNumber`)

**Variables:**
- camelCase for all variables and constants
- useState hooks: descriptive names like `groups`, `loading`, `error`, `notifyingGroup`, `selectedGroups`
- Boolean variables prefix with `is`, `has`, or `can` (e.g., `isNotifying`, `isSelected`, `isTestMode`, `authenticated`)
- State setters follow React convention: `set[StateName]` (e.g., `setGroups`, `setLoading`, `setError`)

**Types:**
- PascalCase for all types and interfaces (e.g., `Group`, `GroupMember`, `QueueStatus`, `NotificationResponse`)
- Type definitions organized in `types/index.ts`
- Type imports use `import type` syntax
- Union types for status: `type QueueStatus = 'waiting' | 'queued' | 'notified' | 'completed'`

## Code Style

**Formatting:**
- Tool: Tailwind CSS for styling with inline classes
- Indentation: 2 spaces (inferred from package.json configuration)
- Line length: No explicit limit detected, but files kept under 444 lines max
- JSX formatting: Props on same line when brief, otherwise multi-line

**Linting:**
- Tool: ESLint 9 with flat config format
- Config file: `eslint.config.mjs` (using `defineConfig` from ESLint)
- Presets: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts` (via `globalIgnores`)

**TypeScript:**
- Strict mode enabled: `"strict": true` in `tsconfig.json`
- Target: ES2017
- Module resolution: bundler
- JSX: `react-jsx`
- Path aliases: `@/*` maps to project root for relative imports

## Import Organization

**Order:**
1. External dependencies (React, Next.js, third-party libraries)
2. Type imports using `import type` syntax
3. Internal components and utilities using `@/` path aliases
4. Relative imports avoided in favor of path aliases

**Path Aliases:**
- `@/*` resolves to project root
- Used consistently across all files: `@/types`, `@/components`

**Examples:**
```typescript
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import twilio from 'twilio';
import sgMail from '@sendgrid/mail';
import type { Group, QueueStatus } from '@/types';
import GroupCard from '@/components/GroupCard';
```

## Error Handling

**Patterns:**
- Try-catch blocks wrap all async operations
- Errors logged with `console.error()` for server-side errors
- Error messages user-friendly: "Failed to fetch groups from Google Sheets" rather than stack traces
- API routes return structured error responses: `{ success: false, message: string }`
- HTTP status codes used appropriately: 400 (bad request), 401 (unauthorized), 500 (server error)
- Component state tracks errors: `error` state with conditional rendering of error UI

**Examples from codebase:**
```typescript
// API route error handling
try {
  const response = await fetch(sheetUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.statusText}`);
  }
  // ...
} catch (error) {
  console.error('Error fetching groups:', error);
  return NextResponse.json(
    { error: 'Failed to fetch groups from Google Sheets' },
    { status: 500 }
  );
}

// Client-side error handling
try {
  const response = await fetch('/api/groups');
  if (!response.ok) throw new Error('Failed to fetch groups');
  // ...
} catch (err) {
  console.error(err);
  setError('Failed to load groups');
}
```

## Logging

**Framework:** Console methods (no external logging framework)

**Patterns:**
- Use `console.error()` for errors in try-catch blocks
- Use `console.log()` for debug information in test mode
- Log at key decision points: auth checks, API failures, external service calls
- Include context in error messages: `console.error('Auth check failed:', err)`
- Test mode logging uses emoji prefixes: `console.log('🧪 TEST MODE - Would send SMS to:', member.phone)`

**Locations where logging occurs:**
- `app/page.tsx`: Authentication checks, group fetching, bulk notification flows
- `app/api/groups/route.ts`: CSV parsing and data fetching errors
- `app/api/auth/login/route.ts`: Login attempt failures
- `app/api/notify/route.ts`: Per-member notification results and service errors

## Comments

**When to Comment:**
- Complex logic requiring explanation (e.g., CSV parsing with quote handling in `parseCSVLine`)
- Business logic requiring context (e.g., "Skip header row (index 0)" in `parseCSV`)
- Important implementation details (e.g., "Always fetch fresh data" on `cache: 'no-store'`)
- Edge cases and special handling (e.g., phone number formatting logic)

**JSDoc/TSDoc:**
- Not extensively used in current codebase
- Type definitions self-document through interface structure
- Function parameters documented through TypeScript types rather than JSDoc comments

**Example:**
```typescript
// Skip header row (index 0)
for (let i = 1; i < lines.length; i++) {
  // Parse CSV line (handle quoted values)
  const values = parseCSVLine(line);
  // ...
}
```

## Function Design

**Size:** 
- Small to medium (3-40 lines typical)
- Main page component: 444 lines maximum (largest in codebase)
- Helper functions kept under 25 lines

**Parameters:**
- Props interface for component parameters
- Destructured parameters in function signatures
- Type annotations on all parameters
- Avoid more than 5-6 parameters (use interfaces instead)

**Return Values:**
- Explicit return types on all functions
- API routes return `NextResponse.json()` or `NextResponse`
- Components return JSX
- Helper functions return typed values (string, number, Group[], etc.)
- No implicit undefined returns; use explicit `return` or `return null`

**Examples:**
```typescript
// Component with typed props
export default function GroupCard({ 
  group, 
  onStatusChange, 
  onNotify, 
  isNotifying, 
  isSelected, 
  onSelect 
}: GroupCardProps) {
  // ...
}

// Helper function with explicit return type
function parseCSV(csvText: string): Group[] {
  // ...
  return groups;
}
```

## Module Design

**Exports:**
- Named exports for types and interfaces
- Default export for components and pages
- API routes use named exports for HTTP methods: `export async function GET()`, `export async function POST()`
- Type exports use `export type` syntax for clarity

**Barrel Files:**
- `types/index.ts` acts as barrel file for all type definitions
- No other barrel files in current structure

**Example:**
```typescript
// types/index.ts - barrel file
export type QueueStatus = 'waiting' | 'queued' | 'notified' | 'completed';
export interface GroupMember { /* ... */ }
export interface Group { /* ... */ }
export interface NotificationRequest { /* ... */ }
export interface NotificationResponse { /* ... */ }
```

## React Client/Server Patterns

**Use Client Components:**
- Pages with state management: `app/page.tsx`, `app/login/page.tsx`
- Interactive components: `components/GroupCard.tsx`
- Components using hooks: `useState`, `useEffect`, `useRouter`
- Always marked with `'use client'` directive at top

**Server Components:**
- Layout files: `app/layout.tsx`
- API routes: All files in `app/api/**` (implicit server code)
- Metadata export: `app/layout.tsx`

**API Routes:**
- Located in `app/api/**` directory
- Use named exports for HTTP methods: `GET`, `POST`, etc.
- Parameters: `NextRequest` for request, return `NextResponse` for response
- No client-side JavaScript bundled for API routes

---

*Convention analysis: 2026-04-03*
