// app/api/auth/password-reset/verify/route.ts
// Validates the 6-digit code and updates the user's password.

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json();

    // ── Input validation ─────────────────────────────────────────────────
    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'Email, code, and new password are required' }, { status: 400 });
    }

    if (typeof code !== 'string' || code.trim().length !== 6) {
      return NextResponse.json({ error: 'Code must be 6 digits' }, { status: 400 });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    // ── Look up user ─────────────────────────────────────────────────────
    const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // ── Find a valid, unused code ────────────────────────────────────────
    const codeHash = hashCode(code.trim());

    const resetRecord = await db.collection('passwordResetCodes').findOne({
      userId:   user._id,
      codeHash,
      used:     false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired code. Please request a new one.' },
        { status: 400 }
      );
    }

    // ── Hash new password and update user ────────────────────────────────
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { password: passwordHash, updatedAt: new Date() } }
    );

    // ── Mark code as used so it can't be replayed ────────────────────────
    await db.collection('passwordResetCodes').updateOne(
      { _id: resetRecord._id },
      { $set: { used: true, usedAt: new Date() } }
    );

    // ── Invalidate all other codes for this user ─────────────────────────
    await db.collection('passwordResetCodes').updateMany(
      { userId: user._id, _id: { $ne: resetRecord._id } },
      { $set: { used: true } }
    );

    console.log(`[PasswordReset] Password updated for user: ${user.email}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PasswordReset/verify]', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}