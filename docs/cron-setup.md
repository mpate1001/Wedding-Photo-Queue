# VPS Cron Setup for Guest Auto-Add

Daily job that adds up to 50 missing guests to the WhatsApp announcements group
(and eventually the photo group closer to the wedding).

## Prerequisites
- App deployed to VPS at photos.mikemetsaumone.com (or via localhost on the VPS)
- WhatsApp client authenticated (QR code scanned, session persisted)
- `WHATSAPP_ANNOUNCEMENTS_GROUP_ID` set in `.env.local`
- `DASHBOARD_PASSWORD` set in `.env.local`

## Setup

### 1. Generate and store a cron auth token

```bash
cd /opt/wedding-photo-queue  # or wherever the app lives on the VPS
PW=$(grep DASHBOARD_PASSWORD .env.local | cut -d= -f2)
echo -n "${PW}:$(date +%s)" | base64 > .cron-token
chmod 600 .cron-token
```

**Note:** The token has no explicit expiry. If you rotate `DASHBOARD_PASSWORD`, regenerate `.cron-token`.

### 2. Add the cron entry

```bash
crontab -e
```

Add this line (runs at 10:00 AM VPS-local daily, announcements group):

```cron
0 10 * * * curl -s -X POST -H "Authorization: Bearer $(cat /opt/wedding-photo-queue/.cron-token)" -H "Content-Type: application/json" -d '{"groupType":"announcements","batchSize":50}' http://localhost:3000/api/guests/add-batch >> /var/log/wedding-cron.log 2>&1
```

### 3. Monitor the log

```bash
tail -f /var/log/wedding-cron.log
```

Expected output per run (JSON on one line):
```
{"added":47,"failed":3,"remaining":193,"lastRun":"2026-04-12T10:00:00.000Z"}
```

Or, if already ran in the last 12 hours:
```
{"skipped":true,"reason":"already ran within 12-hour cooldown","lastRun":"...","added":0}
```

### 4. Add a second cron for the photo group (closer to the wedding)

Same cron, swap the `groupType`:
```cron
30 10 * * * curl -s -X POST -H "Authorization: Bearer $(cat /opt/wedding-photo-queue/.cron-token)" -H "Content-Type: application/json" -d '{"groupType":"photo","batchSize":50}' http://localhost:3000/api/guests/add-batch >> /var/log/wedding-cron.log 2>&1
```

(Staggered 30 minutes so both don't hit WhatsApp at the exact same time.)

## Safety

- 12-hour cooldown prevents double-runs.
- 5-second pacing between individual `addParticipants()` calls.
- Max 100 per batch (default 50) to stay below WhatsApp rate-limit thresholds.
- Failures per-guest are logged but don't stop the batch.
