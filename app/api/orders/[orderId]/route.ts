// app/api/orders/[orderId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';
import { verifyMobileToken } from '@/lib/verify-mobile-token';

async function findOrder(db: any, orderId: string) {
  if (ObjectId.isValid(orderId)) {
    const o = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
    if (o) return o;
  }
  return db.collection('orders').findOne({ orderNumber: orderId });
}

// ─── GET — works without auth (customer tracking) ────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const order = await findOrder(db, params.orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      order: { ...order, _id: order._id.toString(), id: order._id.toString() },
    });
  } catch (error: any) {
    console.error('❌ Error fetching order:', error);
    return NextResponse.json({ error: 'Failed to fetch order', details: error.message }, { status: 500 });
  }
}

// ─── PATCH / PUT ─────────────────────────────────────────────────────────────
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

    // Fields the picker must never be able to change
    const PROTECTED = ['_id', 'id', 'branchId', 'userId', 'total', 'items'];

    // ── Picker / delivery app (Bearer token) ─────────────────────────────────
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

      // Verify branch ownership
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

      if (!result) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      console.log(`✅ [Mobile] Order ${params.orderId} → status: ${safeUpdates.status || 'unchanged'}`);
      return NextResponse.json({
        success: true,
        order: { ...result, _id: result._id.toString(), id: result._id.toString() },
      });
    }

    // ── Admin dashboard (session cookie) ────────────────────────────────────
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const order = await findOrder(db, params.orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

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

    if (!result) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    console.log(`✅ [Admin] Order ${params.orderId} updated`);
    return NextResponse.json({
      success: true,
      order: { ...result, _id: result._id.toString(), id: result._id.toString() },
    });
  } catch (error: any) {
    console.error('❌ Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order', details: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  return PATCH(request, { params });
}