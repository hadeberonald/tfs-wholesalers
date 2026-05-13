/**
 * app/api/admin/seed-roles/route.ts
 *
 * One-time seed endpoint to create the default system roles.
 * Call POST /api/admin/seed-roles once after deploying this update.
 * Only super-admins can call it.
 *
 * It is IDEMPOTENT — safe to call multiple times. Roles that already
 * exist are left untouched.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminBranch } from '@/lib/get-admin-branch';
import { seedDefaultRoles } from '@/lib/admin-roles-db';

export async function POST(request: NextRequest) {
  const adminInfo = await getAdminBranch();

  if ('error' in adminInfo) {
    return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
  }

  if (!adminInfo.isSuperAdmin) {
    return NextResponse.json({ error: 'Only super-admins can seed roles' }, { status: 403 });
  }

  try {
    await seedDefaultRoles();
    return NextResponse.json({ success: true, message: 'Default roles seeded successfully' });
  } catch (error) {
    console.error('Failed to seed roles:', error);
    return NextResponse.json({ error: 'Failed to seed roles' }, { status: 500 });
  }
}
