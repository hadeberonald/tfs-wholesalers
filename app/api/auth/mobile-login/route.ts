// app/api/auth/mobile-login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// SECURITY: Consolidated to single env var. No fallback to empty string.
const JWT_SECRET  = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) throw new Error('[SECURITY] NEXTAUTH_SECRET environment variable is not set. Refusing to start.');

const JWT_EXPIRES   = '30d';
const ALLOWED_ROLES = ['picker', 'delivery', 'admin'];

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({
        error: 'Access denied. This app is for pickers and delivery staff only.',
      }, { status: 403 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign(
      {
        id:             user._id.toString(),
        email:          user.email,
        role:           user.role,
        activeBranchId: user.activeBranchId?.toString() || null,
      },
      JWT_SECRET!,
      { expiresIn: JWT_EXPIRES }
    );

    return NextResponse.json({
      token,
      user: {
        id:    user._id.toString(),
        name:  user.name,
        email: user.email,
        role:  user.role,
        activeBranchId: user.activeBranchId?.toString() || null,
      },
    });
  } catch (error) {
    console.error('Mobile login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
