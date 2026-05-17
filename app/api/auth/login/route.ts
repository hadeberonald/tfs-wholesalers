// app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { verifyPassword } from '../../../../lib/utils';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { getUserPermissions, getRoleById } from '@/lib/admin-roles-db';

const JWT_SECRET = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) throw new Error('[SECURITY] NEXTAUTH_SECRET environment variable is not set. Refusing to start.');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const user = await db.collection('users').findOne({ email: email.toLowerCase() });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.active === false) {
      return NextResponse.json({ error: 'Account is inactive' }, { status: 403 });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // ── Resolve permissions (same logic as /api/auth/me) ──────────────────
    let permissions: string[] = [];
    let adminRoleName: string | null = null;

    if (user.role === 'admin' && user.adminRoleId) {
      const [resolvedPermissions, roleDoc] = await Promise.all([
        getUserPermissions(user.adminRoleId),
        getRoleById(user.adminRoleId),
      ]);

      // Expand write → read implicitly
      const permSet = new Set<string>(resolvedPermissions ?? []);
      (resolvedPermissions ?? []).forEach((perm: string) => {
        if (perm.endsWith(':write')) permSet.add(perm.replace(':write', ':read'));
      });
      permissions = Array.from(permSet);
      adminRoleName = roleDoc?.name ?? null;
    }

    if (user.role === 'super-admin') {
      permissions = ['*'];
    }

    // Support both branch field names
    const branchId =
      user.activeBranchId?.toString() ?? user.branchId?.toString() ?? null;

    // ── JWT ───────────────────────────────────────────────────────────────
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      JWT_SECRET!,
      { expiresIn: '30d' }
    );

    const cookieStore = await cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    // ── Return full user shape — identical to /api/auth/me ────────────────
    // auth-context.tsx calls setUser(data.user) directly after login,
    // so this must include permissions and adminRoleName or the nav
    // will render empty until the next checkAuth() cycle.
    return NextResponse.json({
      user: {
        id:            user._id.toString(),
        email:         user.email,
        name:          user.name,
        role:          user.role,
        permissions,
        adminRoleId:   user.adminRoleId?.toString() ?? null,
        adminRoleName,
        branchId,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}