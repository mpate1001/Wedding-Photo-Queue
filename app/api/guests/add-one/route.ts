// app/api/guests/add-one/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { whenReady } from '@/lib/whatsapp-session';
import { normalizePhone } from '@/lib/phone-match';
import { resolveLidForAdd } from '@/lib/resolve-lid';
import type { GroupType } from '@/lib/batch-state';

interface AddOneBody {
  groupType: GroupType;
  phone: string;
}

type AddOutcome = 'added' | 'invited' | 'already-in' | 'not-on-whatsapp' | 'failed';

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: AddOneBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { groupType, phone } = body;

  if (!['announcements', 'photo'].includes(groupType)) {
    return NextResponse.json({ success: false, message: 'Invalid groupType' }, { status: 400 });
  }
  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ success: false, message: 'Missing phone' }, { status: 400 });
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return NextResponse.json({ success: false, message: 'Unparseable phone' }, { status: 400 });
  }

  const groupId = groupType === 'announcements'
    ? process.env.WHATSAPP_ANNOUNCEMENTS_GROUP_ID
    : process.env.WHATSAPP_GROUP_ID;

  if (!groupId) {
    return NextResponse.json(
      { success: false, message: `${groupType} group ID not set` },
      { status: 500 }
    );
  }

  const raw = phone.replace(/\D/g, '');
  const contactId = `${raw}@c.us`;

  try {
    const client = await whenReady();
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) throw new Error('Not a group chat');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupChat = chat as any;

    // Resolve LID for addParticipants — see lib/resolve-lid.ts for why
    const resolvedId = await resolveLidForAdd(client, raw);
    if (!resolvedId) {
      console.log(`[add-one] not-on-whatsapp ${contactId}`);
      return NextResponse.json({
        success: false,
        outcome: 'not-on-whatsapp' as AddOutcome,
        message: 'Phone number is not registered on WhatsApp',
      });
    }

    const result = await groupChat.addParticipants([resolvedId]);

    // Library returns a plain string for group-level errors (not admin, empty group).
    if (typeof result === 'string') {
      console.error(`[add-one] group-level error for ${resolvedId}: ${result}`);
      return NextResponse.json(
        { success: false, outcome: 'failed' as AddOutcome, message: result },
        { status: 500 }
      );
    }

    // Result is keyed by the _serialized Wid we passed in (resolvedId).
    const entry = result && typeof result === 'object' ? result[resolvedId] : undefined;
    const code = entry?.code;
    const message = entry?.message;
    const inviteSent = entry?.isInviteV4Sent === true;

    let outcome: AddOutcome;
    if (code === 200) {
      outcome = 'added';
    } else if (inviteSent || code === 403) {
      outcome = 'invited';
    } else if (code === 409) {
      outcome = 'already-in';
    } else if (code === 404) {
      outcome = 'not-on-whatsapp';
    } else {
      outcome = 'failed';
    }

    console.log(
      `[add-one] ${outcome} ${resolvedId} in ${groupType} — code=${code} msg=${message}`
    );

    return NextResponse.json({
      success: outcome === 'added' || outcome === 'invited' || outcome === 'already-in',
      outcome,
      code,
      message,
    });
  } catch (error) {
    console.error('[/api/guests/add-one] error:', error);
    const message = error instanceof Error ? error.message : 'Add failed';
    return NextResponse.json(
      { success: false, outcome: 'failed' as AddOutcome, message },
      { status: 500 }
    );
  }
}
