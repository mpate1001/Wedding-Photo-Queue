# VPS Deployment Guide

Quick reference for deploying to the production VPS.

## Server Info

- **SSH:** `ssh mahek@87.99.145.157`
- **Host:** `87.99.145.157`
- **User:** `mahek`
- **Live URL:** https://photos.mikemetsaumone.com
- **App directory:** `~/app`
- **Process manager:** pm2 (app name: `wedding`)
- **Reverse proxy:** nginx (SSL terminated at nginx, app runs HTTP on localhost:3000)

## Standard Deploy (after pushing to `dev`)

```bash
ssh mahek@87.99.145.157
cd ~/app
git pull origin dev
npm run build
pm2 restart wedding
pm2 logs wedding --lines 30
```

Exit logs with `Ctrl+C`. Exit SSH with `exit`.

## First-Time Env Var Setup

If you added a new environment variable locally, also add it to the VPS:

```bash
ssh mahek@87.99.145.157
cd ~/app
nano .env.local
```

Add the new line(s), save with `Ctrl+O` → `Enter` → `Ctrl+X`, then rebuild:

```bash
npm run build
pm2 restart wedding
```

### Required env vars

- `GOOGLE_SHEET_CSV_URL` — photo queue sheet (Group Number | Name | Phone | Email)
- `FINAL_GUEST_LIST` — final wedding guest list sheet (PK | First | Last | Side | Relationship | Wedding | Email | Phone | Address)
- `DASHBOARD_PASSWORD` — dashboard login password
- `TEST_MODE` — `true` or `false`
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` — Gmail SMTP credentials
- `WHATSAPP_GROUP_ID` — photo coordination group
- `WHATSAPP_ANNOUNCEMENTS_GROUP_ID` — announcements group
- `PUPPETEER_EXECUTABLE_PATH` — path to Chrome/Chromium on the VPS

## Troubleshooting

### `git pull` blocked by local changes to `package-lock.json`

```bash
git checkout -- package-lock.json
git pull origin dev
```

### Build fails

Check the error, fix it locally, push, then redeploy. Do not commit fixes directly on the VPS.

### App not responding

```bash
pm2 status
pm2 logs wedding --lines 100
pm2 restart wedding
```

### Check WhatsApp session status

```bash
pm2 logs wedding | grep -i whatsapp
```

Look for `WhatsApp client ready` or QR-code prompts. If the session died, you may need to re-scan the QR code — check the app logs for a QR URL or path to the `.wwebjs_auth/` directory.

### SSL / nginx issues

- nginx config lives in `/etc/nginx/sites-available/` (usually need `sudo`)
- Reload nginx: `sudo systemctl reload nginx`
- Certbot renews SSL automatically via cron; force renewal: `sudo certbot renew`

### View full app environment

```bash
pm2 env 0   # or whatever the process id is from `pm2 status`
```

## Cron Job (Daily Auto-Add)

See `docs/cron-setup.md` for the VPS cron setup that calls `/api/guests/add-batch` daily.

## Useful pm2 Commands

```bash
pm2 status                    # list all processes
pm2 logs wedding              # live tail logs
pm2 logs wedding --lines 100  # last 100 lines
pm2 restart wedding           # restart app
pm2 stop wedding              # stop app
pm2 start wedding             # start app
pm2 save                      # persist process list across reboots
```

## Key Endpoints (for quick sanity checks)

- https://photos.mikemetsaumone.com — main dashboard
- https://photos.mikemetsaumone.com/guests — guest WhatsApp manager
- https://photos.mikemetsaumone.com/login — login page
