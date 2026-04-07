// app/api/notify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { getWhatsAppClient, getWhatsAppStatus } from '@/lib/whatsapp-session';
import type { NotificationRequest, NotificationResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: NotificationRequest = await request.json();
    const { groupNumber, members } = body;

    // Dedup guard: reject if last notification was sent within cooldown window
    const COOLDOWN_MS = 60_000;
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

    // Initialize Twilio client
    let twilioClient;
    if (!isTestMode && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }

    const response: NotificationResponse = {
      success: true,
      message: isTestMode
        ? 'TEST MODE: Notifications simulated (no real sends)'
        : 'Notifications sent successfully',
      whatsappGroupStatus: 'pending',
      results: [],
    };

    const messageText = (name: string) =>
      `Hi ${name}! It's time for your group photo with Mahek & Saumya! Please head to the Mandap now.`;

    // ── Per-member: Email (Gmail SMTP) + SMS (Twilio) ────────────────────────
    if (isTestMode) {
      for (const member of members) {
        console.log(`[TEST] Would email ${member.email} — Group ${groupNumber}: ${member.name}`);
        console.log(`[TEST] Would SMS ${member.phone} — Group ${groupNumber}: ${member.name}`);
        response.results!.push({
          member: member.name,
          emailStatus: 'simulated-success',
          whatsappStatus: 'simulated-success',
        });
      }
    } else {
      // Set up Gmail transporter
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      for (const member of members) {
        let emailStatus = 'failed';
        let smsStatus = 'skipped';

        // Send email
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
          emailStatus = 'sent';
        } catch (emailError) {
          console.error(`[Email] Error for ${member.name}:`, emailError);
        }

        // Send SMS via Twilio
        if (member.phone && twilioClient) {
          try {
            const smsMessage = await twilioClient.messages.create({
              body: messageText(member.name),
              from: process.env.TWILIO_PHONE_NUMBER,
              to: member.phone,
            });
            smsStatus = smsMessage.status;
          } catch (smsError) {
            console.error(`[SMS] Error for ${member.name}:`, smsError);
            smsStatus = 'failed';
          }
        }

        response.results!.push({
          member: member.name,
          emailStatus,
          whatsappStatus: smsStatus, // reusing whatsappStatus field for SMS status
        });
      }
    }

    // ── WhatsApp Group Post (whatsapp-web.js) — best-effort ──────────────────
    const groupNames = members.map((m) => m.name).join(', ');
    const whatsappGroupMessage = `Group ${groupNumber} — ${groupNames}, you're up! Please head to the Mandap now for your group photo. Thank you!`;

    if (isTestMode) {
      console.log(`[TEST] Would post to WhatsApp group: "${whatsappGroupMessage}"`);
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
            await client.sendMessage(whatsappGroupId, whatsappGroupMessage);
            response.whatsappGroupStatus = 'sent';
          } catch (whatsappError) {
            console.error('[WhatsApp] Group post error:', whatsappError);
            response.whatsappGroupStatus = 'failed';
          }
        }
      }
    }

    // Determine overall success: at least one channel must succeed per member
    const anySuccess = response.results!.some(
      (r) => r.emailStatus === 'sent' || r.emailStatus === 'simulated-success' ||
             r.whatsappStatus === 'sent' || r.whatsappStatus === 'simulated-success' ||
             r.whatsappStatus === 'queued'
    );
    if (!anySuccess) {
      response.success = false;
      response.message = 'All notifications failed';
    } else {
      const emailCount = response.results!.filter((r) => r.emailStatus === 'sent' || r.emailStatus === 'simulated-success').length;
      const smsCount = response.results!.filter((r) => ['sent', 'queued', 'simulated-success'].includes(r.whatsappStatus)).length;
      response.message = `Sent to ${members.length} member(s): ${emailCount} emails, ${smsCount} SMS`;
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
