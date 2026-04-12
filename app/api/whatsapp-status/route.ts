// app/api/whatsapp-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppStatus, getWhatsAppClient } from '@/lib/whatsapp-session';
import { requireAuth } from '@/lib/require-auth';

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  // Ensure the client is initialized (calling getWhatsAppClient() creates it if not yet created)
  getWhatsAppClient();
  const { status, qr } = getWhatsAppStatus();

  return NextResponse.json({
    status,
    qr: qr ?? null,
    instructions:
      status === 'qr_pending'
        ? 'Open WhatsApp on your phone → Linked Devices → Link a Device → Scan the QR code at /api/whatsapp-status'
        : null,
  });
}
