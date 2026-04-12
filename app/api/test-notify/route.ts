import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  if (process.env.TEST_MODE !== 'true') {
    return NextResponse.json(
      { error: 'Diagnostic route disabled. Set TEST_MODE=true to enable.' },
      { status: 403 }
    );
  }

  // Use dynamic origin instead of hardcoded localhost (WR-03 fix)
  const baseUrl = new URL(request.url).origin;

  // Derive a valid token to authenticate the internal /api/notify call
  const internalToken = Buffer.from(
    `${process.env.DASHBOARD_PASSWORD}:${Date.now()}`
  ).toString('base64');

  try {
    const res = await fetch(`${baseUrl}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalToken}`,
      },
      body: JSON.stringify({
        groupNumber: 1,
        members: [
          {
            name: 'Mahek',
            phone: '+12566584291',
            email: 'saum.mahek26@gmail.com',
          },
        ],
      }),
    });

    const data = await res.json();
    return NextResponse.json({
      testResult: data,
      httpStatus: res.status,
      instructions: 'Check your email and WhatsApp for the notification. Check the WhatsApp group "Wedding Group Photos" for the group post.',
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
