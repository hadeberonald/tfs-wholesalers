/**
 * app/api/auth/me/route.ts  (UPDATED)
 *
 * Returns the current user's profile including resolved permissions.
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
      permissions = resolvedPermissions ?? [];
      adminRoleName = roleDoc?.name ?? null;
    }

    // Super-admins signal universal access with a sentinel
    if (user.role === 'super-admin') {
      permissions = ['*'];
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        permissions,
        adminRoleId: user.adminRoleId?.toString() ?? null,
        adminRoleName,
      },
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}
