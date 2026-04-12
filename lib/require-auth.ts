import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates the Authorization: Bearer <token> header against the dashboard password.
 * Token format: Base64("password:timestamp") — same as generated in /api/auth/login.
 *
 * Returns null if the request is authenticated (caller should proceed).
 * Returns a 401 NextResponse if authentication fails (caller should return it).
 */
export function requireAuth(request: NextRequest): NextResponse | null {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = Buffer.from(token, 'base64').toString();
    const [password] = decoded.split(':');
    const correctPassword = process.env.DASHBOARD_PASSWORD;

    if (password !== correctPassword) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    return null;
  } catch {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }
}
