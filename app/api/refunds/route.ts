// app/api/refunds/route.ts

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('refunds:read');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const query: any = {};

    // Branch-scope non-superadmins by branchId stored directly on the refund
    if (!auth.isSuperAdmin && auth.branchId) {
      query.branchId = auth.branchId.toString();
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
    const auth = await requirePermission('refunds:write');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { refundId, status, note } = await request.json();
    if (!refundId) {
      return NextResponse.json({ error: 'refundId required' }, { status: 400 });
    }

    const allowedStatuses = ['approved', 'rejected', 'processed'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    // If branch-scoped, verify the refund belongs to this branch before updating
    const refundFilter: any = { _id: new ObjectId(refundId) };
    if (!auth.isSuperAdmin && auth.branchId) {
      refundFilter.branchId = auth.branchId.toString();
    }

    const result = await db.collection('refunds').updateOne(
      refundFilter,
      {
        $set: {
          status,
          ...(note ? { note } : {}),
          resolvedBy: auth.userId,
          resolvedAt: new Date(),
          updatedAt:  new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Refund not found or not accessible' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update refund:', error);
    return NextResponse.json({ error: 'Failed to update refund' }, { status: 500 });
  }
}