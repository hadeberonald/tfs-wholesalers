/**
 * app/api/auth/me/route.ts  — Updated to match consolidated auth
 *
 * Mirrors the same branchId/activeBranchId resolution as getAdminBranch
 * so the client-side User object stays in sync with server-side checks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserPermissions, getRoleById } from '@/lib/admin-roles-db';

const JWT_SECRET = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) throw new Error('[SECURITY] NEXTAUTH_SECRET is not set.');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET!);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(decoded.userId) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Resolve permissions for admin users
    let permissions: string[] = [];
    let adminRoleName: string | null = null;

    if (user.role === 'admin' && user.adminRoleId) {
      const [resolvedPermissions, roleDoc] = await Promise.all([
        getUserPermissions(user.adminRoleId),
        getRoleById(user.adminRoleId),
      ]);

      // Expand write → read (same logic as getAdminBranch)
      const permSet = new Set<string>(resolvedPermissions ?? []);
(resolvedPermissions ?? []).forEach((perm) => {
  if (perm.endsWith(':write')) permSet.add(perm.replace(':write', ':read'));
});
permissions = Array.from(permSet);
      adminRoleName = roleDoc?.name ?? null;
    }

    if (user.role === 'super-admin') {
      permissions = ['*'];
    }

    // Support both field names so the client always gets a branchId
    const branchId =
      user.activeBranchId?.toString() ?? user.branchId?.toString() ?? null;

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        permissions,
        adminRoleId: user.adminRoleId?.toString() ?? null,
        adminRoleName,
        branchId,
      },
    });
  } catch (error) {
    console.error('[/api/auth/me] Error:', error);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}