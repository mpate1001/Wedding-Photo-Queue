// app/api/notify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getWhatsAppClient, getWhatsAppStatus } from '@/lib/whatsapp-session';
import type { NotificationRequest, NotificationResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: NotificationRequest = await request.json();
    const { groupNumber, members } = body;

    // Dedup guard: reject if last notification was sent within cooldown window (per D-15, D-16)
    const COOLDOWN_MS = 60_000; // 60 seconds — Claude's discretion per D-16
    if (body.lastNotifiedAt && Date.now() - body.lastNotifiedAt < COOLDOWN_MS) {
      return NextResponse.json(
        {
          success: false,
          message: `Notification sent too recently. Wait ${Math.ceil((COOLDOWN_MS - (Date.now() - body.lastNotifiedAt)) / 1000)} seconds before resending.`,
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

    // ── Email: individual send per member ────────────────────────────────────
    if (isTestMode) {
      for (const member of members) {
        console.log(`[TEST] Would email ${member.email} — Group ${groupNumber}: ${member.name}`);
        response.results!.push({ member: member.name, emailStatus: 'simulated-success' });
      }
    } else {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      for (const member of members) {
        try {
          await transporter.sendMail({
            from: `"Wedding Photo Queue" <${process.env.GMAIL_USER}>`,
            to: member.email,
            subject: 'Time for Your Group Photo!',
            text: `Hi ${member.name}!\n\nIt's time for your group photo with Mahek & Saumya!\n\nPlease head to the Mandap now.\n\nThank you!\n- Wedding Planning Team`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Time for Your Group Photo!</h2>
                <p style="font-size: 16px;">Hi ${member.name}!</p>
                <p style="font-size: 16px;">It's time for your group photo with <strong>Mahek &amp; Saumya</strong>!</p>
                <p style="font-size: 16px; background-color: #f8f9fa; padding: 15px; border-left: 4px solid #4a90e2;">
                  <strong>Please head to the Mandap now.</strong>
                </p>
                <p style="font-size: 14px; color: #7f8c8d; margin-top: 20px;">Thank you!<br>- Wedding Planning Team</p>
              </div>
            `,
          });
          response.results!.push({ member: member.name, emailStatus: 'sent' });
        } catch (emailError) {
          console.error(`[Email] Error for ${member.name}:`, emailError);
          response.results!.push({ member: member.name, emailStatus: 'failed' });
        }
      }
    }

    // ── WhatsApp: one group post per notification call (per D-12) ────────────
    const groupNames = members.map((m) => m.name).join(', ');
    const whatsappMessage = `Group ${groupNumber} — ${groupNames}, you're up! Please head to the Mandap now for your group photo. Thank you!`;

    if (isTestMode) {
      console.log(`[TEST] Would post to WhatsApp group: "${whatsappMessage}"`);
      response.whatsappGroupStatus = 'simulated-success';
    } else {
      const whatsappGroupId = process.env.WHATSAPP_GROUP_ID;
      if (!whatsappGroupId) {
        console.warn('[WhatsApp] WHATSAPP_GROUP_ID not set — skipping group post');
        response.whatsappGroupStatus = 'skipped';
      } else {
        const { status } = getWhatsAppStatus();
        if (status !== 'ready') {
          console.warn(`[WhatsApp] Client not ready (status: ${status}) — skipping group post`);
          response.whatsappGroupStatus = 'skipped';
        } else {
          try {
            const client = getWhatsAppClient();
            await client.sendMessage(whatsappGroupId, whatsappMessage);
            response.whatsappGroupStatus = 'sent';
          } catch (whatsappError) {
            console.error('[WhatsApp] Group post error:', whatsappError);
            response.whatsappGroupStatus = 'failed';
          }
        }
      }
    }

    // Determine overall success: email must succeed for at least one member
    const anyEmailSent = response.results!.some(
      (r) => r.emailStatus === 'sent' || r.emailStatus === 'simulated-success'
    );
    if (!anyEmailSent) {
      response.success = false;
      response.message = 'All email sends failed';
    } else {
      response.message = `Emails sent to ${response.results!.filter((r) => r.emailStatus === 'sent' || r.emailStatus === 'simulated-success').length}/${members.length} member(s)`;
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
