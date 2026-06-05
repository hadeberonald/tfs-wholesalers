import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getIO } from '@/lib/socket';
import {
  notifyBranchPickers,
  buildOrderStatusEmail,
  sendTransactionalEmail,
} from '@/lib/sendPushNotification';
import { notifyBranchWeb } from '@/lib/sendWebPush';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// ─── Socket emit ──────────────────────────────────────────────────────────────
function emitOrderUpdate(order: any) {
  try {
    const io = getIO();
    if (!io) return;
    const branchId   = order.branchId?.toString();
    const serialized = { ...order, _id: order._id?.toString(), id: order._id?.toString() };
    const payload    = { order: serialized, status: serialized.status };
    if (branchId) io.to(`branch:${branchId}`).emit('order:updated', payload);
    io.to(`order:${serialized._id}`).emit('order:updated', payload);
  } catch (err) {
    console.error('[Webhook] emit error:', err);
  }
}

// ─── Handle charge.success ────────────────────────────────────────────────────
async function handleChargeSuccess(data: any): Promise<void> {
  const reference = data.reference;

  const orderId =
    data.metadata?.orderId ||
    data.metadata?.custom_fields?.find(
      (f: any) => f.variable_name === 'order_id'
    )?.value;

  if (!orderId) {
    console.error(
      `[Webhook] charge.success for ${reference} has no orderId in metadata:`,
      JSON.stringify(data.metadata ?? null)
    );
    return;
  }

  if (!ObjectId.isValid(orderId)) {
    console.error(`[Webhook] Invalid orderId "${orderId}" for reference ${reference}`);
    return;
  }

  const client = await clientPromise;
  const db     = client.db('tfs-wholesalers');

  const existing = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
  if (!existing) {
    console.error(`[Webhook] Order ${orderId} not found for reference ${reference}`);
    return;
  }

  // Idempotency: skip if already paid (verify route may have run first)
  if (existing.paymentStatus === 'paid') {
    console.log(`[Webhook] Order ${orderId} already paid — skipping duplicate`);
    return;
  }

  const updated = await db.collection('orders').findOneAndUpdate(
    { _id: new ObjectId(orderId) },
    {
      $set: {
        paymentStatus: 'paid',
        status:        'confirmed',
        paymentDetails: {
          reference: data.reference,
          amount:    data.amount / 100,
          paidAt:    data.paid_at,
          channel:   data.channel,
        },
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!updated) {
    console.error(`[Webhook] findOneAndUpdate returned null for order ${orderId}`);
    return;
  }

  console.log(`✅ [Webhook] Order ${orderId} → paid + confirmed (ref: ${reference})`);

  emitOrderUpdate(updated);

  const branchId      = updated.branchId?.toString();
  const orderNumber   = updated.orderNumber || orderId;
  const customerEmail = updated.customerEmail || updated.customerInfo?.email || null;
  const customerName  = updated.customerName  || updated.customerInfo?.name  || 'Customer';

  if (branchId) {
    notifyBranchPickers(branchId, {
      title: '🛒 New Order',
      body:  `Order ${orderNumber} is paid and ready to pick`,
      data:  { type: 'new_order', orderId, orderNumber },
    }).catch(() => {});

    notifyBranchWeb(branchId, {
      title: '🛒 New Order',
      body:  `Order ${orderNumber} is paid and ready to pick`,
      data:  { type: 'new_order', orderId, orderNumber },
    }).catch(() => {});
  }

  if (customerEmail) {
    const emailPayload = buildOrderStatusEmail({
      orderNumber,
      customerName,
      customerEmail,
      status: 'confirmed',
    });
    if (emailPayload) sendTransactionalEmail(emailPayload).catch(() => {});
  }
}

// ─── POST /api/payment/webhook ────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!PAYSTACK_SECRET) {
    console.error('[Webhook] PAYSTACK_SECRET_KEY is not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // Read raw body for signature verification — must happen before any parsing
  const rawBody = await request.text();

  const signature = request.headers.get('x-paystack-signature');
  if (!signature) {
    console.warn('[Webhook] Request missing x-paystack-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const expectedHash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (expectedHash !== signature) {
    console.warn('[Webhook] Signature mismatch — possible spoofed request');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  console.log(`[Webhook] Received event: ${event.event}`);

  try {
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(event.data);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.event}`);
    }
  } catch (err) {
    // Log but return 200 — returning 5xx causes Paystack to retry indefinitely
    console.error(`[Webhook] Error processing event ${event.event}:`, err);
  }

  // Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true });
}