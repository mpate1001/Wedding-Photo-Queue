import { NextResponse } from 'next/server';
import { getWhatsAppClient, getWhatsAppStatus } from '@/lib/whatsapp-session';

export async function GET() {
  const { status } = getWhatsAppStatus();

  if (status !== 'ready') {
    return NextResponse.json({
      error: `WhatsApp client is not ready (status: ${status}). Scan QR first at /api/whatsapp-status`,
    }, { status: 503 });
  }

  try {
    const client = getWhatsAppClient();
    const chats = await client.getChats();
    const groups = chats
      .filter((c) => c.isGroup)
      .map((c) => ({
        name: c.name,
        id: c.id._serialized,
        participants: (c as unknown as { groupMetadata?: { participants?: unknown[] } }).groupMetadata?.participants?.length ?? 'unknown',
      }));

    return NextResponse.json({
      groups,
      instructions: 'Copy the "id" of your wedding photo queue group and add it as WHATSAPP_GROUP_ID in .env.local',
    });
  } catch (err) {
    console.error('[WhatsApp] Error fetching groups:', err);
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
}
