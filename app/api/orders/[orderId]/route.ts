import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';
import { verifyMobileToken } from '@/lib/verify-mobile-token';
import { getIO } from '@/lib/socket';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import {
  notifyBranchPickers,
  notifyUser,
  buildOrderStatusEmail,
  buildOosRefundCustomerEmail,
  buildOosRefundInternalEmail,
  buildOrderConfirmationEmail,
  sendTransactionalEmail,
} from '@/lib/sendPushNotification';
import { notifyUserWeb, notifyBranchWeb } from '@/lib/sendWebPush';

const JWT_SECRET = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) throw new Error('[SECURITY] NEXTAUTH_SECRET environment variable is not set. Refusing to start.');

async function findOrder(db: any, orderId: string) {
  if (ObjectId.isValid(orderId)) {
    const o = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
    if (o) return o;
  }
  return db.collection('orders').findOne({ orderNumber: orderId });
}

// ─── Consolidated OOS refund emails ──────────────────────────────────────────
async function sendOosRefundEmails(order: any): Promise<void> {
  try {
    const oosItems: {
      name: string;
      variantName?: string;
      sku?: string;
      quantity: number;
      price: number;
    }[] = (order.items ?? []).filter((i: any) => i.oos === true && !i.isBonusItem && !i.isFreeItem && !i.isMultibuyBonus && !i.autoAdded);

    if (oosItems.length === 0) {
      console.log(`[OOS Refund Emails] No refundable OOS items on order ${order.orderNumber} — skipping`);
      return;
    }

    const refundTotal = oosItems.reduce(
      (sum: number, i: any) => sum + (i.price * i.quantity),
      0
    );

    if (refundTotal <= 0) {
      console.log(`[OOS Refund Emails] Refund total is zero on order ${order.orderNumber} — skipping`);
      return;
    }

    const customerEmail = order.customerEmail || order.customerInfo?.email || null;
    const customerName  = order.customerName  || order.customerInfo?.name  || 'Customer';
    const phone         = order.phone         || order.customerInfo?.phone || undefined;

    console.log(
      `[OOS Refund Emails] Order ${order.orderNumber} — ${oosItems.length} OOS item(s), ` +
      `refund total R${refundTotal.toFixed(2)}, customer: ${customerEmail ?? 'no email'}`
    );

    if (customerEmail) {
      const customerPayload = buildOosRefundCustomerEmail({
        orderNumber:   order.orderNumber,
        customerName,
        customerEmail,
        oosItems,
        refundTotal,
      });
      sendTransactionalEmail(customerPayload).catch(err =>
        console.error(`[OOS Refund Emails] Customer email failed for ${order.orderNumber}:`, err)
      );
    } else {
      console.warn(`[OOS Refund Emails] No customer email on order ${order.orderNumber} — customer notification skipped`);
    }

    const internalPayload = buildOosRefundInternalEmail({
      orderNumber:   order.orderNumber,
      customerName,
      customerEmail: customerEmail ?? '(no email provided)',
      phone,
      oosItems,
      refundTotal,
      branchName:    order.branchName   || undefined,
      paymentMethod: order.paymentMethod || undefined,
      paymentRef:    order.paymentReference || undefined,
    });
    sendTransactionalEmail(internalPayload).catch(err =>
      console.error(`[OOS Refund Emails] Internal email failed for ${order.orderNumber}:`, err)
    );
  } catch (err) {
    console.error(`[OOS Refund Emails] Unexpected error for order ${order.orderNumber}:`, err);
  }
}

// ─── Payment confirmation email ───────────────────────────────────────────────
// Fired when an order transitions from 'payment_pending' → 'pending' (paid).
// At order creation time the email was suppressed because status was
// 'payment_pending'. The PATCH after successful Paystack verification is what
// triggers this so the customer gets their confirmation.

async function sendPaymentConfirmationEmail(order: any): Promise<void> {
  const customerEmail = order.customerEmail || order.customerInfo?.email || null;
  const customerName  = order.customerName  || order.customerInfo?.name  || 'Customer';

  if (!customerEmail) {
    console.warn(`[Confirm Email] No customer email on order ${order.orderNumber} — skipping`);
    return;
  }

  try {
    const payload = buildOrderConfirmationEmail({
      orderNumber:       order.orderNumber,
      customerName,
      customerEmail,
      items:             order.items ?? [],
      total:             order.total ?? 0,
      deliveryFee:       order.deliveryFee ?? 0,
      deliveryAddress:   order.deliveryAddress || order.shippingAddress?.address || undefined,
      tillAccountNumber: order.tillAccountNumber ?? undefined,
    });
    await sendTransactionalEmail(payload);
    console.log(`[Confirm Email] Sent confirmation for order ${order.orderNumber} → ${customerEmail}`);
  } catch (err) {
    console.error(`[Confirm Email] Failed for order ${order.orderNumber}:`, err);
  }
}

async function triggerStatusNotifications(order: any, newStatus: string, previousStatus?: string): Promise<void> {
  const orderId     = order._id?.toString() || order.id;
  const orderNumber = order.orderNumber || orderId;
  const branchId    = order.branchId?.toString();
  const customerId  = order.userId?.toString();
  const customerEmail = order.customerEmail || order.customerInfo?.email || null;
  const customerName  = order.customerName  || order.customerInfo?.name  || 'Customer';

  // ── FIX: send confirmation email when payment is confirmed ───────────────
  // The order was created with status 'payment_pending' which suppressed the
  // confirmation email at creation time. When the mobile app patches to
  // 'pending' after Paystack verification succeeds, we fire it here exactly once.
  if (newStatus === 'pending' && previousStatus === 'payment_pending') {
    await sendPaymentConfirmationEmail(order);

    // Also notify branch staff about the new confirmed/paid order
    if (branchId) {
      notifyBranchPickers(branchId, {
        title: '🛒 New Order (Paid)',
        body:  `${orderNumber} payment confirmed — ready to pick`,
        data:  { type: 'new_order', orderId, orderNumber, status: newStatus },
      }).catch(() => {});
      notifyBranchWeb(branchId, {
        title: '🛒 New Order (Paid)',
        body:  `${orderNumber} payment confirmed — ready to pick`,
        data:  { type: 'new_order', orderId, orderNumber, status: newStatus },
      }).catch(() => {});
    }
    // Return early — no further status email needed for 'pending'
    return;
  }

  switch (newStatus) {
    case 'confirmed':
      if (branchId) {
        notifyBranchPickers(branchId, { title: '📋 Order Confirmed', body: `${orderNumber} confirmed — ready to pick`, data: { type: 'order_update', orderId, orderNumber, status: newStatus } }).catch(() => {});
        notifyBranchWeb(branchId, { title: '📋 Order Confirmed', body: `${orderNumber} confirmed — ready to pick`, data: { type: 'order_update', orderId, orderNumber, status: newStatus } }).catch(() => {});
      }
      break;
    case 'packaging':
      if (branchId) {
        notifyBranchPickers(branchId, { title: '📦 Packaging', body: `${orderNumber} is being packaged`, data: { type: 'order_update', orderId, orderNumber, status: newStatus } }).catch(() => {});
        notifyBranchWeb(branchId, { title: '📦 Packaging', body: `${orderNumber} is being packaged`, data: { type: 'order_update', orderId, orderNumber, status: newStatus } }).catch(() => {});
      }
      await sendOosRefundEmails(order);
      break;
    case 'ready_for_delivery':
      if (branchId) {
        notifyBranchPickers(branchId, { title: '🚀 Ready for Delivery', body: `${orderNumber} is packed — driver needed`, data: { type: 'ready_for_delivery', orderId, orderNumber, status: newStatus } }).catch(() => {});
        notifyBranchWeb(branchId, { title: '🚀 Ready for Delivery', body: `${orderNumber} is packed — driver needed`, data: { type: 'ready_for_delivery', orderId, orderNumber, status: newStatus } }).catch(() => {});
      }
      break;
    case 'collecting':
    case 'out_for_delivery':
      if (customerId) {
        notifyUser(customerId, { title: '🚗 On the Way!', body: `Your order ${orderNumber} is out for delivery`, data: { type: 'order_update', orderId, orderNumber, status: newStatus } }).catch(() => {});
        notifyUserWeb(customerId, { title: '🚗 On the Way!', body: `Your order ${orderNumber} is out for delivery`, data: { type: 'order_update', orderId, orderNumber, status: newStatus } }).catch(() => {});
      }
      break;
    case 'delivered':
      if (customerId) {
        notifyUser(customerId, { title: '✅ Order Delivered', body: `${orderNumber} has been delivered. Enjoy!`, data: { type: 'order_update', orderId, orderNumber, status: newStatus } }).catch(() => {});
        notifyUserWeb(customerId, { title: '✅ Order Delivered', body: `${orderNumber} has been delivered. Enjoy!`, data: { type: 'order_update', orderId, orderNumber, status: newStatus } }).catch(() => {});
      }
      break;
    case 'cancelled':
      if (customerId) {
        notifyUser(customerId, { title: '❌ Order Cancelled', body: `${orderNumber} has been cancelled`, data: { type: 'order_update', orderId, orderNumber, status: newStatus } }).catch(() => {});
        notifyUserWeb(customerId, { title: '❌ Order Cancelled', body: `${orderNumber} has been cancelled`, data: { type: 'order_update', orderId, orderNumber, status: newStatus } }).catch(() => {});
      }
      break;
  }

  if (customerEmail) {
    const emailPayload = buildOrderStatusEmail({ orderNumber, customerName, customerEmail, status: newStatus });
    if (emailPayload) sendTransactionalEmail(emailPayload).catch(() => {});
  } else {
    console.warn(`[Notifications] No customerEmail on order ${orderNumber} — status email skipped.`);
  }
}

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

const PROTECTED_FIELDS = ['_id', 'id', 'branchId', 'userId', 'total', 'items'];

async function applyOrderUpdate(db: any, orderId: string, updates: any) {
  const filter = ObjectId.isValid(orderId) ? { _id: new ObjectId(orderId) } : { orderNumber: orderId };
  const safeUpdates = { ...updates };
  PROTECTED_FIELDS.forEach(k => delete safeUpdates[k]);
  const result = await db.collection('orders').findOneAndUpdate(
    filter,
    { $set: { ...safeUpdates, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return result ? { ...result, _id: result._id.toString(), id: result._id.toString() } : null;
}

export async function GET(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    let authenticatedUserId: string | null = null;
    let isStaff = false;

    if (authHeader.startsWith('Bearer ')) {
      const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
      if (!mobileUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      authenticatedUserId = mobileUser.id;
      isStaff = true;
    } else {
      const cookieStore = await cookies();
      const token = cookieStore.get('auth-token')?.value;
      if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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

    if (!isStaff && order.userId?.toString() !== authenticatedUserId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({ order: { ...order, _id: order._id.toString(), id: order._id.toString() } });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const client  = await clientPromise;
    const db      = client.db('tfs-wholesalers');
    const updates = await request.json();

    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
      if (!mobileUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      // ── FIX: capture the previous status before applying the update so
      // triggerStatusNotifications can detect the payment_pending → pending
      // transition and fire the confirmation email exactly once.
      const orderBefore = await findOrder(db, params.orderId);
      if (!orderBefore) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

      if (mobileUser.activeBranchId) {
        const orderBranch = orderBefore.branchId?.toString();
        if (orderBranch && orderBranch !== mobileUser.activeBranchId.toString()) {
          return NextResponse.json({ error: 'Order does not belong to your branch' }, { status: 403 });
        }
      }

      const previousStatus = orderBefore.status;
      const serialized = await applyOrderUpdate(db, params.orderId, updates);
      if (!serialized) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      emitOrderUpdate(serialized, updates.status);
      if (updates.status) await triggerStatusNotifications(serialized, updates.status, previousStatus);
      console.log(`✅ [Mobile] Order ${params.orderId} ${previousStatus} → ${updates.status ?? 'updated'}`);
      return NextResponse.json({ success: true, order: serialized });
    }

    const auth = await requirePermission('orders:write');
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // ── Same previous-status capture for admin PATCH ─────────────────────
    const orderBefore = await findOrder(db, params.orderId);
    if (!orderBefore) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    if (!auth.isSuperAdmin && orderBefore.branchId?.toString() !== auth.branchId?.toString()) {
      return NextResponse.json({ error: 'Not authorized to update this order' }, { status: 403 });
    }

    const previousStatus = orderBefore.status;
    const serialized = await applyOrderUpdate(db, params.orderId, updates);
    if (!serialized) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    emitOrderUpdate(serialized, updates.status);
    if (updates.status) await triggerStatusNotifications(serialized, updates.status, previousStatus);
    console.log(`✅ [Admin] Order ${params.orderId} ${previousStatus} → ${updates.status ?? 'updated'}`);
    return NextResponse.json({ success: true, order: serialized });
  } catch (error: any) {
    console.error('❌ Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { orderId: string } }) {
  return PATCH(request, { params });
}