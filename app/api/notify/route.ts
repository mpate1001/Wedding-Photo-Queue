import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import sgMail from '@sendgrid/mail';
import type { NotificationRequest, NotificationResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: NotificationRequest = await request.json();
    const { groupNumber, members } = body;

    // Validate required fields
    if (!members || members.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No group members provided' },
        { status: 400 }
      );
    }

    // Check if in test mode
    const isTestMode = process.env.TEST_MODE === 'true';

    // Initialize services (only if not in test mode)
    let twilioClient;
    if (!isTestMode) {
      twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
    }

    const results: NotificationResponse = {
      success: true,
      message: isTestMode
        ? '🧪 TEST MODE: Notifications simulated (no credits used)'
        : 'Notifications sent successfully',
      results: [],
    };

    // Send notifications to each member
    for (const member of members) {
      const memberResult = {
        member: member.name,
        smsStatus: 'pending' as string,
        whatsappStatus: 'pending' as string,
        emailStatus: 'pending' as string,
      };

      const messageText = `Hi ${member.name}! Time for your group photo with Mahek & Saumya! Please head to the Mandap now. 📸`;

      if (isTestMode) {
        // TEST MODE: Simulate notifications without actually sending
        console.log('🧪 TEST MODE - Would send SMS to:', member.phone);
        console.log('🧪 TEST MODE - Would send WhatsApp to:', member.phone);
        console.log('🧪 TEST MODE - Would send Email to:', member.email);
        console.log('🧪 Message:', messageText);

        // Simulate successful delivery
        memberResult.smsStatus = 'simulated-success';
        memberResult.whatsappStatus = 'simulated-success';
        memberResult.emailStatus = 'simulated-success';
      } else {
        // PRODUCTION MODE: Actually send notifications
        // Send SMS
        try {
          const smsMessage = await twilioClient!.messages.create({
            body: messageText,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: member.phone,
          });
          memberResult.smsStatus = smsMessage.status;
        } catch (smsError) {
          console.error(`SMS Error for ${member.name}:`, smsError);
          memberResult.smsStatus = 'failed';
        }

        // Send WhatsApp
        try {
          const whatsappMessage = await twilioClient!.messages.create({
            body: messageText,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: `whatsapp:${member.phone}`,
          });
          memberResult.whatsappStatus = whatsappMessage.status;
        } catch (whatsappError) {
          console.error(`WhatsApp Error for ${member.name}:`, whatsappError);
          memberResult.whatsappStatus = 'failed';
        }

        // Send Email
        try {
          await sgMail.send({
            to: member.email,
            from: process.env.SENDGRID_FROM_EMAIL || '',
            subject: '📸 Time for Your Group Photo!',
            text: `Hi ${member.name}!\n\nIt's time for your group photo with Mahek & Saumya!\n\nPlease head to the Mandap now.\n\nThank you!\n- Wedding Planning Team`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">📸 Time for Your Group Photo!</h2>
                <p style="font-size: 16px;">Hi ${member.name}!</p>
                <p style="font-size: 16px;">It's time for your group photo with <strong>Mahek & Saumya</strong>!</p>
                <p style="font-size: 16px; background-color: #f8f9fa; padding: 15px; border-left: 4px solid #4a90e2;">
                  <strong>Please head to the Mandap now.</strong>
                </p>
                <p style="font-size: 14px; color: #7f8c8d; margin-top: 20px;">Thank you!<br>- Wedding Planning Team</p>
              </div>
            `,
          });
          memberResult.emailStatus = 'sent';
        } catch (emailError) {
          console.error(`Email Error for ${member.name}:`, emailError);
          memberResult.emailStatus = 'failed';
        }
      }

      // Consider success if at least one notification method succeeded
      const anySuccess =
        memberResult.smsStatus !== 'failed' ||
        memberResult.whatsappStatus !== 'failed' ||
        memberResult.emailStatus !== 'sent';

      if (!anySuccess) {
        results.success = false;
      }

      results.results!.push(memberResult);
    }

    if (!results.success) {
      results.message = 'Some notifications failed to send';
    } else {
      results.message = `Notifications sent to ${members.length} member(s)`;
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to send notifications',
      },
      { status: 500 }
    );
  }
}
