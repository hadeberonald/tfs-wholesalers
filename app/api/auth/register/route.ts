import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { hashPassword } from '@/lib/utils';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, role = 'customer' } = await request.json();

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Check if user exists
    const existingUser = await db.collection('users').findOne({ 
      email: email.toLowerCase() 
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const result = await db.collection('users').insertOne({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: result.insertedId.toString(),
        email: email.toLowerCase(),
        role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set cookie
    cookies().set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Return user info
    return NextResponse.json({
      user: {
        id: result.insertedId.toString(),
        email: email.toLowerCase(),
        name,
        role,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}