// app/api/notify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAuth } from '@/lib/require-auth';
import { escapeHtml } from '@/lib/escape-html';
import { whenReady } from '@/lib/whatsapp-session';
import type { NotificationRequest, NotificationResponse } from '@/types';

// Server-side dedup: Map<groupNumber, lastSendTimestamp>
// Safe on Hetzner VPS — long-running process, Map persists across requests
const lastSentMap = new Map<number, number>();
const COOLDOWN_MS = 60_000;

export async function POST(request: NextRequest) {
  // Auth gate — must be first
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body: NotificationRequest = await request.json();
    const { groupNumber, members } = body;

    // isResend: true if group has been successfully sent before (Map has entry)
    const isResend = lastSentMap.has(groupNumber);

    // Server-side dedup: reject if last successful notification was within cooldown window
    const lastSent = lastSentMap.get(groupNumber);
    if (lastSent && Date.now() - lastSent < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
      return NextResponse.json(
        {
          success: false,
          message: `Notification sent too recently. Wait ${waitSec} seconds before resending.`,
        },
        { status: 429 }
      );
    }

    if (!members || members.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No group members provided' },
        { status: 400 }
      );
    }

    const isTestMode = process.env.TEST_MODE === 'true';

    const response: NotificationResponse = {
      success: true,
      message: isTestMode
        ? 'TEST MODE: Notifications simulated (no real sends)'
        : 'Notifications sent successfully',
      whatsappGroupStatus: 'pending',
      results: [],
    };

    // ── Per-member: Email (Gmail SMTP) ───────────────────────────────────────
    if (isTestMode) {
      for (const member of members) {
        console.log(`[TEST] Would email ${member.email} — Group ${groupNumber}: ${member.name}`);
        response.results!.push({
          member: member.name,
          emailStatus: 'simulated-success',
          whatsappDmStatus: 'simulated-success',
        });
      }
    } else {
      // Set up Gmail transporter
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      for (const member of members) {
        let emailStatus = 'failed';

        // Send email
        try {
          await transporter.sendMail({
            from: `"Wedding Photo Queue" <${process.env.GMAIL_USER}>`,
            to: member.email,
            subject: isResend ? 'Reminder: We\'re Still Waiting for Your Group Photo!' : 'Saumya & Mahek Are Calling You for a Photo!',
            text: isResend
              ? `Hi ${member.name},\n\nThis is a friendly reminder from Saumya & Mahek — we're still waiting for you to come take a group photo with us!\n\nPlease head to the Mandap and queue up on the left side as soon as you can so we can wrap up group photos on time.\n\nThank you!\n- Saumya & Mahek`
              : `Hi ${member.name}!\n\nThis is Saumya & Mahek calling you to come take a photo with us!\n\nPlease head to the Mandap and queue up on the left side of the Mandap now.\n\nThank you!\n- Saumya & Mahek`,
            html: isResend
              ? `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #e67e22;">Reminder: We're Still Waiting for Your Group Photo!</h2>
                <p style="font-size: 16px;">Hi ${escapeHtml(member.name)},</p>
                <p style="font-size: 16px;">This is a friendly reminder from <strong>Saumya &amp; Mahek</strong> — we're still waiting for you to come take a group photo with us!</p>
                <p style="font-size: 16px; background-color: #fef9e7; padding: 15px; border-left: 4px solid #e67e22;">
                  <strong>Please head to the Mandap and queue up on the left side</strong> as soon as you can so we can wrap up group photos on time.
                </p>
                <p style="font-size: 14px; color: #7f8c8d; margin-top: 20px;">Thank you!<br>- Saumya &amp; Mahek</p>
              </div>
              `
              : `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Saumya &amp; Mahek Are Calling You for a Photo!</h2>
                <p style="font-size: 16px;">Hi ${escapeHtml(member.name)}!</p>
                <p style="font-size: 16px;">This is <strong>Saumya &amp; Mahek</strong> calling you to come take a photo with us!</p>
                <p style="font-size: 16px; background-color: #f8f9fa; padding: 15px; border-left: 4px solid #4a90e2;">
                  <strong>Please head to the Mandap and queue up on the left side of the Mandap now.</strong>
                </p>
                <p style="font-size: 14px; color: #7f8c8d; margin-top: 20px;">Thank you!<br>- Saumya &amp; Mahek</p>
              </div>
              `,
          });
          emailStatus = 'sent';
        } catch (emailError) {
          console.error(`[Email] Error for ${member.name}:`, emailError);
        }

        response.results!.push({
          member: member.name,
          emailStatus,
          whatsappDmStatus: 'skipped',
        });
      }
    }

    // ── WhatsApp Group Post (whatsapp-web.js) — best-effort ──────────────────
    const groupNames = members.map((m) => m.name).join(', ');
    const whatsappGroupMessage = isResend
      ? `*Reminder*\nGroup ${groupNumber} — ${groupNames}\n\nThis is Saumya & Mahek — we're still waiting for you to come take a group photo with us!\n\nPlease head to the Mandap and queue up on the left side as soon as you can so we can wrap up group photos on time.\n\nThank you!`
      : `*Group Photo Time!*\nGroup ${groupNumber} — ${groupNames}\n\nThis is Saumya & Mahek calling you to come take a photo with us!\n\nPlease head to the Mandap and queue up on the left side of the Mandap now.\n\nThank you!`;

    if (isTestMode) {
      console.log(`[TEST] Would post to WhatsApp group: "${whatsappGroupMessage}"`);
      response.whatsappGroupStatus = 'simulated-success';
    } else {
      const whatsappGroupId = process.env.WHATSAPP_GROUP_ID;
      if (!whatsappGroupId) {
        console.warn('[WhatsApp] WHATSAPP_GROUP_ID not set — skipping group post');
        response.whatsappGroupStatus = 'skipped';
      } else {
        try {
          const client = await whenReady();
          await client.sendMessage(whatsappGroupId, whatsappGroupMessage);
          response.whatsappGroupStatus = 'sent';
        } catch (whatsappError) {
          console.error('[WhatsApp] Group post error:', whatsappError);
          response.whatsappGroupStatus = 'failed';
        }
      }
    }

    // ── WhatsApp Individual DMs (whatsapp-web.js) — best-effort ─────────────
    if (!isTestMode) {
      try {
        const client = await whenReady();
        for (const member of members) {
          if (!member.phone) continue;
          const cleanNumber = member.phone.replace(/[^0-9]/g, '');
          if (!cleanNumber) continue;
          const chatId = `${cleanNumber}@c.us`;

          const dmMessage = isResend
            ? `Hi ${member.name}, this is a friendly reminder from Saumya & Mahek — we're still waiting for you to come take a group photo with us! Please head to the Mandap and queue up on the left side as soon as you can so we can wrap up group photos on time. Thank you!`
            : `Hi ${member.name}! This is Saumya & Mahek calling you to come take a photo with us! Please head to the Mandap and queue up on the left side of the Mandap now. Thank you!`;

          try {
            await client.sendMessage(chatId, dmMessage);
            console.log(`[WhatsApp DM] Sent to ${member.name} (${chatId})`);
            const memberResult = response.results!.find(r => r.member === member.name);
            if (memberResult) memberResult.whatsappDmStatus = 'sent';
          } catch (dmError) {
            console.error(`[WhatsApp DM] Error for ${member.name} (${chatId}):`, dmError);
            const memberResult = response.results!.find(r => r.member === member.name);
            if (memberResult) memberResult.whatsappDmStatus = 'failed';
          }
        }
      } catch {
        console.warn('[WhatsApp DM] Client not ready — skipping individual messages');
      }
    }

    // Determine overall success: at least one channel must succeed per member
    const anySuccess = response.results!.some(
      (r) => r.emailStatus === 'sent' || r.emailStatus === 'simulated-success' ||
             r.whatsappDmStatus === 'sent' || r.whatsappDmStatus === 'simulated-success'
    );

    // Record successful send in dedup Map — only after at least one channel succeeded
    if (anySuccess) {
      lastSentMap.set(groupNumber, Date.now());
    }

    if (!anySuccess) {
      response.success = false;
      response.message = 'All notifications failed';
    } else {
      const emailCount = response.results!.filter((r) => r.emailStatus === 'sent' || r.emailStatus === 'simulated-success').length;
      const dmCount = response.results!.filter((r) => r.whatsappDmStatus === 'sent' || r.whatsappDmStatus === 'simulated-success').length;
      response.message = `Sent to ${members.length} member(s): ${emailCount} emails, ${dmCount} WhatsApp DMs`;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
