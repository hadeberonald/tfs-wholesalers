// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { verifyPassword } from '../../../../lib/utils';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    console.log('Login attempt for email:', body.email);
    
    const { email, password } = body;

    if (!email || !password) {
      console.log('Missing email or password');
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Connect to database
    console.log('Connecting to database...');
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Find user
    console.log('Finding user...');
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log('User not found');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    console.log('User found:', user.email, 'Role:', user.role);

    // Verify password
    console.log('Verifying password...');
    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      console.log('Password invalid');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    console.log('Password valid, creating token...');

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user._id.toString(),
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('Token created, setting cookie...');

    // Set cookie for web clients
    const cookieStore = await cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    console.log('Login successful for:', user.email);

    // Return user info AND token (for mobile clients)
    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Login error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({ 
      error: 'Login failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}