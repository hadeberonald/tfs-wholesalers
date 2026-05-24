/**
 * app/api/auth/change-password/route.ts
 *
 * Allows any authenticated user to change their own password.
 * No special permission required — only a valid session cookie.
 * Verifies the current password before allowing the change.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { hashPassword, verifyPassword } from '@/lib/utils';

const JWT_SECRET = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) throw new Error('[SECURITY] NEXTAUTH_SECRET is not set.');

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // ── Resolve session ───────────────────────────────────────────────────
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET!);
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { currentPassword, password: newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from your current password' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Fetch user including password hash
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(decoded.userId) }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const isMatch = await verifyPassword(currentPassword, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash and save new password
    const hashed = await hashPassword(newPassword);
    await db.collection('users').updateOne(
      { _id: new ObjectId(decoded.userId) },
      { $set: { password: hashed, updatedAt: new Date() } }
    );

    console.log(`[Auth] Password changed for user ${decoded.userId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Auth] change-password failed:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}