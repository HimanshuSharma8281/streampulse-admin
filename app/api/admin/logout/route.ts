import { NextRequest, NextResponse } from 'next/server';
import { destroyAdminSession } from '@/lib/auth/serverAuth';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value || req.headers.get('x-admin-token');
  if (token) {
    destroyAdminSession(token);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  return res;
}
