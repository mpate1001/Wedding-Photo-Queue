import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    // Decode and verify token
    const decoded = Buffer.from(token, 'base64').toString();
    const [password] = decoded.split(':');

    const correctPassword = process.env.DASHBOARD_PASSWORD;

    if (password === correctPassword) {
      return NextResponse.json({ valid: true });
    } else {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}
