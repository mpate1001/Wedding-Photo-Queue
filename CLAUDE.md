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
