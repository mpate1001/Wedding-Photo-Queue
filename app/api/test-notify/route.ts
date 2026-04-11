import { NextResponse } from 'next/server';

export async function GET() {
  if (process.env.TEST_MODE !== 'true') {
    return NextResponse.json(
      { error: 'Diagnostic route disabled. Set TEST_MODE=true to enable.' },
      { status: 403 }
    );
  }

  const baseUrl = 'http://localhost:3000';

  try {
    const res = await fetch(`${baseUrl}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
