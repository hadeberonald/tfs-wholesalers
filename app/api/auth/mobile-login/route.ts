import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { verifyPassword } from '@/lib/utils';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const user = await db.collection('users').findOne({ 
      email: email.toLowerCase() 
    });
    
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password);
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!user.active) {
      return NextResponse.json({ error: 'Account is inactive' }, { status: 403 });
    }
    
    const token = jwt.sign(
      { 
        userId: user._id.toString(), 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
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
    console.error('Mobile login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}