import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';
import { verifyMobileToken } from '@/lib/verify-mobile-token';
import { getIO } from '@/lib/socket';
import { notifyBranchPickers, notifyUser } from '@/lib/sendPushNotification'; // ← NEW

async function findOrder(db: any, orderId: string) {
  if (ObjectId.isValid(orderId)) {
    const o = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
    if (o) return o;
  }
  return db.collection('orders').findOne({ orderNumber: orderId });
}

// ─── Notification logic per status ───────────────────────────────────────────
function triggerStatusNotification(order: any, newStatus: string) {
  const orderId     = order._id?.toString() || order.id;
  const orderNumber = order.orderNumber || orderId;
  const branchId    = order.branchId?.toString();
  const customerId  = order.userId?.toString();

  switch (newStatus) {
    case 'confirmed':
      if (branchId) notifyBranchPickers(branchId, {
        title: '📋 Order Confirmed',
        body:  `${orderNumber} has been confirmed and needs picking`,
        data:  { type: 'order_update', orderId, orderNumber },
      }).catch(() => {});
      break;

    case 'picking':
      // No notification needed — picker started it themselves
      break;

    case 'ready_for_delivery':
      if (branchId) notifyBranchPickers(branchId, {
        title: '📦 Ready for Delivery',
        body:  `${orderNumber} is packed and waiting for a driver`,
        data:  { type: 'ready_for_delivery', orderId, orderNumber },
      }).catch(() => {});
      break;

    case 'out_for_delivery':
      if (customerId) notifyUser(customerId, {
        title: '🚗 Your order is on the way!',
        body:  `${orderNumber} is out for delivery`,
        data:  { type: 'order_update', orderId, orderNumber },
      }).catch(() => {});
      break;

    case 'delivered':
      if (customerId) notifyUser(customerId, {
        title: '✅ Order Delivered',
        body:  `${orderNumber} has been delivered. Enjoy!`,
        data:  { type: 'order_update', orderId, orderNumber },
      }).catch(() => {});
      break;

    case 'cancelled':
      if (customerId) notifyUser(customerId, {
        title: '❌ Order Cancelled',
        body:  `${orderNumber} has been cancelled`,
        data:  { type: 'order_update', orderId, orderNumber },
      }).catch(() => {});
      break;
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const order = await findOrder(db, params.orderId);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    return NextResponse.json({ order: { ...order, _id: order._id.toString(), id: order._id.toString() } });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch order', details: error.message }, { status: 500 });
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const updates = await request.json();

    const filter = ObjectId.isValid(params.orderId)
      ? { _id: new ObjectId(params.orderId) }
      : { orderNumber: params.orderId };

    const PROTECTED = ['_id', 'id', 'branchId', 'userId', 'total', 'items'];

    // ── Mobile (Bearer token) ─────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
      if (!mobileUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const order = await findOrder(db, params.orderId);
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

      if (mobileUser.activeBranchId) {
        const orderBranch = order.branchId?.toString();
        if (orderBranch && orderBranch !== mobileUser.activeBranchId.toString()) {
          return NextResponse.json({ error: 'Order does not belong to your branch' }, { status: 403 });
        }
      }

      const safeUpdates = { ...updates };
      PROTECTED.forEach(k => delete safeUpdates[k]);

      const result = await db.collection('orders').findOneAndUpdate(
        filter,
        { $set: { ...safeUpdates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      if (!result) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

      const serialized = { ...result, _id: result._id.toString(), id: result._id.toString() };

      emitOrderUpdate(serialized, safeUpdates.status);

      // ── Fire push notification ──────────────────────────────────────────
      if (safeUpdates.status) {
        triggerStatusNotification(serialized, safeUpdates.status);
      }

      console.log(`✅ [Mobile] Order ${params.orderId} → status: ${safeUpdates.status || 'unchanged'}`);
      return NextResponse.json({ success: true, order: serialized });
    }

    // ── Admin (session cookie) ────────────────────────────────────────────────
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });

    const order = await findOrder(db, params.orderId);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    if (!adminInfo.isSuperAdmin && order.branchId?.toString() !== adminInfo.branchId?.toString()) {
      return NextResponse.json({ error: 'Not authorized to update this order' }, { status: 403 });
    }

    const safeUpdates = { ...updates };
    PROTECTED.forEach(k => delete safeUpdates[k]);

    const result = await db.collection('orders').findOneAndUpdate(
      filter,
      { $set: { ...safeUpdates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const serialized = { ...result, _id: result._id.toString(), id: result._id.toString() };

    emitOrderUpdate(serialized, safeUpdates.status);

    // ── Fire push notification ────────────────────────────────────────────
    if (safeUpdates.status) {
      triggerStatusNotification(serialized, safeUpdates.status);
    }

    console.log(`✅ [Admin] Order ${params.orderId} updated`);
    return NextResponse.json({ success: true, order: serialized });
  } catch (error: any) {
    console.error('❌ Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { orderId: string } }) {
  return PATCH(request, { params });
}

// ─── Socket helper ────────────────────────────────────────────────────────────
function emitOrderUpdate(order: any, newStatus?: string) {
  try {
    const io = getIO();
    if (!io) return;

    const orderId  = order._id?.toString() || order.id;
    const branchId = order.branchId?.toString();
    const payload  = { order, status: newStatus || order.status || order.orderStatus };

    io.to(`order:${orderId}`).emit('order:updated', payload);
    if (branchId) io.to(`branch:${branchId}`).emit('order:updated', payload);

    console.log(`[Socket] Emitted order:updated → order:${orderId}${branchId ? ` + branch:${branchId}` : ''}`);
  } catch (err) {
    console.error('[Socket] emit error:', err);
  }
}