// app/api/auth/password-reset/request/route.ts
// Generates a 6-digit code, stores it hashed in DB, and emails it to the user.

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// How long the code is valid (15 minutes)
const CODE_TTL_MS = 15 * 60 * 1000;

function generateCode(): string {
  // Cryptographically random 6-digit code
  return String(crypto.randomInt(100000, 999999));
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function sendResetEmail(email: string, code: string, name: string): Promise<void> {
  // ── Swap this block for your actual email provider ──────────────────────
  // Examples: Resend, Nodemailer, SendGrid, AWS SES, etc.
  //
  // Using Resend (recommended — already used in many Next.js projects):
  //
  //   const { Resend } = await import('resend');
  //   const resend = new Resend(process.env.RESEND_API_KEY);
  //   await resend.emails.send({
  //     from:    'noreply@yourdomain.com',
  //     to:      email,
  //     subject: 'Your password reset code',
  //     html:    `...`,
  //   });
  //
  // Using Nodemailer with SMTP (e.g. Gmail, Mailgun SMTP):
  //
  //   const nodemailer = await import('nodemailer');
  //   const transporter = nodemailer.default.createTransport({
  //     host: process.env.SMTP_HOST,
  //     port: parseInt(process.env.SMTP_PORT || '587'),
  //     auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  //   });
  //   await transporter.sendMail({ from: process.env.SMTP_FROM, to: email, subject: '...', html: '...' });
  //
  // ────────────────────────────────────────────────────────────────────────

  // Replace below with your actual send call. This stub logs to console so
  // you can test the full flow locally without an email provider set up yet.
  if (process.env.NODE_ENV === 'development') {
    console.log(`[PasswordReset] Code for ${email}: ${code}`);
    return;
  }

  // ── Production: plug in your provider here ───────────────────────────────
  // Example with Resend (install: npm i resend):
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY!);

  await resend.emails.send({
    from:    process.env.EMAIL_FROM || 'noreply@yourdomain.com',
    to:      email,
    subject: 'Your password reset code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#FF6B35;margin-bottom:8px">Password Reset</h2>
        <p style="color:#374151">Hi ${name},</p>
        <p style="color:#374151">Use the code below to reset your password. It expires in 15 minutes.</p>
        <div style="background:#f3f4f6;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
          <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#1f2937">${code}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    // Look up the user — don't reveal whether the email exists (security)
    const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // Return success anyway to prevent email enumeration
      return NextResponse.json({ success: true });
    }

    // Rate-limit: block if a valid code was sent less than 60 seconds ago
    const existing = await db.collection('passwordResetCodes').findOne({
      userId:    user._id,
      expiresAt: { $gt: new Date() },
      createdAt: { $gt: new Date(Date.now() - 60_000) },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A code was already sent recently. Please wait 60 seconds before requesting another.' },
        { status: 429 }
      );
    }

    // Invalidate any previous codes for this user
    await db.collection('passwordResetCodes').updateMany(
      { userId: user._id },
      { $set: { used: true } }
    );

    const code    = generateCode();
    const hashed  = hashCode(code);

    await db.collection('passwordResetCodes').insertOne({
      userId:    user._id,
      email:     user.email,
      codeHash:  hashed,
      used:      false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });

    await sendResetEmail(user.email, code, user.name || 'there');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PasswordReset/request]', error);
    return NextResponse.json({ error: 'Failed to send reset code' }, { status: 500 });
  }
}