import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY ?? '';

// POST /api/wholesale/payments/initialize
// Initializes a Paystack payment for a wholesale purchase order
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };

    const body = await request.json();
    const { orderId } = body;
    if (!orderId) return NextResponse.json({ error: 'Order ID required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const order = await db
      .collection('wholesale_purchase_orders')
      .findOne({ _id: new ObjectId(orderId) });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.paymentStatus === 'paid')
      return NextResponse.json({ error: 'Order is already paid' }, { status: 400 });

    const amountInKobo = Math.round(order.total * 100);

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: decoded.email,
        amount: amountInKobo,
        currency: 'ZAR',
        reference: `WS-${order.poNumber}-${Date.now()}`,
        metadata: {
          orderId: orderId,
          poNumber: order.poNumber,
          customerId: order.customerId.toString(),
          type: 'wholesale_order',
        },
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/wholesale/payments/verify`,
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      console.error('Paystack initialization failed:', paystackData);
      return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
    }

    // Store the reference on the order
    await db.collection('wholesale_purchase_orders').updateOne(
      { _id: new ObjectId(orderId) },
      {
        $set: {
          paystackReference: paystackData.data.reference,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      authorizationUrl: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
    });
  } catch (error) {
    console.error('❌ Paystack initialize error:', error);
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
  }
}