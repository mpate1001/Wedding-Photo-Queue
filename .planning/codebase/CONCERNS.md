# Codebase Concerns

**Analysis Date:** 2026-04-03

## Security Issues

### Authentication Weakness (High Priority)

**Issue:** Token generation uses insecure Base64 encoding of password + timestamp without cryptographic signing.

**Files:** `app/api/auth/login/route.ts` (lines 19-20), `app/api/auth/verify/route.ts` (lines 12-13)

**Current Implementation:**
```typescript
// Insecure: password is visible in Base64, easily reversible
const token = Buffer.from(`${correctPassword}:${Date.now()}`).toString('base64');

// Verification: just decodes and compares password in plaintext
const decoded = Buffer.from(token, 'base64').toString();
const [password] = decoded.split(':');
```

**Impact:** 
- Token can be decoded by anyone with Base64 knowledge
- Actual password is stored in client localStorage unencrypted
- Any XSS attack gives attacker the dashboard password
- No expiration validation (timestamp exists but never checked)

**Fix Approach:**
- Use JWT (jsonwebtoken package) with signed tokens and expiration
- Add HMAC signature to prevent token tampering
- Implement token refresh mechanism with short expiration (1 hour)
- Consider storing tokens in HTTP-only cookies instead of localStorage

---

### Client-Side Authentication Storage (High Priority)

**Issue:** Auth token and group statuses stored in localStorage without encryption.

**Files:** `app/page.tsx` (lines 32, 62, 180), `app/login/page.tsx` (line 28)

**Current Implementation:**
```typescript
// Storing token in plain localStorage
localStorage.setItem('wedding_auth', data.token);

// Storing sensitive status data
localStorage.setItem('groupStatuses', JSON.stringify(statusMap));
```

**Impact:**
- Any XSS vulnerability exposes dashboard password
- Client-side state persists indefinitely with no logout
- No protection against token theft via browser dev tools
- Group statuses persist even after logout

**Fix Approach:**
- Move auth token to HTTP-only, Secure cookie (set via Set-Cookie header)
- Clear all session data on logout (including group statuses)
- Add Session Storage instead of LocalStorage for runtime data
- Implement server-side session validation on every API call

---

### Missing CORS/CSRF Protection (Medium Priority)

**Issue:** API endpoints accept requests without CORS validation or CSRF tokens.

**Files:** `app/api/auth/login/route.ts`, `app/api/notify/route.ts`, `app/api/groups/route.ts`

**Impact:**
- External sites can call notify endpoint and trigger SMS/WhatsApp/Email blasts
- No origin validation prevents request forgery attacks
- Bulk notify endpoint especially vulnerable to abuse

**Fix Approach:**
- Add CORS middleware to validate request origin
- Implement CSRF token validation for state-changing requests (POST/PUT)
- Add rate limiting per IP/session
- Consider adding request signing for API calls

---

### Missing Input Validation (High Priority)

**Issue:** Phone numbers and emails sent directly to Twilio/SendGrid without validation.

**Files:** `app/api/notify/route.ts` (lines 69, 79, 92)

**Current Implementation:**
```typescript
// No validation before sending
await twilioClient!.messages.create({
  to: member.phone,  // Could be any string
});

await sgMail.send({
  to: member.email,  // Could be invalid
});
```

**Impact:**
- Invalid phone numbers cause Twilio errors (wasted API credits)
- Invalid emails fail silently with SendGrid
- Malformed data from CSV parsing isn't caught
- Could trigger 3rd-party API errors that leak information

**Fix Approach:**
- Add email validation (regex or email-validator package) before sending
- Add phone number validation (must match international format)
- Validate in `parseCSV()` function and reject malformed rows
- Add schema validation (Zod is already in devDependencies)

---

## Logic Bugs

### Email Success Check Logic Error (High Priority)

**Issue:** Inverted logic for checking if email was successfully sent.

**Files:** `app/api/notify/route.ts` (lines 117-120)

**Current Code:**
```typescript
const anySuccess =
  memberResult.smsStatus !== 'failed' ||
  memberResult.whatsappStatus !== 'failed' ||
  memberResult.emailStatus !== 'sent';  // ❌ WRONG: checking !== 'sent'

if (!anySuccess) {
  results.success = false;
}
```

**Problem:** Line 120 checks `!== 'sent'` while SMS/WhatsApp check for `!== 'failed'`. This means:
- Email failure still marks overall success as true
- Success logic is inconsistent across notification types
- Partial failures aren't properly reported

**Fix Approach:**
- Change line 120 to: `memberResult.emailStatus === 'sent'`
- Standardize status checking: all three should check for success state
- Consider adding test case: send notification with bad email, verify failure is reported

---

### Missing Notification Expiration Tracking (Medium Priority)

**Issue:** No tracking of when notifications were sent or if they've expired.

**Files:** `app/page.tsx` (status persistence), `app/api/notify/route.ts`

**Impact:**
- Can't distinguish between "notified but not attended" and "will notify"
- No way to retry failed notifications
- Bulk notify has no idempotency check (could send twice if clicked twice)

**Fix Approach:**
- Add timestamp to group status: `{ status, notifiedAt: Date }`
- Add request deduplication (ignore duplicate notify calls within 60 seconds)
- Add "retry" option for failed notifications

---

## Fragile Patterns

### CSV Parsing Edge Cases (Medium Priority)

**Issue:** Custom CSV parser in `app/api/groups/route.ts` is fragile.

**Files:** `app/api/groups/route.ts` (lines 36-123)

**Fragile Scenarios:**
- Empty lines handled but could still cause index errors
- Quoted values with commas inside quotes might not parse correctly
- No validation that groupNumber is actually an integer
- No check for duplicate group numbers from different CSV rows
- Missing header validation - assumes exact column order

**Example that could break:**
```csv
1,"Smith, John",555-1234,john@example.com
```
The name "Smith, John" in quotes might not parse correctly.

**Fix Approach:**
- Replace custom parser with CSV library (papaparse, csv-parse, or csv-reader)
- Add schema validation with Zod after parsing
- Return error with line numbers when parsing fails
- Add header validation to ensure expected columns exist
- Add test cases for edge cases (quoted values, newlines in fields, etc.)

---

### No Error Recovery for Google Sheets Fetch (Medium Priority)

**Issue:** If Google Sheets becomes unreachable, entire dashboard becomes unusable.

**Files:** `app/api/groups/route.ts` (lines 5-32), `app/page.tsx` (lines 140-165)

**Current Behavior:**
```typescript
// No caching, no fallback
const response = await fetch(sheetUrl, {
  cache: 'no-store',  // Always fresh - no fallback if offline
});

// Generic error message doesn't help user
setError('Failed to load groups. Please check your configuration.');
```

**Impact:**
- Network blip causes complete feature loss
- No ability to use last-known-good data
- Dashboard shows generic error (unclear what's wrong)
- No retry mechanism for transient failures

**Fix Approach:**
- Add response caching with fallback to stale data
- Implement exponential backoff retry for fetch failures
- Store last successful response in sessionStorage
- Show more specific error messages (e.g., "Google Sheet unreachable - using cached data")
- Add health check endpoint

---

### Hardcoded Wedding Details (Low Priority - Not a Bug)

**Issue:** Wedding-specific text hardcoded throughout codebase.

**Files:** 
- `app/page.tsx` (line 294): "Mahek & Saumya's Wedding"
- `app/api/notify/route.ts` (lines 49, 101): "Mahek & Saumya"
- `app/login/page.tsx` (line 48): "Mahek & Saumya's Wedding"
- `app/login/page.tsx` (line 49): "May 24th, 2026"

**Impact:**
- Makes code harder to reuse for other weddings
- No way to customize without code changes
- Wedding date in login page could be confusing after the event

**Fix Approach:**
- Move to environment variables: `NEXT_PUBLIC_COUPLE_NAME`, `NEXT_PUBLIC_WEDDING_DATE`
- Update message templates in `app/api/notify/route.ts`
- Update UI strings in `app/page.tsx` and `app/login/page.tsx`

---

## Missing Critical Features

### No Request Rate Limiting (High Priority)

**Issue:** Notification API can be called unlimited times without throttling.

**Files:** `app/api/notify/route.ts`

**Attack Scenario:**
```typescript
// Malicious code could spam notifications
for (let i = 0; i < 1000; i++) {
  fetch('/api/notify', { ... });  // No rate limit
}
```

**Impact:**
- Could spend entire Twilio/SendGrid quota in seconds
- No protection against accidental double-sends
- No per-user rate limiting

**Fix Approach:**
- Add rate limiting middleware (next-rate-limit or custom)
- Limit to 5 requests per minute per session/IP
- Return 429 Too Many Requests when limit exceeded
- Log rate limit violations for monitoring

---

### No Request Validation/Schema (High Priority)

**Issue:** API endpoints don't validate request structure.

**Files:** All API routes

**Current Approach:**
```typescript
const body: NotificationRequest = await request.json();
// Assumes body.groupNumber and body.members exist
// No validation that members is array of GroupMembers
```

**Impact:**
- Malformed requests could cause crashes
- Type checking doesn't enforce runtime validation
- Client bugs propagate to API errors

**Fix Approach:**
- Add Zod schema validation (already in package.json under `@types/node`)
- Create reusable schemas for request bodies
- Validate and reject invalid requests before processing
- Return detailed error messages for validation failures

---

### No Idempotency Protection (Medium Priority)

**Issue:** Bulk notify is not idempotent - clicking twice sends twice.

**Files:** `app/page.tsx` (lines 86-128)

**Current Code:**
```typescript
// Double-click protection only in UI (disabled button)
// But if user makes direct API calls, sends duplicate notifications
```

**Impact:**
- User accidentally double-clicks button = duplicate SMS/WhatsApp/Email
- Wasted API credits and confused wedding guests
- No server-side deduplication

**Fix Approach:**
- Add idempotency key header to each notify request
- Server tracks seen idempotency keys, returns cached response
- Store idempotency key for 1 hour
- Prevents duplicates even if user retries

---

## Test Coverage Gaps

### No Tests for Critical Paths (High Priority)

**Issue:** No test files found in codebase.

**Files:** No `*.test.ts`, `*.spec.ts`, or test directory

**Untested Critical Paths:**
- CSV parsing edge cases (quoted values, special characters)
- Phone number formatting (international numbers, invalid formats)
- Notification sending with network failures
- Authentication token generation and verification
- Bulk notification logic with mixed success/failure

**Risk:** Changes to core logic could break production without detection

**Fix Approach:**
- Add Jest or Vitest configuration
- Write unit tests for:
  - `parseCSV()` function with edge cases
  - `formatPhoneNumber()` with various inputs
  - Authentication logic (valid/invalid tokens)
  - Notification logic (test mode vs production)
- Add integration tests for API endpoints
- Target minimum 80% coverage for critical paths

---

### No E2E Tests for User Workflows (Medium Priority)

**Issue:** No end-to-end test coverage for dashboard workflows.

**Impact:**
- Can't verify full user journey works
- Regression testing requires manual testing
- Hard to catch UI/API integration issues

**Fix Approach:**
- Add Playwright or Cypress for E2E testing
- Test critical user flows:
  - Login → view groups → select groups → bulk notify
  - Single group notification
  - Status filter and display
  - Logout

---

## Performance Concerns

### localStorage Status Sync Issue (Low Priority)

**Issue:** Group status updates not synced across multiple tabs.

**Files:** `app/page.tsx` (lines 175-180)

**Current Behavior:**
```typescript
// Saves to localStorage but doesn't sync with other tabs
localStorage.setItem('groupStatuses', JSON.stringify(statusMap));
```

**Impact:**
- If user has dashboard open in 2 tabs, status changes don't sync
- Each tab has independent state
- Confusion about which tab has current status

**Fix Approach:**
- Use localStorage 'storage' event to sync across tabs
- Or better: move status to server-side session/database
- Update parent component when another tab changes status

---

### No Caching Strategy (Low Priority)

**Issue:** Groups fetched fresh on every page load.

**Files:** `app/api/groups/route.ts` (line 16)

**Current Code:**
```typescript
cache: 'no-store',  // Always fetch fresh, no caching
```

**Impact:**
- Every dashboard view hits Google Sheets API
- Could trigger rate limits if many users/frequent refreshes
- Slows down page load

**Fix Approach:**
- Use ISR (Incremental Static Regeneration) with 5-minute revalidation
- Cache in `app/page.tsx` with SWR or React Query
- Show stale data while refreshing in background

---

## Dependencies at Risk

### Outdated Twilio and SendGrid APIs (Medium Priority)

**Issue:** Direct SDK usage without abstraction makes upgrades hard.

**Files:** `app/api/notify/route.ts` (lines 25-29, 66-113)

**Risk:**
- Twilio v5.x might have breaking changes in v6
- SendGrid API could deprecate current methods
- No abstraction layer to support multiple providers

**Fix Approach:**
- Create abstraction layer for notifications: `services/notifications/`
- Define interface: `sendSMS()`, `sendWhatsApp()`, `sendEmail()`
- Implement provider-specific adapters
- Makes switching providers easier in future

---

### Missing Security Headers (Medium Priority)

**Issue:** No security middleware or headers configured.

**Files:** `app/layout.tsx`, `next.config.ts`

**Missing Headers:**
- Content-Security-Policy (prevents XSS)
- X-Frame-Options (prevents clickjacking)
- X-Content-Type-Options (prevents MIME sniffing)
- Strict-Transport-Security (enforces HTTPS)

**Fix Approach:**
- Add Next.js middleware for security headers
- Or configure in `next.config.ts` with headers configuration
- Example headers:
  ```typescript
  'Content-Security-Policy': "default-src 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  ```

---

## Environment Configuration Issues

### Missing Error on Undefined Env Vars (Medium Priority)

**Issue:** Missing environment variables fail silently at runtime.

**Files:** `app/api/auth/login/route.ts` (line 8), `app/api/notify/route.ts` (lines 26-30)

**Current Code:**
```typescript
// Returns error response, but doesn't throw
if (!correctPassword) {
  return NextResponse.json({...}, { status: 500 });
}

// Silently uses undefined if env var missing
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
```

**Impact:**
- Twilio client initialized with undefined SID/token
- SendGrid API key set to empty string
- Failures are cryptic at notification time, not startup

**Fix Approach:**
- Add startup validation function
- Throw error immediately if required env vars missing
- List checked vars in error message
- Call validation in root layout or middleware

---

## Summary of Priorities

**Critical (Fix immediately):**
1. Authentication weakness (Base64 tokens)
2. Missing input validation (phone/email)
3. Email success logic bug (line 120)
4. Rate limiting on API endpoints
5. Request body validation with Zod

**High (Fix before production):**
1. Move auth token to HTTP-only cookies
2. Add CSRF protection
3. Add environment variable validation at startup
4. CSV parser robustness

**Medium (Fix soon):**
1. Add idempotency protection
2. Add error recovery for Google Sheets fetch
3. Add security headers
4. Create notification service abstraction
5. Hardcoded wedding details to env vars

**Low (Nice to have):**
1. localStorage sync across tabs
2. Caching strategy for groups fetch
3. Add comprehensive tests

---

*Concerns audit: 2026-04-03*
