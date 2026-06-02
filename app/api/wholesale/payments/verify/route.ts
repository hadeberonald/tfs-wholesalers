import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY ?? '';

// GET /api/wholesale/payments/verify?reference=xxx  — redirect from Paystack callback
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get('reference');
  if (!reference) {
    return NextResponse.redirect(new URL('/wholesale/payment-failed', request.url));
  }

  try {
    const result = await verifyAndSettle(reference);
    if (result.success) {
      const order = result.order;
      // Redirect to orders page for the branch
      const slug = order?.branchSlug ?? '';
      return NextResponse.redirect(
        new URL(`/${slug}/wholesale/orders?payment=success&po=${order?.poNumber}`, request.url)
      );
    } else {
      return NextResponse.redirect(new URL('/wholesale/payment-failed', request.url));
    }
  } catch (error) {
    console.error('Paystack verify GET error:', error);
    return NextResponse.redirect(new URL('/wholesale/payment-failed', request.url));
  }
}

// POST /api/wholesale/payments/verify  — Paystack webhook
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    // Validate webhook signature
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      console.warn('⚠️ Invalid Paystack webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      await verifyAndSettle(reference);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Paystack webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// ── Shared: verify with Paystack API and mark order paid ──────────────────
async function verifyAndSettle(reference: string) {
  const paystackRes = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    }
  );

  const paystackData = await paystackRes.json();

  if (!paystackData.status || paystackData.data.status !== 'success') {
    console.warn('Payment not successful for reference:', reference);
    return { success: false, order: null };
  }

  const client = await (await import('@/lib/mongodb')).default;
  const db = client.db('tfs-wholesalers');

  const order = await db
    .collection('wholesale_purchase_orders')
    .findOne({ paystackReference: reference });

  if (!order) {
    console.warn('No order found for reference:', reference);
    return { success: false, order: null };
  }

  if (order.paymentStatus === 'paid') {
    // Already settled — idempotent
    return { success: true, order };
  }

  await db.collection('wholesale_purchase_orders').updateOne(
    { paystackReference: reference },
    {
      $set: {
        paymentStatus: 'paid',
        paidAt: new Date(),
        orderStatus: 'confirmed',
        updatedAt: new Date(),
      },
    }
  );

  // If this was a credit order paid via Paystack, reduce outstanding balance
  if (order.paymentType === 'credit') {
    await db.collection('wholesale_customers').updateOne(
      { _id: order.customerId },
      { $inc: { outstandingBalance: -order.total } }
    );

    const customer = await db
      .collection('wholesale_customers')
      .findOne({ _id: order.customerId });

    if (customer && (customer.outstandingBalance ?? 0) <= 0) {
      await db.collection('wholesale_customers').updateOne(
        { _id: order.customerId },
        { $set: { blockedFromOrdering: false, outstandingBalance: 0 } }
      );
    }
  }

  // Fetch branch slug for redirect
  let branchSlug = '';
  if (order.branchId) {
    const branch = await db
      .collection('branches')
      .findOne({ _id: new ObjectId(order.branchId.toString()) });
    branchSlug = branch?.slug ?? '';
  }

  console.log('✅ Payment verified and order settled:', order.poNumber);
  return { success: true, order: { ...order, branchSlug } };
}