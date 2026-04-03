# Testing Patterns

**Analysis Date:** 2026-04-03

## Test Framework

**Status:** No testing framework currently configured

**Observation:** This project does not have any test files, test runners, or testing configuration in place. No `jest.config.js`, `vitest.config.ts`, or similar test infrastructure exists in the codebase.

**Packages in use:**
- No testing libraries in `package.json`
- No test runners configured
- No assertion libraries

## Test File Organization

**Current State:** Not applicable - no tests exist

**Recommended Pattern for future implementation:**
- Location: Co-located tests alongside source files
- Naming: `[filename].test.ts` or `[filename].spec.ts`
- Directory structure:
```
app/
├── api/
│   ├── auth/
│   │   ├── login/
│   │   │   ├── route.ts
│   │   │   └── route.test.ts
│   │   └── verify/
│   │       ├── route.ts
│   │       └── route.test.ts
│   ├── groups/
│   │   ├── route.ts
│   │   └── route.test.ts
│   └── notify/
│       ├── route.ts
│       └── route.test.ts
components/
├── GroupCard.tsx
└── GroupCard.test.tsx
```

## Test Structure

**Current gaps:** No tests exist to document patterns

**Recommended approach (based on codebase structure):**

For API routes, tests should validate:
1. Request handling (JSON parsing, validation)
2. Error responses and HTTP status codes
3. Integration with external services (Twilio, SendGrid)
4. CSV parsing and data transformation logic

For components, tests should validate:
1. Rendering with different props
2. User interactions (click, input change)
3. State updates and callback invocations

For utilities/helpers, tests should validate:
1. Input transformation (formatPhoneNumber, parseCSV)
2. Edge cases (malformed input, empty data)
3. Output format correctness

## Mocking

**Strategy:** Not yet implemented

**Recommendations for future implementation:**

**Services to mock:**
- Twilio client for SMS/WhatsApp (in `app/api/notify/route.ts`)
- SendGrid mail client (in `app/api/notify/route.ts`)
- Google Sheets fetch (in `app/api/groups/route.ts`)
- Fetch API calls for client-side code

**Test mode pattern already exists:**
The codebase has a built-in test/mock pattern:
```typescript
// From app/api/notify/route.ts
const isTestMode = process.env.TEST_MODE === 'true';

if (isTestMode) {
  // Simulate notifications without actual sends
  console.log('🧪 TEST MODE - Would send SMS to:', member.phone);
  memberResult.smsStatus = 'simulated-success';
} else {
  // Production sends using real Twilio/SendGrid
  const smsMessage = await twilioClient!.messages.create({...});
}
```

This pattern can be extended with unit test mocks using Jest/Vitest.

## Fixtures and Factories

**Current state:** Not implemented

**Recommended test data (inferred from types in `types/index.ts`):**

```typescript
// Example test fixtures
const mockGroupMember = {
  name: 'John Doe',
  phone: '+14155552671',
  email: 'john@example.com'
};

const mockGroup = {
  groupNumber: 1,
  members: [mockGroupMember],
  status: 'waiting' as const
};

const mockNotificationRequest = {
  groupNumber: 1,
  members: [mockGroupMember]
};

const mockNotificationResponse = {
  success: true,
  message: 'Notifications sent successfully',
  results: [{
    member: 'John Doe',
    smsStatus: 'sent',
    whatsappStatus: 'sent',
    emailStatus: 'sent'
  }]
};

// CSV test data
const validCSV = `Group Number,Name,Phone,Email
1,"John Doe","415-555-2671","john@example.com"
1,"Jane Doe","415-555-2672","jane@example.com"
2,"Bob Smith","+14155552673","bob@example.com"`;

const csvWithQuotes = `Group Number,Name,Phone,Email
1,"Doe, John","415-555-2671","john@example.com"`;
```

## Coverage

**Requirements:** No coverage targets currently enforced

**Recommended coverage areas for testing:**

**Critical paths (should be 100% covered):**
- `app/api/auth/login/route.ts` - Authentication is security-critical
- `app/api/auth/verify/route.ts` - Session validation is security-critical
- Phone number formatting (`formatPhoneNumber` in `app/api/groups/route.ts`) - Data quality critical
- CSV parsing logic (`parseCSV`, `parseCSVLine` in `app/api/groups/route.ts`) - Core data loading

**High priority (80%+ coverage):**
- `app/api/notify/route.ts` - Notification flow with multiple service integrations
- `app/api/groups/route.ts` - Data fetching and transformation
- `app/page.tsx` - Main dashboard logic (state management, filtering)

**Medium priority (50%+ coverage):**
- `components/GroupCard.tsx` - UI component rendering and interactions
- `app/login/page.tsx` - Authentication UI flow

## Test Types

**Not yet implemented**

**Recommended approach:**

**Unit Tests:**
- Scope: Individual functions and utilities
- Focus: `formatPhoneNumber`, `parseCSV`, `parseCSVLine`
- Pattern: Test pure functions with various inputs
- Example:
```typescript
describe('formatPhoneNumber', () => {
  it('should format 10-digit US numbers with +1 prefix', () => {
    expect(formatPhoneNumber('4155552671')).toBe('+14155552671');
  });
  
  it('should preserve numbers already with + prefix', () => {
    expect(formatPhoneNumber('+14155552671')).toBe('+14155552671');
  });
  
  it('should handle numbers with hyphens and spaces', () => {
    expect(formatPhoneNumber('(415) 555-2671')).toBe('+14155552671');
  });
});
```

**Integration Tests:**
- Scope: API routes with mocked external services
- Focus: Request → Response flow with dependencies
- Pattern: Mock Twilio, SendGrid, Google Sheets; test handlers
- Example:
```typescript
describe('POST /api/notify', () => {
  it('should send notifications to all group members', async () => {
    const mockTwilio = mockTwilioClient();
    const mockMail = mockSendGridMail();
    
    const response = await POST(mockRequest({
      groupNumber: 1,
      members: [mockGroupMember]
    }));
    
    expect(mockTwilio.messages.create).toHaveBeenCalledTimes(1);
    expect(mockMail.send).toHaveBeenCalledTimes(1);
  });
  
  it('should return 400 when no members provided', async () => {
    const response = await POST(mockRequest({
      groupNumber: 1,
      members: []
    }));
    
    expect(response.status).toBe(400);
  });
});
```

**E2E Tests:**
- Not currently used
- Could be implemented with Playwright or Cypress for:
  - Login flow (`app/login/page.tsx`)
  - Dashboard navigation and filtering
  - Notification sending end-to-end
  - Test mode verification

## Common Patterns

**Async testing:** Not yet documented (no test framework)

**Recommended pattern (for when framework is added):**
```typescript
// Using async/await pattern
it('should fetch and parse groups', async () => {
  const response = await fetch('/api/groups');
  const data = await response.json();
  expect(data.groups).toBeInstanceOf(Array);
});

// Using done callback pattern
it('should verify auth token', (done) => {
  POST(mockRequest()).then(response => {
    expect(response.status).toBe(200);
    done();
  });
});
```

**Error testing:** Not yet documented

**Recommended pattern:**
```typescript
// API error scenarios
describe('API error handling', () => {
  it('should return 500 when Google Sheets URL not configured', async () => {
    delete process.env.GOOGLE_SHEET_CSV_URL;
    const response = await GET();
    expect(response.status).toBe(500);
    expect(response.json().error).toContain('not configured');
  });
  
  it('should catch and handle Twilio errors gracefully', async () => {
    mockTwilio.messages.create.mockRejectedValue(
      new Error('Invalid phone number')
    );
    
    const response = await POST(mockRequest());
    expect(response.json().results[0].smsStatus).toBe('failed');
    expect(response.json().success).toBe(false);
  });
});
```

## Future Testing Setup

**To implement testing in this project:**

1. **Install testing framework:**
   ```bash
   npm install --save-dev jest @types/jest ts-jest
   # OR
   npm install --save-dev vitest
   ```

2. **Install assertion library:**
   ```bash
   npm install --save-dev @testing-library/react
   npm install --save-dev @testing-library/jest-dom
   ```

3. **Configure test runner:**
   - Create `jest.config.js` or `vitest.config.ts`
   - Update `tsconfig.json` to include test files
   - Add `test` script to `package.json`

4. **Mock external services:**
   - Mock Twilio: `jest.mock('twilio')`
   - Mock SendGrid: `jest.mock('@sendgrid/mail')`
   - Mock fetch for Google Sheets

5. **Start with critical path testing:**
   - Authentication routes (security)
   - Phone number formatting (data quality)
   - CSV parsing (core functionality)

---

*Testing analysis: 2026-04-03*

**Note:** This project currently lacks automated testing infrastructure. The recommendations above provide a roadmap for implementing tests following the patterns and conventions already established in the codebase.
