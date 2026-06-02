import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const order = await db
      .collection('wholesale_purchase_orders')
      .findOne({ _id: new ObjectId(params.id) });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    return NextResponse.json({ order });
  } catch (error) {
    console.error('Failed to fetch order:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission('wholesale-orders:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const order = await db
      .collection('wholesale_purchase_orders')
      .findOne({ _id: new ObjectId(params.id) });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const updateData: any = { updatedAt: new Date() };

    // ── Order status update ────────────────────────────────────────────────
    if (body.orderStatus) updateData.orderStatus = body.orderStatus;
    if (body.trackingNumber) updateData.trackingNumber = body.trackingNumber;

    // ── POP review: admin approves or rejects proof of payment ─────────────
    if (body.popAction) {
      if (body.popAction === 'approve') {
        updateData.popStatus = 'approved';
        updateData.paymentStatus = 'paid';
        updateData.paidAt = new Date();
        updateData.orderStatus = 'confirmed';

        // Reduce outstanding balance if this was a credit order paid via POP
        if (order.paymentType === 'credit' || order.paymentType === 'pop') {
          await db.collection('wholesale_customers').updateOne(
            { _id: order.customerId },
            { $inc: { outstandingBalance: -order.total } }
          );
          // Unblock if was blocked and balance now clears
          await unblockIfClear(db, order.customerId);
        }
      } else if (body.popAction === 'reject') {
        updateData.popStatus = 'rejected';
        updateData.popRejectionReason = body.popRejectionReason ?? null;
        // paymentStatus stays pending_pop_review → customer must re-upload
        updateData.paymentStatus = 'pop_rejected';
      }
    }

    // ── Paystack webhook / manual confirm ─────────────────────────────────
    if (body.paystackReference) {
      updateData.paystackReference = body.paystackReference;
      updateData.paymentStatus = 'paid';
      updateData.paidAt = new Date();
      updateData.orderStatus = 'confirmed';
    }

    // ── Manual payment status override ────────────────────────────────────
    if (body.paymentStatus && !body.popAction && !body.paystackReference) {
      updateData.paymentStatus = body.paymentStatus;
      if (body.paymentStatus === 'paid') {
        updateData.paidAt = new Date();

        if (order.paymentType === 'credit') {
          await db.collection('wholesale_customers').updateOne(
            { _id: order.customerId },
            { $inc: { outstandingBalance: -order.total } }
          );
          await unblockIfClear(db, order.customerId);
        }
      }
    }

    await db
      .collection('wholesale_purchase_orders')
      .updateOne({ _id: new ObjectId(params.id) }, { $set: updateData });

    console.log('✅ Order updated:', params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Failed to update order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

// ── Helper: unblock customer if outstanding balance is zero or less ────────
async function unblockIfClear(db: any, customerId: ObjectId) {
  const customer = await db
    .collection('wholesale_customers')
    .findOne({ _id: customerId });
  if (customer && (customer.outstandingBalance ?? 0) <= 0) {
    await db.collection('wholesale_customers').updateOne(
      { _id: customerId },
      { $set: { blockedFromOrdering: false, outstandingBalance: 0 } }
    );
  }
}