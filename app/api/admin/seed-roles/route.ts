import { NextRequest, NextResponse } from 'next/server';
import { getAdminBranch } from '@/lib/get-admin-branch';
import { seedDefaultRoles } from '@/lib/admin-roles-db';

export async function POST(request: NextRequest) {
  const adminInfo = await getAdminBranch();
  if ('error' in adminInfo) return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
  if (!adminInfo.isSuperAdmin) return NextResponse.json({ error: 'Only super-admins can seed roles' }, { status: 403 });
  try {
    await seedDefaultRoles();
    return NextResponse.json({ success: true, message: 'Default roles seeded successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to seed roles' }, { status: 500 });
  }
}
