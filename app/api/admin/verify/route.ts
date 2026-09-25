import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession } from '@/lib/auth/serverAuth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value || req.headers.get('x-admin-token');
  const valid = validateAdminSession(token);

  if (!valid) {
    return NextResponse.json({ authenticated: false, error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true });
}
