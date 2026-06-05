import { NextRequest, NextResponse } from 'next/server';
import { paystackService } from '@/lib/payment';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getIO } from '@/lib/socket';
import {
  notifyBranchPickers,
  buildOrderStatusEmail,
  sendTransactionalEmail,
} from '@/lib/sendPushNotification';
import { notifyUserWeb, notifyBranchWeb } from '@/lib/sendWebPush';

// ─── Paystack statuses that mean "not settled yet — try again" ────────────────
// These are transient states where the transaction is in-flight.
// "ongoing" is the most common race condition hit when Paystack fires
// the callback before their backend fully settles.
const RETRYABLE_STATUSES = new Set([
  'ongoing',
  'pending',
  'processing',
  'queued',
]);

// These are terminal failures — no point retrying
const TERMINAL_FAILURE_STATUSES = new Set([
  'failed',
  'reversed',
  'abandoned',
  'cancelled',
  'timeout',
]);

// ─── Socket emit ──────────────────────────────────────────────────────────────
function emitOrderUpdate(order: any) {
  try {
    const io = getIO();
    if (!io) {
      console.warn('[Socket] getIO() returned null in verify route');
      return;
    }
    const branchId   = order.branchId?.toString();
    const serialized = { ...order, _id: order._id?.toString(), id: order._id?.toString() };
    const payload    = { order: serialized, status: serialized.status };

    if (branchId) io.to(`branch:${branchId}`).emit('order:updated', payload);
    io.to(`order:${serialized._id}`).emit('order:updated', payload);

    console.log(`[Socket] verify → branch:${branchId} + order:${serialized._id}`);
  } catch (err) {
    console.error('[Socket] verify emit error:', err);
  }
}

// ─── Picker notifications on payment confirmation ─────────────────────────────
async function triggerPaymentConfirmedNotifications(order: any): Promise<void> {
  const orderId       = order._id?.toString();
  const orderNumber   = order.orderNumber || orderId;
  const branchId      = order.branchId?.toString();
  const customerEmail = order.customerEmail || order.customerInfo?.email || null;
  const customerName  = order.customerName  || order.customerInfo?.name  || 'Customer';

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

// ─── Helper: resolve branch slug from branchId ────────────────────────────────
async function getBranchSlug(db: any, branchId: any): Promise<string | null> {
  if (!branchId) return null;
  try {
    const branch = await db.collection('branches').findOne(
      { _id: new ObjectId(branchId.toString()) },
      { projection: { slug: 1 } }
    );
    return branch?.slug || null;
  } catch {
    return null;
  }
}

// ─── POST /api/payment/verify ─────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { reference } = await request.json();

    if (!reference) {
      return NextResponse.json({ error: 'Payment reference is required' }, { status: 400 });
    }

    // ── Step 1: Ask Paystack for the transaction status ───────────────────────
    let paystackResult: any;
    try {
      paystackResult = await paystackService.verifyPayment(reference);
    } catch (fetchErr: any) {
      // Network error hitting Paystack — tell client to retry
      console.error(`[Verify] Network error calling Paystack for ${reference}:`, fetchErr.message);
      return NextResponse.json(
        {
          verified:  false,
          pending:   true,
          retryable: true,
          error:     'Could not reach payment provider — retrying…',
        },
        { status: 202 }
      );
    }

    const paystackStatus: string = paystackResult?.data?.status ?? '';

    console.log(`[Verify] Paystack status "${paystackStatus}" for ${reference}`);

    // ── Step 2: Handle transient / not-yet-settled states ────────────────────
    // Return HTTP 202 so the client knows to keep polling.
    if (RETRYABLE_STATUSES.has(paystackStatus)) {
      console.log(`[Verify] Status "${paystackStatus}" is transient — instructing client to retry`);
      return NextResponse.json(
        {
          verified:  false,
          pending:   true,
          retryable: true,
          error:     `Payment status is "${paystackStatus}" — waiting for settlement`,
        },
        { status: 202 }
      );
    }

    // ── Step 3: Handle terminal Paystack failures ─────────────────────────────
    if (TERMINAL_FAILURE_STATUSES.has(paystackStatus)) {
      console.warn(`[Verify] Terminal failure "${paystackStatus}" for ${reference}`);
      return NextResponse.json(
        {
          verified:  false,
          retryable: false,
          error:     `Payment ${paystackStatus}. Please try again or use a different card.`,
        },
        { status: 400 }
      );
    }

    // ── Step 4: Validate Paystack reports success ─────────────────────────────
    if (!paystackResult.status || paystackStatus !== 'success') {
      console.warn(`[Verify] Non-success status "${paystackStatus}" for ${reference}:`, paystackResult.message);
      return NextResponse.json(
        {
          verified:  false,
          retryable: false,
          error:     paystackResult.message || `Payment was not successful (status: ${paystackStatus})`,
        },
        { status: 400 }
      );
    }

    // ── Step 5: Payment is confirmed by Paystack — process in our DB ─────────
    const { data } = paystackResult;

    const orderId =
      data.metadata?.orderId ||
      data.metadata?.custom_fields?.find(
        (field: any) => field.variable_name === 'order_id'
      )?.value;

    if (!orderId) {
      console.error(
        `[Verify] CRITICAL: Payment ${reference} verified on Paystack but no orderId in metadata.`,
        'Metadata received:', JSON.stringify(data.metadata ?? null)
      );
      return NextResponse.json(
        {
          verified:  false,
          retryable: false,
          error:
            'Payment received but could not be matched to your order. ' +
            'Please contact support with reference: ' + reference,
        },
        { status: 422 }
      );
    }

    if (!ObjectId.isValid(orderId)) {
      console.error(`[Verify] Invalid orderId format in metadata: "${orderId}" for reference ${reference}`);
      return NextResponse.json(
        { verified: false, retryable: false, error: 'Invalid order reference. Please contact support.' },
        { status: 422 }
      );
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const existing = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });

    if (!existing) {
      console.error(`[Verify] Order ${orderId} not found in DB for reference ${reference}`);
      return NextResponse.json(
        { verified: false, retryable: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // ── Step 6: Idempotency — already paid, just return success ──────────────
    if (existing.paymentStatus === 'paid') {
      console.log(`[Verify] Order ${orderId} already marked paid — skipping duplicate update`);
      const branchSlug = await getBranchSlug(db, existing.branchId);
      return NextResponse.json({
        verified:  true,
        orderId,
        branchSlug,
        amount:    data.amount / 100,
        reference: data.reference,
      });
    }

    // ── Step 7: Mark order paid and confirmed ─────────────────────────────────
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
      console.error(`[Verify] findOneAndUpdate returned null for order ${orderId}`);
      return NextResponse.json(
        { verified: false, retryable: false, error: 'Failed to update order — please contact support' },
        { status: 500 }
      );
    }

    console.log(`✅ [Verify] Order ${orderId} → paid + confirmed (ref: ${reference})`);

    emitOrderUpdate(updated);
    await triggerPaymentConfirmedNotifications(updated);

    const branchSlug = await getBranchSlug(db, updated.branchId);

    return NextResponse.json({
      verified:  true,
      orderId,
      branchSlug,
      amount:    data.amount / 100,
      reference: data.reference,
    });
  } catch (error: any) {
    console.error('[Verify] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', retryable: false },
      { status: 500 }
    );
  }
}