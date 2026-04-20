import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

// SECURITY: No fallback.
const JWT_SECRET = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) throw new Error('[SECURITY] NEXTAUTH_SECRET environment variable is not set. Refusing to start.');

// Verify session and return userId, or null if unauthenticated.
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  try {
    // Web: cookie-based session
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get('auth-token')?.value;
    if (cookieToken) {
      const decoded = jwt.verify(cookieToken, JWT_SECRET!) as any;
      return decoded.userId || null;
    }
    // Mobile: Bearer token
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(bearerToken, JWT_SECRET!) as any;
      return decoded.userId || decoded.id || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // SECURITY: require authentication
    const authenticatedUserId = await getAuthenticatedUserId(request);
    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // SECURITY: users may only access their own payment methods
    if (userId !== authenticatedUserId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const paymentMethods = await db.collection('payment_methods')
      .find({ userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    console.error('Failed to fetch payment methods:', error);
    return NextResponse.json({ error: 'Failed to fetch payment methods' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: require authentication
    const authenticatedUserId = await getAuthenticatedUserId(request);
    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, authorizationCode, cardType, expiryMonth, expiryYear, bin, last4, bank } = body;

    if (!userId || !authorizationCode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // SECURITY: users may only save payment methods to their own account
    if (userId !== authenticatedUserId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Check if this is the first card (make it default)
    const existingCards = await db.collection('payment_methods')
      .countDocuments({ userId });

    const paymentMethod = {
      userId,
      authorizationCode,
      cardNumber: `**** **** **** ${last4}`,
      cardType,
      expiryDate: `${expiryMonth}/${expiryYear}`,
      bin,
      last4,
      bank,
      isDefault: existingCards === 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('payment_methods').insertOne(paymentMethod);

    return NextResponse.json({
      success: true,
      paymentMethodId: result.insertedId.toString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to save payment method:', error);
    return NextResponse.json({ error: 'Failed to save payment method' }, { status: 500 });
  }
}
