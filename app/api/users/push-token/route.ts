import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { verifyMobileToken } from '@/lib/verify-mobile-token';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: NextRequest) {
  try {
    const { pushToken, platform, userId } = await request.json();

    if (!pushToken) {
      return NextResponse.json(
        { success: false, error: 'pushToken is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Try to resolve userId from Bearer token (picker/customer logged in)
    // or fall back to userId from body (customer passed it explicitly)
    // or store as guest token
    const authHeader = request.headers.get('authorization') || '';
    let resolvedUserId: string | null = userId || null;

    if (authHeader.startsWith('Bearer ')) {
      const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
      if (mobileUser) resolvedUserId = mobileUser.id;
    }

    // Upsert by pushToken so the same device doesn't get duplicate entries
    await db.collection('push_tokens').updateOne(
      { pushToken },
      {
        $set: {
          pushToken,
          platform:  platform || 'unknown',
          userId:    resolvedUserId, // null for guests
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Failed to save push token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save push token' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
    if (!mobileUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    await db.collection('push_tokens').deleteOne({ userId: mobileUser.id });

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Failed to remove push token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove push token' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}