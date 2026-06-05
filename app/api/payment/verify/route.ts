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

    const result = await paystackService.verifyPayment(reference);

    // Paystack gateway-level failure (e.g. bad key, network error)
    if (!result.status) {
      console.warn(`[Verify] Paystack gateway error for ${reference}:`, result.message);
      return NextResponse.json(
        { verified: false, error: result.message || 'Could not reach payment provider' },
        { status: 400 }
      );
    }

    const txStatus = result.data?.status;

    // Transaction is still settling — tell the client to retry
    if (txStatus === 'ongoing' || txStatus === 'processing' || txStatus === 'pending') {
      console.log(`[Verify] Payment ${reference} is still ${txStatus} — asking client to retry`);
      return NextResponse.json(
        { verified: false, pending: true, error: `Payment is still ${txStatus}` },
        { status: 202 }
      );
    }

    // Any non-success terminal state (failed, abandoned, reversed, etc.)
    if (txStatus !== 'success') {
      console.warn(`[Verify] Paystack reports non-success for ${reference}: ${txStatus}`);
      return NextResponse.json(
        { verified: false, error: result.message || `Payment status: ${txStatus}` },
        { status: 400 }
      );
    }

    const { data } = result;

    // ── Extract orderId from metadata ─────────────────────────────────────────
    const orderId =
      data.metadata?.orderId ||
      data.metadata?.custom_fields?.find(
        (field: any) => field.variable_name === 'order_id'
      )?.value;

    if (!orderId) {
      console.error(
        `[Verify] CRITICAL: Payment ${reference} verified on Paystack but no orderId in metadata.`,
        'Metadata received:',
        JSON.stringify(data.metadata ?? null)
      );
      return NextResponse.json(
        {
          verified: false,
          error:
            'Payment was received but we could not match it to your order. Please contact support with reference: ' +
            reference,
        },
        { status: 422 }
      );
    }

    if (!ObjectId.isValid(orderId)) {
      console.error(`[Verify] Invalid orderId format in metadata: "${orderId}" for reference ${reference}`);
      return NextResponse.json(
        { verified: false, error: 'Invalid order reference. Please contact support.' },
        { status: 422 }
      );
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const existing = await db.collection('orders').findOne({
      _id: new ObjectId(orderId),
    });

    if (!existing) {
      console.error(`[Verify] Order ${orderId} not found in DB for reference ${reference}`);
      return NextResponse.json({ verified: false, error: 'Order not found' }, { status: 404 });
    }

    // ── Idempotency: already paid — return success with branch info for redirect
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

    // ── Mark order paid and confirmed ─────────────────────────────────────────
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
        { verified: false, error: 'Failed to update order — please contact support' },
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
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}