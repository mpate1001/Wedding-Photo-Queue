# Technology Stack

**Analysis Date:** 2025-04-03

## Languages

**Primary:**
- TypeScript 5.x - Full codebase including app routes, components, and types
- JavaScript (JSX/TSX) - React components and configuration files

**Secondary:**
- CSS - Tailwind CSS via PostCSS
- Bash - Build and development scripts (npm scripts only)

## Runtime

**Environment:**
- Node.js (managed by Vercel/Next.js) - Default runtime for all API routes
- Browser - Client-side React components

**Package Manager:**
- npm - Version not specified in package.json, uses lockfile `package-lock.json`
- Lockfile: `package-lock.json` present (241 KB)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack framework for App Router, API routes, and deployment to Vercel
- React 19.2.4 - UI library for components and hooks
- React DOM 19.2.4 - DOM rendering for React components

**Styling:**
- Tailwind CSS 4.x - Utility-first CSS framework via PostCSS
- @tailwindcss/postcss 4.x - PostCSS plugin for Tailwind

**Build/Dev:**
- TypeScript 5.x - Static type checking and compilation
- PostCSS - CSS transformation pipeline (config: `postcss.config.mjs`)
- ESLint 9.x - Code linting (config: `eslint.config.mjs`)
- eslint-config-next 16.0.3 - Next.js linting rules and configurations

## Key Dependencies

**Critical:**
- twilio 5.10.6 - SMS and WhatsApp messaging service client
  - Used in: `app/api/notify/route.ts`
  - Sends SMS via `messages.create()` with TWILIO_PHONE_NUMBER
  - Sends WhatsApp via `messages.create()` with whatsapp: prefix
  
- @sendgrid/mail 8.1.6 - Email delivery service client
  - Used in: `app/api/notify/route.ts`
  - Sends transactional emails via `sgMail.send()`

**Infrastructure:**
- next - Handles server-side rendering, API routes, and deployment
- @types/node 20.x - Node.js type definitions for TypeScript
- @types/react 19.x - React type definitions
- @types/react-dom 19.x - React DOM type definitions

## Configuration

**Environment:**
- Environment variables managed via `.env.local` (local development) and Vercel dashboard (production)
- No git-tracked `.env` files; `.env.local` is in `.gitignore`

**Key configs required:**
- `GOOGLE_SHEET_CSV_URL` - Published Google Sheets CSV endpoint for group data
- `DASHBOARD_PASSWORD` - Single password for dashboard access
- `TEST_MODE` - Boolean (`true`/`false`) to simulate notifications without Twilio/SendGrid costs
- `TWILIO_ACCOUNT_SID` - Twilio authentication SID
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `TWILIO_PHONE_NUMBER` - Twilio SMS sender phone number
- `TWILIO_WHATSAPP_NUMBER` - Twilio WhatsApp sender number
- `SENDGRID_API_KEY` - SendGrid API key for email delivery
- `SENDGRID_FROM_EMAIL` - Sender email address for transactional emails

**Build:**
- `next.config.ts` - Minimal Next.js configuration (no custom options currently)
- `tsconfig.json` - TypeScript compiler options with Next.js plugin support
  - Target: ES2017
  - Strict mode enabled
  - Path aliases: `@/*` maps to project root
- `postcss.config.mjs` - PostCSS pipeline with @tailwindcss/postcss plugin
- `eslint.config.mjs` - ESLint configuration with next/core-web-vitals and next/typescript configs

## Platform Requirements

**Development:**
- Node.js (compatible with package versions)
- npm (v7+ recommended for lockfile format)
- Modern browser with ES2017+ support

**Production:**
- Vercel hosting platform (primary deployment target)
- Environment variables configured in Vercel dashboard
- Google Sheets with published CSV export accessible via public URL
- Twilio account with SMS/WhatsApp messaging enabled
- SendGrid account with API key provisioned for email delivery

---

*Stack analysis: 2025-04-03*
