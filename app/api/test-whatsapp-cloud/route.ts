import { NextResponse } from 'next/server';

export async function GET() {
  if (process.env.TEST_MODE !== 'true') {
    return NextResponse.json(
      { error: 'Diagnostic route disabled. Set TEST_MODE=true to enable.' },
      { status: 403 }
    );
  }

  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_ID;

  if (!token || !phoneNumberId) {
    return NextResponse.json({ error: 'Missing WHATSAPP_CLOUD_TOKEN or WHATSAPP_CLOUD_PHONE_ID' });
  }

  // Test sending to your number
  const testPhone = '12566584291';

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: testPhone,
          type: 'text',
          text: { body: 'Test from Wedding Photo Queue app!' },
        }),
      }
    );

    const data = await res.json();
    return NextResponse.json({
      httpStatus: res.status,
      response: data,
      debug: {
        phoneNumberId,
        tokenPrefix: token.substring(0, 10) + '...',
        targetPhone: testPhone,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
