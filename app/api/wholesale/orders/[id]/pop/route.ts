import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production';

// POST /api/wholesale/orders/[id]/pop
// Customer uploads a proof of payment for their order
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    jwt.verify(token, JWT_SECRET); // just validate — we trust the order belongs to them

    const body = await request.json();
    const { popUrl } = body;

    if (!popUrl) return NextResponse.json({ error: 'POP URL required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const result = await db.collection('wholesale_purchase_orders').updateOne(
      { _id: new ObjectId(params.id) },
      {
        $set: {
          popUrl,
          popStatus: 'pending_review',
          paymentStatus: 'pending_pop_review',
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    console.log('✅ POP uploaded for order:', params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Failed to upload POP:', error);
    return NextResponse.json({ error: 'Failed to upload proof of payment' }, { status: 500 });
  }
}