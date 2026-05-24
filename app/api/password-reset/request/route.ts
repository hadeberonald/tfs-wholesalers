// app/api/auth/password-reset/request/route.ts
// Generates a 6-digit code, stores it hashed in DB, and emails it via the
// existing Nodemailer transport in lib/sendPushNotification.ts

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { sendTransactionalEmail } from '@/lib/sendPushNotification';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    // Don't reveal whether the email exists — always return success
    const user = await db.collection('users').findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Rate-limit: block if a valid code was already sent within the last 60s
    const recentCode = await db.collection('passwordResetCodes').findOne({
      userId:    user._id,
      used:      false,
      expiresAt: { $gt: new Date() },
      createdAt: { $gt: new Date(Date.now() - 60_000) },
    });

    if (recentCode) {
      return NextResponse.json(
        { error: 'A code was already sent recently. Please wait 60 seconds before requesting another.' },
        { status: 429 }
      );
    }

    // Invalidate any previous unused codes for this user
    await db.collection('passwordResetCodes').updateMany(
      { userId: user._id, used: false },
      { $set: { used: true } }
    );

    const code   = generateCode();
    const hashed = hashCode(code);

    await db.collection('passwordResetCodes').insertOne({
      userId:    user._id,
      email:     user.email,
      codeHash:  hashed,
      used:      false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });

    // Send via the existing Nodemailer transport
    await sendTransactionalEmail({
      to:      user.email,
      subject: 'Your password reset code — TFS Wholesalers',
      html: `
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:auto;color:#1a1a1a;background:#ffffff">
          <div style="background:#FF6B35;padding:28px 32px">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px">TFS Wholesalers</h1>
          </div>
          <div style="padding:32px">
            <h2 style="margin:0 0 8px;font-size:20px">Password Reset</h2>
            <p style="color:#555;margin:0 0 24px">Hi ${user.name || 'there'}, use the code below to reset your password. It expires in 15 minutes.</p>
            <div style="background:#f3f4f6;border-radius:12px;padding:32px;text-align:center;margin:24px 0">
              <span style="font-size:40px;font-weight:800;letter-spacing:14px;color:#1f2937">${code}</span>
            </div>
            <p style="color:#6b7280;font-size:13px;margin:0">If you didn't request this, you can safely ignore this email. Your password will not be changed.</p>
          </div>
          <div style="background:#f5f5f5;padding:20px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee">
            © ${new Date().getFullYear()} TFS Wholesalers &nbsp;·&nbsp;
            <a href="mailto:support@tfswholesalers.com" style="color:#999">support@tfswholesalers.com</a>
          </div>
        </div>
      `,
      text: `Hi ${user.name || 'there'}, your TFS Wholesalers password reset code is: ${code}\n\nIt expires in 15 minutes. If you didn't request this, ignore this email.`,
    });

    console.log(`[PasswordReset] Code sent to ${user.email}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[PasswordReset/request]', error);
    return NextResponse.json({ error: 'Failed to send reset code' }, { status: 500 });
  }
}