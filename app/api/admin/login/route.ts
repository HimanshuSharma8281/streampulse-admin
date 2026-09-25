import { NextRequest, NextResponse } from 'next/server';
import { isSetupRequired, verifyAdminPassword, createAdminSession } from '@/lib/auth/serverAuth';

export async function POST(req: NextRequest) {
  if (isSetupRequired()) {
    return NextResponse.json({ error: 'Setup required', setupRequired: true }, { status: 400 });
  }

  try {
    const { password } = await req.json();

    if (!password || !verifyAdminPassword(password)) {
      return NextResponse.json({ error: 'Invalid admin password.' }, { status: 401 });
    }

    const token = createAdminSession();
    const res = NextResponse.json({ ok: true, token });
    res.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400,
      path: '/',
    });

    return res;
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }
}
