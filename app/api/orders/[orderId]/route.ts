// app/api/orders/[orderId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';
import { verifyMobileToken } from '@/lib/verify-mobile-token';
import { getIO } from '@/lib/socket';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import {
  notifyBranchPickers,
  notifyUser,
  buildOrderStatusEmail,
  sendTransactionalEmail,
} from '@/lib/sendPushNotification';
import { notifyUserWeb, notifyBranchWeb } from '@/lib/sendWebPush';

// SECURITY: No fallback.
const JWT_SECRET = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) throw new Error('[SECURITY] NEXTAUTH_SECRET environment variable is not set. Refusing to start.');

// ─── DB helper ────────────────────────────────────────────────────────────────

async function findOrder(db: any, orderId: string) {
  if (ObjectId.isValid(orderId)) {
    const o = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
    if (o) return o;
  }
  return db.collection('orders').findOne({ orderNumber: orderId });
}

// ─── Notifications per status ─────────────────────────────────────────────────

async function triggerStatusNotifications(order: any, newStatus: string): Promise<void> {
  const orderId     = order._id?.toString() || order.id;
  const orderNumber = order.orderNumber || orderId;
  const branchId    = order.branchId?.toString();
  const customerId  = order.userId?.toString();

  const customerEmail =
    order.customerEmail ||
    order.customerInfo?.email ||
    null;
  const customerName =
    order.customerName ||
    order.customerInfo?.name ||
    'Customer';

  switch (newStatus) {
    case 'confirmed':
      if (branchId) {
        notifyBranchPickers(branchId, {
          title: '📋 Order Confirmed',
          body:  `${orderNumber} confirmed — ready to pick`,
          data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
        }).catch(() => {});
        notifyBranchWeb(branchId, {
          title: '📋 Order Confirmed',
          body:  `${orderNumber} confirmed — ready to pick`,
          data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
        }).catch(() => {});
      }
      break;

    case 'packaging':
      if (branchId) {
        notifyBranchPickers(branchId, {
          title: '📦 Packaging',
          body:  `${orderNumber} is being packaged`,
          data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
        }).catch(() => {});
        notifyBranchWeb(branchId, {
          title: '📦 Packaging',
          body:  `${orderNumber} is being packaged`,
          data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
        }).catch(() => {});
      }
      break;

    case 'ready_for_delivery':
      if (branchId) {
        notifyBranchPickers(branchId, {
          title: '🚀 Ready for Delivery',
          body:  `${orderNumber} is packed — driver needed`,
          data:  { type: 'ready_for_delivery', orderId, orderNumber, status: newStatus },
        }).catch(() => {});
        notifyBranchWeb(branchId, {
          title: '🚀 Ready for Delivery',
          body:  `${orderNumber} is packed — driver needed`,
          data:  { type: 'ready_for_delivery', orderId, orderNumber, status: newStatus },
        }).catch(() => {});
      }
      break;

    case 'collecting':
    case 'out_for_delivery':
      if (customerId) {
        notifyUser(customerId, {
          title: '🚗 On the Way!',
          body:  `Your order ${orderNumber} is out for delivery`,
          data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
        }).catch(() => {});
        notifyUserWeb(customerId, {
          title: '🚗 On the Way!',
          body:  `Your order ${orderNumber} is out for delivery`,
          data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
        }).catch(() => {});
      }
      break;

    case 'delivered':
      if (customerId) {
        notifyUser(customerId, {
          title: '✅ Order Delivered',
          body:  `${orderNumber} has been delivered. Enjoy!`,
          data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
        }).catch(() => {});
        notifyUserWeb(customerId, {
          title: '✅ Order Delivered',
          body:  `${orderNumber} has been delivered. Enjoy!`,
          data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
        }).catch(() => {});
      }
      break;

    case 'cancelled':
      if (customerId) {
        notifyUser(customerId, {
          title: '❌ Order Cancelled',
          body:  `${orderNumber} has been cancelled`,
          data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
        }).catch(() => {});
        notifyUserWeb(customerId, {
          title: '❌ Order Cancelled',
          body:  `${orderNumber} has been cancelled`,
          data:  { type: 'order_update', orderId, orderNumber, status: newStatus },
        }).catch(() => {});
      }
      break;
  }

  if (customerEmail) {
    const emailPayload = buildOrderStatusEmail({
      orderNumber,
      customerName,
      customerEmail,
      status: newStatus,
    });
    if (emailPayload) sendTransactionalEmail(emailPayload).catch(() => {});
  } else {
    console.warn(
      `[Notifications] No customerEmail on order ${orderNumber} — status email skipped.`
    );
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

export async function GET(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    // SECURITY: require authentication — web cookie or mobile Bearer token
    const authHeader = request.headers.get('authorization') || '';
    let authenticatedUserId: string | null = null;
    let isStaff = false;

    if (authHeader.startsWith('Bearer ')) {
      // Mobile staff (picker/delivery) — verify mobile token
      const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
      if (!mobileUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      authenticatedUserId = mobileUser.id;
      isStaff = true;
    } else {
      // Web — verify cookie session
      const cookieStore = await cookies();
      const token = cookieStore.get('auth-token')?.value;
      if (!token) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      try {
        const decoded = jwt.verify(token, JWT_SECRET!) as any;
        authenticatedUserId = decoded.userId;
        isStaff = decoded.role === 'admin' || decoded.role === 'super-admin';
      } catch {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      }
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');
    const order  = await findOrder(db, params.orderId);

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // SECURITY: non-staff users may only view their own orders
    if (!isStaff && order.userId?.toString() !== authenticatedUserId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({ order: { ...order, _id: order._id.toString(), id: order._id.toString() } });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const client  = await clientPromise;
    const db      = client.db('tfs-wholesalers');
    const updates = await request.json();

    // ── Mobile (Bearer token) ───────────────────────────────────────────────
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
      if (!mobileUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const order = await findOrder(db, params.orderId);
      if (!order)  return NextResponse.json({ error: 'Order not found' }, { status: 404 });

      if (mobileUser.activeBranchId) {
        const orderBranch = order.branchId?.toString();
        if (orderBranch && orderBranch !== mobileUser.activeBranchId.toString()) {
          return NextResponse.json({ error: 'Order does not belong to your branch' }, { status: 403 });
        }
      }

      const serialized = await applyOrderUpdate(db, params.orderId, updates);
      if (!serialized) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

      emitOrderUpdate(serialized, updates.status);
      if (updates.status) await triggerStatusNotifications(serialized, updates.status);

      console.log(`✅ [Mobile] Order ${params.orderId} → ${updates.status ?? 'updated'}`);
      return NextResponse.json({ success: true, order: serialized });
    }

    // ── Admin (session cookie) ──────────────────────────────────────────────
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });

    const order = await findOrder(db, params.orderId);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    if (!adminInfo.isSuperAdmin && order.branchId?.toString() !== adminInfo.branchId?.toString()) {
      return NextResponse.json({ error: 'Not authorized to update this order' }, { status: 403 });
    }

    const serialized = await applyOrderUpdate(db, params.orderId, updates);
    if (!serialized) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    emitOrderUpdate(serialized, updates.status);
    if (updates.status) await triggerStatusNotifications(serialized, updates.status);

    console.log(`✅ [Admin] Order ${params.orderId} → ${updates.status ?? 'updated'}`);
    return NextResponse.json({ success: true, order: serialized });

  } catch (error: any) {
    console.error('❌ Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { orderId: string } }) {
  return PATCH(request, { params });
}
