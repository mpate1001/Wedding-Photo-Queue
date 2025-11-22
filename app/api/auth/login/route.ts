import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    // Check password against environment variable
    const correctPassword = process.env.DASHBOARD_PASSWORD;

    if (!correctPassword) {
      return NextResponse.json(
        { success: false, message: 'Authentication not configured' },
        { status: 500 }
      );
    }

    if (password === correctPassword) {
      // Generate a simple token (in production, use JWT or similar)
      const token = Buffer.from(`${correctPassword}:${Date.now()}`).toString('base64');

      return NextResponse.json({
        success: true,
        token,
      });
    } else {
      return NextResponse.json(
        { success: false, message: 'Incorrect password' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Login failed' },
      { status: 500 }
    );
  }
}
