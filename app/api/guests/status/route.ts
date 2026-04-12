// app/api/guests/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { whenReady } from '@/lib/whatsapp-session';
import { diffGuestsAgainstParticipants, type SheetGuest, type GroupParticipant } from '@/lib/guest-diff';
import { readBatchState } from '@/lib/batch-state';
import { fetchGroupsFromSheet } from '@/lib/sheets';

// Simple in-memory cache for WhatsApp participant list — 60s TTL
const participantCache = new Map<string, { at: number; participants: GroupParticipant[] }>();
const CACHE_TTL_MS = 60_000;

interface SheetGuestWithGroupNumber extends SheetGuest {
  groupNumber: number;
}

async function fetchSheetGuests(): Promise<SheetGuestWithGroupNumber[]> {
  // Call the shared lib directly — avoids internal HTTP round-trip
  // (which breaks on VPS due to nginx SSL termination mismatches)
  const groups = await fetchGroupsFromSheet();
  const guests: SheetGuestWithGroupNumber[] = [];
  for (const group of groups) {
    for (const member of group.members) {
      guests.push({ ...member, groupNumber: group.groupNumber });
    }
  }
  return guests;
}

async function fetchGroupParticipants(groupId: string): Promise<GroupParticipant[]> {
  const cached = participantCache.get(groupId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.participants;
  }
  const client = await whenReady();
  const chat = await client.getChatById(groupId);
  if (!chat.isGroup) throw new Error(`Chat ${groupId} is not a group`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupChat = chat as any;
  const participants: GroupParticipant[] = (groupChat.participants ?? []).map((p: { id: { user: string } }) => ({
    phone: `+${p.id.user}`,
  }));
  participantCache.set(groupId, { at: Date.now(), participants });
  return participants;
}

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const announcementsGroupId = process.env.WHATSAPP_ANNOUNCEMENTS_GROUP_ID;
  const photoGroupId = process.env.WHATSAPP_GROUP_ID;

  if (!announcementsGroupId && !photoGroupId) {
    return NextResponse.json(
      { success: false, message: 'Neither WHATSAPP_ANNOUNCEMENTS_GROUP_ID nor WHATSAPP_GROUP_ID is set' },
      { status: 500 }
    );
  }

  try {
    const guests = await fetchSheetGuests();

    // Fetch participants from both groups (skip if env var not set)
    const [announcementsParticipants, photoParticipants] = await Promise.all([
      announcementsGroupId ? fetchGroupParticipants(announcementsGroupId).catch(() => []) : [],
      photoGroupId ? fetchGroupParticipants(photoGroupId).catch(() => []) : [],
    ]);

    const announcementsDiff = announcementsGroupId
      ? diffGuestsAgainstParticipants(guests, announcementsParticipants)
      : guests.map((g) => ({ guest: g, status: 'missing' as const }));

    const photoDiff = photoGroupId
      ? diffGuestsAgainstParticipants(guests, photoParticipants)
      : guests.map((g) => ({ guest: g, status: 'missing' as const }));

    // Build unified guest rows — key by normalized phone for lookup
    const byPhone = new Map<string, { guest: SheetGuest; announcementsStatus: string; photoStatus: string }>();
    for (const { guest, status } of announcementsDiff) {
      byPhone.set(`${guest.phone}|${guest.name}`, {
        guest,
        announcementsStatus: status,
        photoStatus: 'missing',
      });
    }
    for (const { guest, status } of photoDiff) {
      const key = `${guest.phone}|${guest.name}`;
      const existing = byPhone.get(key);
      if (existing) {
        existing.photoStatus = status;
      } else {
        byPhone.set(key, { guest, announcementsStatus: 'missing', photoStatus: status });
      }
    }

    const rows = Array.from(byPhone.values()).map((r) => ({
      name: r.guest.name,
      phone: r.guest.phone,
      email: r.guest.email,
      announcementsStatus: r.announcementsStatus,
      photoStatus: r.photoStatus,
    }));

    const countBy = (statusKey: 'announcementsStatus' | 'photoStatus') => ({
      total: rows.length,
      joined: rows.filter((r) => r[statusKey] === 'joined').length,
      missing: rows.filter((r) => r[statusKey] === 'missing').length,
      noWhatsapp: rows.filter((r) => r[statusKey] === 'no-whatsapp').length,
    });

    const batchState = await readBatchState();

    return NextResponse.json({
      guests: rows,
      stats: {
        announcements: countBy('announcementsStatus'),
        photo: countBy('photoStatus'),
      },
      lastBatchRun: {
        announcements: batchState.announcements.lastRunAt,
        photo: batchState.photo.lastRunAt,
      },
      lastBatchSummary: {
        announcements: batchState.announcements,
        photo: batchState.photo,
      },
    });
  } catch (error) {
    console.error('[/api/guests/status] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to compute guest status';
    const status = message.includes('WhatsApp') || message.includes('PUPPETEER') ? 503 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
