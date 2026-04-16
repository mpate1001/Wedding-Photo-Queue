# Production Readiness Checklist

Run through this before the wedding to make sure everything is live, configured, and ready.

## 1. Verify the live site works

From your browser (not SSH):

- https://photos.mikemetsaumone.com/login — log in with `WeddingMay2026`
- https://photos.mikemetsaumone.com — main dashboard, should show groups from the photo queue sheet
- https://photos.mikemetsaumone.com/guests — guest manager, should list attending guests

## 2. Confirm env vars on VPS

```bash
ssh mahek@87.99.145.157
cd ~/app
cat .env.local
```

All of these must be set (no blanks):

- `GOOGLE_SHEET_CSV_URL` — **real** photo queue sheet (not test data — update if still pointing at test)
- `FINAL_GUEST_LIST` — final guest list sheet (attending-only filtered at runtime)
- `DASHBOARD_PASSWORD=WeddingMay2026`
- `TEST_MODE=false`
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- `WHATSAPP_GROUP_ID`, `WHATSAPP_ANNOUNCEMENTS_GROUP_ID`
- `PUPPETEER_EXECUTABLE_PATH`

If anything changes, rebuild:

```bash
npm run build && pm2 restart wedding
```

## 3. Confirm WhatsApp session is alive

```bash
pm2 logs wedding --lines 50 | grep -iE "whatsapp|ready|qr"
```

Should see "WhatsApp client ready" or similar. If you see a QR prompt, the session died and needs re-scanning.

## 4. pm2 persistence across reboots

```bash
pm2 save
pm2 startup    # follow the printed instruction if not already enabled
```

This keeps the app running if the VPS reboots.

## 5. Set up the daily cron (optional, pre-wedding)

Follow `docs/cron-setup.md` — only needed if you want the "add 50 guests per day" to run automatically every morning. If you're fine clicking the button manually each day, skip this.

## 6. End-to-end notification test

From the dashboard:

1. Put yourself (or a test contact) in a test group in the Google Sheet
2. Reload the dashboard
3. Click "Notify" on that group
4. Verify you receive the email **and** the WhatsApp DM

This proves the full send pipeline works before guests depend on it.

## 7. Day-of safety

- Bookmark https://photos.mikemetsaumone.com on the coordinator's phone/tablet
- Confirm dashboard password is written down somewhere offline
- Know how to SSH in from your phone (Termius or similar) in case something breaks
- Keep a secondary device logged in as backup

## Priority Order

If short on time, do these first:

1. ✅ Section 1 — live site loads
2. ✅ Section 2 — photo queue sheet URL is real data, not test
3. ✅ Section 6 — end-to-end notification test
4. ✅ Section 3 — WhatsApp session alive
5. ✅ Section 4 — pm2 persistence
6. Sections 5, 7 — nice-to-haves

## Related Docs

- `docs/vps-deployment.md` — SSH + deploy commands
- `docs/cron-setup.md` — daily auto-add cron setup
