# Wedding Photo Queue App

A password-protected web application to manage group photo queuing for Mahek & Saumya's wedding (May 24th, 2026). Event planners can track groups, queue them, and send bulk SMS + WhatsApp + Email notifications when it's time for their photo.

**Live at:** [photos.mikemetsaumone.com](https://photos.mikemetsaumone.com)

## Features

### Core Functionality
- 🔒 **Password-protected dashboard** - Secure access for event planners
- 📊 **Real-time group tracking** from Google Sheets
- 📲 **Triple notification redundancy**: SMS + WhatsApp + Email sent simultaneously
- 👥 **Multi-member groups**: Multiple people per group number
- 🔢 **Auto phone formatting**: Adds +1 prefix to US numbers
- 📱 **Mobile-responsive design**: Works on phones and tablets

### Queue Management
- **4 status levels**: Waiting → Queued → Notified → Completed
- **Filter buttons**: Quick access to groups by status
- **Real-time stats**: Total, waiting, queued, notified, completed counts
- **Persistent status tracking**: Saves to browser localStorage

### Bulk Operations (NEW!)
- ☑️ **Checkbox selection**: Select individual groups
- ✅ **Select All**: Bulk select filtered groups
- 📲 **Bulk notify**: Send notifications to multiple groups at once
- 📊 **Success tracking**: See how many notifications succeeded

### Test Mode
- 🧪 **Simulate notifications**: Test without using credits
- 💰 **Save money**: No SMS/WhatsApp/Email sent in test mode
- 📝 **Console logging**: See what would be sent
- ⚠️ **Visual indicator**: Yellow banner when test mode active

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS
- **Hosting**: Vercel (Free tier)
- **Domain**: Custom domain via Vercel
- **Data Source**: Google Sheets (published as CSV)
- **SMS & WhatsApp**: Twilio
- **Email**: SendGrid (Free tier - 100 emails/day)
- **Authentication**: Password-based with localStorage session

## Cost Estimate

- **Hosting**: $0 (Vercel free tier)
- **Domain**: Already owned
- **Email**: $0 (SendGrid free tier - 100/day)
- **SMS**: ~$0.0079 per message (Twilio)
- **WhatsApp**: ~$0.005 per message (Twilio - cheaper!)
- **Phone Number Rental**: ~$1/month (only need for wedding month)

**Estimated total for 50 groups with 2 members each: ~$2-3**

## Quick Start

### Prerequisites
- Twilio account (SMS + WhatsApp)
- SendGrid account (Email)
- Google Sheet with group data
- Vercel account (hosting)

### Environment Variables

Create a `.env.local` file:

```env
# Google Sheets - Published CSV URL
GOOGLE_SHEET_CSV_URL=your_published_sheet_url

# Dashboard Password
DASHBOARD_PASSWORD=MikeMetSaumOne!

# Test Mode (true = simulate, false = real sends)
TEST_MODE=true

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=+14155238886

# SendGrid
SENDGRID_API_KEY=SG.your_api_key
SENDGRID_FROM_EMAIL=your-verified-email@example.com
```

### Install & Run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` and login with your password.

## Google Sheets Format

Your spreadsheet should have these columns (with header row):

| Group Number | Name | Phone | Email |
|--------------|------|-------|-------|
| 1 | John Smith | 2025551234 | john@example.com |
| 1 | Jane Smith | 2025555678 | jane@example.com |
| 2 | Bob Jones | 2025559012 | bob@example.com |

**Note:** Phone numbers will auto-format with +1 prefix. Multiple rows with same group number = multiple members.

**To publish:**
1. File → Share → Publish to web
2. Select "Comma-separated values (.csv)"
3. Choose your sheet tab
4. Copy the published URL

## Pre-Wedding Checklist

### 2 Weeks Before (Early May 2026)
- [ ] Buy Twilio phone number (~$1/month)
- [ ] Add $20-30 Twilio credits
- [ ] Update `TWILIO_PHONE_NUMBER` in Vercel
- [ ] Optional: Apply for WhatsApp Business API approval

### 1 Week Before
- [ ] Set `TEST_MODE=false` in Vercel
- [ ] Send test notifications to yourself
- [ ] Verify SMS, WhatsApp, and Email all work
- [ ] Finalize Google Sheet with all groups

### Wedding Day (May 24, 2026)
- [ ] Give event planners URL and password
- [ ] Show them bulk notify feature
- [ ] Keep `TEST_MODE=false`
- [ ] Monitor notifications as needed

## Usage Guide

### Login
1. Visit `photos.mikemetsaumone.com`
2. Enter dashboard password
3. Click "Login"

### Individual Notify
1. Find the group in the list
2. Change status to "Queued" (optional)
3. Click "📲 Notify" button
4. Confirm the alert
5. Status auto-updates to "Notified"

### Bulk Notify (Event Planners!)
1. Filter to "Queued" groups
2. Click "☑️ Select All" or check individual groups
3. Click "📲 Notify X Groups" in the blue banner
4. Confirm the bulk action
5. Wait for sequential sends to complete
6. All selected groups marked as "Notified"

### Filter Groups
- Click colored buttons to filter by status
- **📋 All Groups**: Show everything
- **⏳ Waiting**: Not yet queued
- **📝 Queued**: Ready to notify
- **📲 Notified**: Already sent
- **✅ Completed**: Photo taken

### Refresh Data
- Click "🔄 Refresh" to pull latest from Google Sheets
- Use this if you updated the sheet

## Notification Messages

Each member receives a personalized message with their name:

**SMS & WhatsApp:**
```
Hi [Name]! Time for your group photo with Mahek & Saumya!
Please head to the Mandap now. 📸
```

**Email:**
```
Subject: 📸 Time for Your Group Photo!

Hi [Name]!

It's time for your group photo with Mahek & Saumya!

Please head to the Mandap now.

Thank you!
- Wedding Planning Team
```

## File Structure

```
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts       # Login authentication
│   │   │   └── verify/route.ts      # Session verification
│   │   ├── groups/route.ts          # Fetch groups from Google Sheets
│   │   ├── notify/route.ts          # Send SMS + WhatsApp + Email
│   │   └── test-mode/route.ts       # Check if test mode enabled
│   ├── login/page.tsx               # Login page
│   └── page.tsx                     # Main dashboard
├── components/
│   └── GroupCard.tsx                # Group card with selection
├── types/
│   └── index.ts                     # TypeScript definitions
└── .env.local                       # Environment variables (not committed)
```

## Troubleshooting

### Can't Login
- Check password is correct
- Try clearing browser cache/localStorage
- Verify `DASHBOARD_PASSWORD` is set in Vercel

### Groups Not Loading
- Verify `GOOGLE_SHEET_CSV_URL` is correct
- Ensure sheet is published to web as CSV
- Check sheet has correct column names
- Try clicking "🔄 Refresh"

### Notifications Not Sending
- Verify `TEST_MODE=false` in Vercel
- Check Twilio credentials are correct
- Verify SendGrid API key and sender email
- Check phone numbers have +1 prefix
- Look at browser console for errors

### Test Mode Won't Disable
- Check Vercel environment variable `TEST_MODE`
- Must be set to `false` or removed entirely
- Redeploy after changing env variables

## Development

Built with:
- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Twilio SDK
- SendGrid SDK

Key dependencies:
```json
{
  "next": "^16.0.3",
  "react": "^19.0.0",
  "twilio": "^5.x",
  "@sendgrid/mail": "^8.x",
  "tailwindcss": "^4.x"
}
```

## Security

- ✅ Password-protected dashboard
- ✅ Session-based authentication
- ✅ API keys never exposed to frontend
- ✅ `.env.local` excluded from git
- ✅ All secrets stored in Vercel environment variables

## License

MIT - Built for Mahek & Saumya's Wedding, May 24th, 2026

---

**Questions?** Contact the developer or check Vercel logs for errors.
