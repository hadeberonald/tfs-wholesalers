// app/api/admin/me/route.ts
import { NextResponse } from 'next/server';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function GET() {
  const result = await getAdminBranch();
  
  if ('error' in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json(result);
}