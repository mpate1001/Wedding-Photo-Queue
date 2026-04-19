# External Integrations

**Analysis Date:** 2025-04-03

## APIs & External Services

**SMS & WhatsApp Messaging:**
- Twilio - SMS and WhatsApp message delivery for group photo notifications
  - SDK/Client: `twilio` npm package v5.10.6
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` environment variables
  - Implementation: `app/api/notify/route.ts` POST handler
  - Methods used:
    - `twilio(accountSid, authToken)` - Initialize client
    - `twilioClient.messages.create()` - Send SMS from `TWILIO_PHONE_NUMBER` to member phone
    - `twilioClient.messages.create()` with `whatsapp:` prefix - Send WhatsApp from `TWILIO_WHATSAPP_NUMBER`
  - Configuration: Phone numbers auto-formatted to E.164 format (`+1XXXXXXXXXX`) in `app/api/groups/route.ts`

**Email Delivery:**
- SendGrid - Transactional email for group photo notifications
  - SDK/Client: `@sendgrid/mail` npm package v8.1.6
  - Auth: `SENDGRID_API_KEY` environment variable
  - Implementation: `app/api/notify/route.ts` POST handler
  - Methods used:
    - `sgMail.setApiKey()` - Initialize client with API key
    - `sgMail.send()` - Send email from `SENDGRID_FROM_EMAIL` to member email
  - Email format: HTML + plain text with branded notification content

**Google Data Source:**
- Google Sheets (Published as CSV) - External data source for wedding guest groups
  - Connection: Public CSV export URL stored in `GOOGLE_SHEET_CSV_URL`
  - Client: Native `fetch()` API (no SDK required)
  - Implementation: `app/api/groups/route.ts` GET handler
  - Fetch strategy: `cache: 'no-store'` for always-fresh data
  - Data structure: CSV with columns: Group Number | Name | Phone | Email
  - Parsing: Custom CSV parser in `parseCSV()` and `parseCSVLine()` functions

## Data Storage

**Databases:**
- Not detected - No database integration. Data is:
  - Read-only from Google Sheets
  - Ephemeral state stored in browser localStorage (status transitions: waiting → queued → notified → completed)
  - No persistent backend storage

**File Storage:**
- Not applicable - No file upload/storage functionality

**Caching:**
- Browser localStorage - Stores group status and auth token (`localStorage.setItem()` at app level)
- Next.js: `cache: 'no-store'` on Google Sheets fetch to prevent stale data

## Authentication & Identity

**Auth Provider:**
- Custom - Simple password-based authentication
  - Implementation: `app/api/auth/login/route.ts` POST handler
  - Mechanism: 
    - User submits password via login form (`app/login/page.tsx`)
    - Server compares against `DASHBOARD_PASSWORD` environment variable
    - If correct, returns Base64-encoded token: `Buffer.from(`${password}:${Date.now()}`).toString('base64')`
    - Token stored in browser localStorage
  - Verification: `app/api/auth/verify/route.ts` POST handler validates token by decoding and checking password match
  - Not production-ready: Uses Base64 token instead of JWT; timestamp not validated

## Monitoring & Observability

**Error Tracking:**
- Not detected - No error tracking service (Sentry, Rollbar, etc.)
- Console logging: `console.error()` and `console.log()` statements for debugging

**Logs:**
- Server-side: Console logs in Node.js runtime via `console.error()` and `console.log()`
  - Notification errors logged in `app/api/notify/route.ts`
  - Group fetch errors logged in `app/api/groups/route.ts`
  - Login errors logged in `app/api/auth/login/route.ts`
- Test Mode: Special logging for simulated notifications (TEST_MODE=true)
  - Logs: `console.log('🧪 TEST MODE - Would send SMS to:...')`

## CI/CD & Deployment

**Hosting:**
- Vercel - Primary deployment platform for Next.js app
  - Live URL: `photos.mikemetsaumone.com`
  - Environment variables configured in Vercel dashboard
  - Auto-deployment on git push

**CI Pipeline:**
- Not explicitly configured - Vercel handles build/test/deploy automatically
- Available npm scripts:
  - `npm run dev` - Local development server (http://localhost:3000)
  - `npm run build` - Production build (Next.js compilation)
  - `npm run start` - Start production server
  - `npm run lint` - ESLint validation

## Environment Configuration

**Required env vars:**

| Variable | Usage | Example |
|----------|-------|---------|
| `GOOGLE_SHEET_CSV_URL` | Fetch group data | `https://docs.google.com/spreadsheets/d/.../export?format=csv` |
| `DASHBOARD_PASSWORD` | Single-password auth | Any string |
| `TEST_MODE` | Simulate notifications | `true` or `false` |
| `TWILIO_ACCOUNT_SID` | Twilio auth | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio auth | 32-char token |
| `TWILIO_PHONE_NUMBER` | SMS sender | `+1234567890` |
| `TWILIO_WHATSAPP_NUMBER` | WhatsApp sender | `+1234567890` |
| `SENDGRID_API_KEY` | Email auth | `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `SENDGRID_FROM_EMAIL` | Email sender | `noreply@photos.mikemetsaumone.com` |

**Secrets location:**
- Local: `.env.local` (git-ignored, never committed)
- Production: Vercel Environment Variables dashboard (encrypted)
- Build-time: Accessible via `process.env.*` in Node.js runtime

## Webhooks & Callbacks

**Incoming:**
- Not detected - No webhook endpoints. All requests initiated by UI clicks or automated jobs.

**Outgoing:**
- Twilio callbacks - Potential for delivery status webhooks (not currently implemented)
  - SMS/WhatsApp delivery receipts could be configured in Twilio console
- SendGrid callbacks - Potential for email bounce/delivery callbacks (not currently implemented)

---

*Integration audit: 2025-04-03*
