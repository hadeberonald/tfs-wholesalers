// app/api/orders/[orderId]/item-oos/route.ts
// Save this file to: app/api/orders/[orderId]/item-oos/route.ts
// (Same content as item-oos-route.ts output — rename on copy)

// app/api/refunds/route.ts  ← NEW admin endpoint to list pending refunds
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function GET(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const query: any = {};
    if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
      // Filter by branch via the order — join not possible in Mongo easily,
      // so we store branchId on the refund record too (done in issueRefund helper).
      // For now filter by orders in this branch:
      const branchOrders = await db
        .collection('orders')
        .find({ branchId: adminInfo.branchId }, { projection: { _id: 1 } })
        .toArray();
      const orderIds = branchOrders.map(o => o._id.toString());
      query.orderId = { $in: orderIds };
    }

    const status = request.nextUrl.searchParams.get('status');
    if (status) query.status = status;

    const refunds = await db
      .collection('refunds')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      refunds: refunds.map(r => ({ ...r, _id: r._id.toString() })),
    });
  } catch (error) {
    console.error('Failed to fetch refunds:', error);
    return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const { refundId, status, note } = await request.json();
    if (!refundId) return NextResponse.json({ error: 'refundId required' }, { status: 400 });

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    await db.collection('refunds').updateOne(
      { _id: new ObjectId(refundId) },
      {
        $set: {
          status,
          note:        note || undefined,
          resolvedBy:  adminInfo.userId,
          resolvedAt:  new Date(),
          updatedAt:   new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update refund:', error);
    return NextResponse.json({ error: 'Failed to update refund' }, { status: 500 });
  }
}