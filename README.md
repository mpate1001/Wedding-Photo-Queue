# Wedding Photo Queue App

A web-based application to manage group photo queuing for Mahek & Saumya's wedding. Wedding planners can track groups, queue them, and send SMS + WhatsApp + Email notifications when it's time for their photo.

## Features

- Real-time group tracking from Google Sheets
- Queue management with 4 statuses: Waiting, Queued, Notified, Completed
- **Triple notification redundancy**: SMS + WhatsApp + Email sent simultaneously
- Multiple members per group support
- Automatic US phone number formatting (+1 prefix)
- Beautiful dashboard with stats and filtering
- Persistent status tracking using localStorage
- Mobile-responsive design

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS
- **Hosting**: Vercel (Free tier)
- **Data Source**: Google Sheets (published as CSV)
- **SMS & WhatsApp**: Twilio
- **Email**: SendGrid (Free tier - 100 emails/day)

## Cost Estimate

- Hosting: **$0** (Vercel free tier)
- Email: **$0** (SendGrid free tier)
- SMS: **~$0.0079 per message** (Twilio)
- WhatsApp: **~$0.005 per message** (Twilio - cheaper than SMS!)
- **Total for 50 groups with 2 members each: ~$1.30**

## Setup Instructions

### 1. Google Sheets Setup

Create a spreadsheet with the following columns (header row):

| Group Number | Name | Phone | Email |
|--------------|------|-------|-------|
| 1 | Smith Family | +12345678901 | smith@example.com |
| 2 | Jones Family | +12345678902 | jones@example.com |

**Publish to web:**
1. Open your Google Sheet
2. Go to **File > Share > Publish to web**
3. Select **Comma-separated values (.csv)** as format
4. Choose the specific sheet tab
5. Click **Publish** and copy the URL

### 2. Twilio Setup (SMS)

1. Sign up at [https://www.twilio.com/](https://www.twilio.com/)
2. Get a phone number (trial or paid)
3. Copy your Account SID, Auth Token, and Phone Number from the console

### 3. Twilio WhatsApp Setup

**Option A: WhatsApp Sandbox (Testing - Free)**
1. Go to [https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
2. Follow instructions to join the sandbox (send "join <code>" to the WhatsApp number)
3. Use the sandbox number: `+14155238886` as your `TWILIO_WHATSAPP_NUMBER`
4. Note: Recipients must join the sandbox first by messaging the code

**Option B: WhatsApp Business API (Production - Requires Approval)**
1. Go to [https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders](https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders)
2. Submit your business profile for approval (can take 1-3 days)
3. Once approved, use your approved WhatsApp number
4. Recipients don't need to join anything

### 4. SendGrid Setup

1. Sign up at [https://sendgrid.com/](https://sendgrid.com/) (free tier)
2. Verify your sender email address
3. Create an API key at **Settings > API Keys**
4. Copy the API key

### 5. Local Development

Clone the repository and install dependencies:

```bash
npm install
```

Create a `.env.local` file (copy from `.env.example`):

```bash
cp .env.example .env.local
```

Fill in your credentials in `.env.local`:

```env
GOOGLE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/pub?output=csv

# TEST MODE: Set to 'true' to simulate notifications without sending (recommended for now!)
TEST_MODE=true

TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=+14155238886
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=your-verified-email@example.com
```

**Important:** Keep `TEST_MODE=true` until you're ready to send real notifications on the wedding day!

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Deploy to Vercel

1. Push your code to GitHub
2. Go to [https://vercel.com/](https://vercel.com/)
3. Click **Import Project** and select your repository
4. Add all environment variables from `.env.local` (including WhatsApp number)
5. Click **Deploy**

Your app will be live at `https://your-project.vercel.app`

## Test Mode

### What is Test Mode?

Test mode allows you to test the entire notification workflow WITHOUT actually sending SMS, WhatsApp, or Email messages. This saves your Twilio/SendGrid credits while you're building and testing.

### How to Use Test Mode

**Enabled (Default):**
```env
TEST_MODE=true
```
- Yellow banner appears at the top of the dashboard
- Clicking "Notify" simulates sending messages
- Console logs show what would be sent
- No credits are used
- Perfect for testing the UI and workflow

**Disabled (Production):**
```env
TEST_MODE=false
# or remove the TEST_MODE line entirely
```
- No test mode banner
- Clicking "Notify" sends REAL SMS, WhatsApp, and Email
- Credits are used
- Only enable this on wedding day!

### When to Disable Test Mode

1. **1-2 weeks before wedding**: Buy Twilio phone number
2. **1 week before wedding**: Test with your own phone number (`TEST_MODE=false`)
3. **Wedding day**: Keep `TEST_MODE=false` and go live!

## Usage

### Dashboard Features

1. **Stats Dashboard**: Shows total groups and status breakdown
2. **Filter Groups**: Filter by status (All, Waiting, Queued, Notified, Completed)
3. **Refresh**: Fetch latest data from Google Sheets
4. **Status Dropdown**: Manually update group status
5. **Notify Button**: Send SMS + WhatsApp + Email to ALL group members

### Notification Flow

1. Set group status to "Queued" when ready
2. Click "Notify" button to send notifications to all members
3. App sends SMS, WhatsApp, AND Email simultaneously (triple redundancy!)
4. Status automatically updates to "Notified"
5. Mark as "Completed" after photo is taken

### Notification Messages

All three channels (SMS, WhatsApp, Email) receive the same personalized message:

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

## Troubleshooting

### Groups not loading
- Check that `GOOGLE_SHEET_CSV_URL` is correct
- Ensure the sheet is published to web as CSV
- Verify the sheet has the correct column structure

### Notifications not sending
- Check Twilio credentials and phone number format (+1XXXXXXXXXX)
- Verify SendGrid API key and sender email is verified
- Check browser console and server logs for errors

### Status not persisting
- Status is saved in browser localStorage
- Clearing browser data will reset statuses
- Each browser/device maintains its own status independently

## File Structure

```
├── app/
│   ├── api/
│   │   ├── groups/route.ts      # Fetch groups from Google Sheets
│   │   └── notify/route.ts      # Send SMS + Email notifications
│   └── page.tsx                 # Main dashboard component
├── components/
│   └── GroupCard.tsx            # Individual group card component
├── types/
│   └── index.ts                 # TypeScript type definitions
└── .env.example                 # Environment variables template
```

## Development

Built with Next.js App Router and TypeScript. Key dependencies:

- `next` - React framework
- `twilio` - SMS notifications
- `@sendgrid/mail` - Email notifications
- `tailwindcss` - Styling

## License

MIT
