import { NextRequest, NextResponse } from 'next/server';
import { isSetupRequired, validateAdminSession } from '@/lib/auth/serverAuth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value || req.headers.get('x-admin-token');
  const authenticated = validateAdminSession(token);
  const setupRequired = isSetupRequired();

  return NextResponse.json({
    setupRequired,
    authenticated,
  });
}
