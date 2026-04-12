// app/api/guests/invite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAuth } from '@/lib/require-auth';
import { whenReady } from '@/lib/whatsapp-session';
import { diffGuestsAgainstParticipants, type SheetGuest, type GroupParticipant } from '@/lib/guest-diff';
import { normalizePhone } from '@/lib/phone-match';

type GroupType = 'announcements' | 'photo';
type Channel = 'email' | 'whatsapp' | 'both';

interface InviteBody {
  groupType: GroupType;
  channel: Channel;
}

async function fetchAllGuests(request: NextRequest): Promise<SheetGuest[]> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/groups`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch guests');
  const data = await res.json() as { groups: Array<{ members: SheetGuest[] }> };
  return data.groups.flatMap((g) => g.members);
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: InviteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { groupType, channel } = body;
  if (!['announcements', 'photo'].includes(groupType)) {
    return NextResponse.json({ success: false, message: 'Invalid groupType' }, { status: 400 });
  }
  if (!['email', 'whatsapp', 'both'].includes(channel)) {
    return NextResponse.json({ success: false, message: 'Invalid channel' }, { status: 400 });
  }

  const groupId = groupType === 'announcements'
    ? process.env.WHATSAPP_ANNOUNCEMENTS_GROUP_ID
    : process.env.WHATSAPP_GROUP_ID;

  if (!groupId) {
    return NextResponse.json(
      { success: false, message: `${groupType} group ID not set in env` },
      { status: 500 }
    );
  }

  try {
    // 1. Get invite link
    const client = await whenReady();
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) throw new Error('Not a group chat');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupChat = chat as any;
    const inviteCode: string = await groupChat.getInviteCode();
    const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

    // 2. Find missing guests
    const allGuests = await fetchAllGuests(request);
    const participants: GroupParticipant[] = (groupChat.participants ?? []).map(
      (p: { id: { user: string } }) => ({ phone: `+${p.id.user}` })
    );
    const diff = diffGuestsAgainstParticipants(allGuests, participants);
    const missing = diff.filter((d) => d.status === 'missing');
    const noWhatsapp = diff.filter((d) => d.status === 'no-whatsapp');

    const groupLabel = groupType === 'announcements'
      ? 'our wedding announcements group'
      : 'our wedding photo coordination group';
    const emailSubject = `You're invited to join ${groupLabel}`;
    const emailText = (name: string) =>
      `Hi ${name}!\n\nSaumya & Mahek are inviting you to join ${groupLabel} on WhatsApp.\n\nTap this link to join: ${inviteLink}\n\nSee you at the wedding!\n- Saumya & Mahek`;
    const whatsappMsg = (name: string) =>
      `Hi ${name}! Saumya & Mahek here. Please join ${groupLabel}: ${inviteLink}`;

    let sent = 0;
    let failed = 0;
    const skipped = noWhatsapp.length;

    const sendEmail = (channel === 'email' || channel === 'both') && missing.length > 0;
    const sendWhatsapp = (channel === 'whatsapp' || channel === 'both') && missing.length > 0;

    // 3. Email path
    let transporter: nodemailer.Transporter | null = null;
    if (sendEmail) {
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
    }

    for (const { guest } of missing) {
      let emailOk = !sendEmail;
      let waOk = !sendWhatsapp;

      if (sendEmail && transporter && guest.email) {
        try {
          await transporter.sendMail({
            from: `"Saumya & Mahek Wedding" <${process.env.GMAIL_USER}>`,
            to: guest.email,
            subject: emailSubject,
            text: emailText(guest.name),
          });
          emailOk = true;
        } catch (err) {
          console.error(`[invite] email to ${guest.email} failed:`, err);
        }
      }

      if (sendWhatsapp) {
        const normalized = normalizePhone(guest.phone);
        if (normalized) {
          // Full country-code-bearing phone (strip + from raw, reattach for canonical chatId)
          const raw = guest.phone.replace(/\D/g, '');
          const chatId = `${raw}@c.us`;
          try {
            await client.sendMessage(chatId, whatsappMsg(guest.name));
            waOk = true;
          } catch (err) {
            console.error(`[invite] WA DM to ${guest.name} failed:`, err);
          }
        }
      }

      if (emailOk && waOk) sent += 1;
      else failed += 1;
    }

    // Also email the no-whatsapp guests if email channel is on (they still deserve the link)
    if (sendEmail && transporter) {
      for (const { guest } of noWhatsapp) {
        if (!guest.email) continue;
        try {
          await transporter.sendMail({
            from: `"Saumya & Mahek Wedding" <${process.env.GMAIL_USER}>`,
            to: guest.email,
            subject: emailSubject,
            text: emailText(guest.name),
          });
        } catch (err) {
          console.error(`[invite] email (no-whatsapp) to ${guest.email} failed:`, err);
        }
      }
    }

    return NextResponse.json({ sent, failed, skipped, inviteLink });
  } catch (error) {
    console.error('[/api/guests/invite] error:', error);
    const message = error instanceof Error ? error.message : 'Invite send failed';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
