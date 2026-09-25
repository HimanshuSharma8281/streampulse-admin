import { NextRequest, NextResponse } from 'next/server';
import { isSetupRequired, setAdminPassword, createAdminSession } from '@/lib/auth/serverAuth';

export async function POST(req: NextRequest) {
  if (!isSetupRequired()) {
    return NextResponse.json({ error: 'Admin account is already configured.' }, { status: 400 });
  }

  try {
    const { password, confirmPassword } = await req.json();

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 });
    }

    const success = setAdminPassword(password);
    if (!success) {
      return NextResponse.json({ error: 'Failed to save admin password.' }, { status: 500 });
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
