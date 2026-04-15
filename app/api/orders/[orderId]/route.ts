// app/api/orders/[orderId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';
import { verifyMobileToken } from '@/lib/verify-mobile-token';
import { getIO } from '@/lib/socket';
import {
  notifyBranchPickers,
  notifyUser,
  buildOrderStatusEmail,
  sendTransactionalEmail,
} from '@/lib/sendPushNotification';

// ─── DB helper ────────────────────────────────────────────────────────────────

async function findOrder(db: any, orderId: string) {
  if (ObjectId.isValid(orderId)) {
    const o = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
    if (o) return o;
  }
  return db.collection('orders').findOne({ orderNumber: orderId });
}

// ─── Push notifications per status ───────────────────────────────────────────

async function triggerStatusNotifications(order: any, newStatus: string): Promise<void> {
  const orderId      = order._id?.toString() || order.id;
  const orderNumber  = order.orderNumber || orderId;
  const branchId     = order.branchId?.toString();
  const customerId   = order.userId?.toString();
  // Stored at order creation time — safe to read here without extra DB call
  const customerEmail = order.customerEmail ?? null;
  const customerName  = order.customerName  ?? 'Customer';

  // ── Push ────────────────────────────────────────────────────────────────────
  switch (newStatus) {
    case 'confirmed':
      if (branchId) notifyBranchPickers(branchId, {
        title: '📋 Order Confirmed',
        body:  `${orderNumber} confirmed — ready to pick`,
        data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
      }).catch(() => {});
      break;

    case 'picking':
      // Picker triggered this themselves — no notification needed
      break;

    case 'packaging':
      // Internal status — push to branch so others know it's being packed
      if (branchId) notifyBranchPickers(branchId, {
        title: '📦 Packaging',
        body:  `${orderNumber} is being packaged`,
        data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
      }).catch(() => {});
      break;

    case 'ready_for_delivery':
      if (branchId) notifyBranchPickers(branchId, {
        title: '🚀 Ready for Delivery',
        body:  `${orderNumber} is packed — driver needed`,
        data:  { type: 'ready_for_delivery', orderId, orderNumber, status: newStatus },
      }).catch(() => {});
      break;

    case 'collecting':
    case 'out_for_delivery':
      if (customerId) notifyUser(customerId, {
        title: '🚗 On the Way!',
        body:  `Your order ${orderNumber} is out for delivery`,
        data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
      }).catch(() => {});
      break;

    case 'delivered':
      if (customerId) notifyUser(customerId, {
        title: '✅ Order Delivered',
        body:  `${orderNumber} has been delivered. Enjoy!`,
        data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
      }).catch(() => {});
      break;

    case 'cancelled':
      if (customerId) notifyUser(customerId, {
        title: '❌ Order Cancelled',
        body:  `${orderNumber} has been cancelled`,
        data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
      }).catch(() => {});
      break;
  }

  // ── Email (customer-facing statuses only) ───────────────────────────────────
  // buildOrderStatusEmail returns null for internal statuses — safe to always call
  if (customerEmail) {
    const emailPayload = buildOrderStatusEmail({
      orderNumber,
      customerName,
      customerEmail,
      status: newStatus,
    });
    if (emailPayload) sendTransactionalEmail(emailPayload).catch(() => {});
  }
}

// ─── Socket helper ────────────────────────────────────────────────────────────

function emitOrderUpdate(order: any, newStatus?: string) {
  try {
    const io = getIO();
    if (!io) return;

    const orderId  = order._id?.toString() || order.id;
    const branchId = order.branchId?.toString();
    const payload  = { order, status: newStatus || order.status };

    io.to(`order:${orderId}`).emit('order:updated', payload);
    if (branchId) io.to(`branch:${branchId}`).emit('order:updated', payload);

    console.log(
      `[Socket] order:updated → order:${orderId}${branchId ? ` + branch:${branchId}` : ''}`
    );
  } catch (err) {
    console.error('[Socket] emit error:', err);
  }
}

// ─── Shared update logic ──────────────────────────────────────────────────────

const PROTECTED_FIELDS = ['_id', 'id', 'branchId', 'userId', 'total', 'items'];

async function applyOrderUpdate(db: any, orderId: string, updates: any) {
  const filter = ObjectId.isValid(orderId)
    ? { _id: new ObjectId(orderId) }
    : { orderNumber: orderId };

  const safeUpdates = { ...updates };
  PROTECTED_FIELDS.forEach(k => delete safeUpdates[k]);

  const result = await db.collection('orders').findOneAndUpdate(
    filter,
    { $set: { ...safeUpdates, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  return result
    ? { ...result, _id: result._id.toString(), id: result._id.toString() }
    : null;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');
    const order  = await findOrder(db, params.orderId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      order: { ...order, _id: order._id.toString(), id: order._id.toString() },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch order', details: error.message },
      { status: 500 }
    );
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const client  = await clientPromise;
    const db      = client.db('tfs-wholesalers');
    const updates = await request.json();

    // ── Mobile (Bearer token) ───────────────────────────────────────────────
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
      if (!mobileUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const order = await findOrder(db, params.orderId);
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // Branch guard — pickers can only touch their own branch's orders
      if (mobileUser.activeBranchId) {
        const orderBranch = order.branchId?.toString();
        if (orderBranch && orderBranch !== mobileUser.activeBranchId.toString()) {
          return NextResponse.json(
            { error: 'Order does not belong to your branch' },
            { status: 403 }
          );
        }
      }

      const serialized = await applyOrderUpdate(db, params.orderId, updates);
      if (!serialized) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      emitOrderUpdate(serialized, updates.status);

      if (updates.status) {
        // Pass the full serialized doc so triggerStatusNotifications can read
        // customerEmail / customerName that were stored at order creation
        await triggerStatusNotifications(serialized, updates.status);
      }

      console.log(`✅ [Mobile] Order ${params.orderId} → ${updates.status ?? 'updated'}`);
      return NextResponse.json({ success: true, order: serialized });
    }

    // ── Admin (session cookie) ──────────────────────────────────────────────
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const order = await findOrder(db, params.orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!adminInfo.isSuperAdmin && order.branchId?.toString() !== adminInfo.branchId?.toString()) {
      return NextResponse.json(
        { error: 'Not authorized to update this order' },
        { status: 403 }
      );
    }

    const serialized = await applyOrderUpdate(db, params.orderId, updates);
    if (!serialized) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    emitOrderUpdate(serialized, updates.status);

    if (updates.status) {
      await triggerStatusNotifications(serialized, updates.status);
    }

    console.log(`✅ [Admin] Order ${params.orderId} → ${updates.status ?? 'updated'}`);
    return NextResponse.json({ success: true, order: serialized });

  } catch (error: any) {
    console.error('❌ Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  return PATCH(request, { params });
}