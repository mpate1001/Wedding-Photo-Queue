// app/api/guests/add-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { whenReady } from '@/lib/whatsapp-session';
import { diffGuestsAgainstParticipants, type SheetGuest, type GroupParticipant } from '@/lib/guest-diff';
import { readBatchState, recordBatchRun, ranWithinCooldown, type GroupType } from '@/lib/batch-state';
import { normalizePhone } from '@/lib/phone-match';
import { fetchGroupsFromSheet } from '@/lib/sheets';

interface AddBatchBody {
  groupType: GroupType;
  batchSize?: number;
}

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;
const DELAY_BETWEEN_ADDS_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllGuests(): Promise<SheetGuest[]> {
  const groups = await fetchGroupsFromSheet();
  return groups.flatMap((g) => g.members);
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: AddBatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { groupType } = body;
  const batchSize = Math.min(body.batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);

  if (!['announcements', 'photo'].includes(groupType)) {
    return NextResponse.json({ success: false, message: 'Invalid groupType' }, { status: 400 });
  }

  // Cooldown check: skip if already ran within last 12 hours
  const state = await readBatchState();
  if (ranWithinCooldown(state[groupType])) {
    return NextResponse.json({
      skipped: true,
      reason: 'already ran within 12-hour cooldown',
      lastRun: state[groupType].lastRunAt,
      added: 0,
    }, { status: 429 });
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

  try {
    const client = await whenReady();
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) throw new Error('Not a group chat');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupChat = chat as any;

    const allGuests = await fetchAllGuests();
    const participants: GroupParticipant[] = (groupChat.participants ?? []).map(
      (p: { id: { user: string } }) => ({ phone: `+${p.id.user}` })
    );
    const diff = diffGuestsAgainstParticipants(allGuests, participants);
    const missing = diff.filter((d) => d.status === 'missing').slice(0, batchSize);

    let added = 0;
    let failed = 0;

    for (const { guest } of missing) {
      const normalized = normalizePhone(guest.phone);
      if (!normalized) {
        failed += 1;
        continue;
      }
      const raw = guest.phone.replace(/\D/g, '');
      const contactId = `${raw}@c.us`;

      try {
        await groupChat.addParticipants([contactId]);
        console.log(`[add-batch] added ${guest.name} (${contactId}) to ${groupType}`);
        added += 1;
      } catch (err) {
        console.error(`[add-batch] failed to add ${guest.name}:`, err);
        failed += 1;
      }

      // Pace additions to avoid WhatsApp rate limits
      await sleep(DELAY_BETWEEN_ADDS_MS);
    }

    const remaining = diff.filter((d) => d.status === 'missing').length - added;
    const newState = await recordBatchRun(groupType, added, failed);

    return NextResponse.json({
      added,
      failed,
      remaining: Math.max(0, remaining),
      lastRun: newState[groupType].lastRunAt,
    });
  } catch (error) {
    console.error('[/api/guests/add-batch] error:', error);
    const message = error instanceof Error ? error.message : 'Batch add failed';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
