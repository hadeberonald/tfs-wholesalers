import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query: any = { _id: new ObjectId(params.id) };
    if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
      query.branchId = adminInfo.branchId;
    }

    const resolution = await db.collection('orderResolutions').findOne(query);

    if (!resolution) {
      return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
    }

    return NextResponse.json({ resolution });
  } catch (error) {
    console.error('Failed to fetch resolution:', error);
    return NextResponse.json({ error: 'Failed to fetch resolution' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query: any = { _id: new ObjectId(params.id) };
    if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
      query.branchId = adminInfo.branchId;
    }

    const existing = await db.collection('orderResolutions').findOne(query);
    if (!existing) {
      return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
    }

    const updateData: any = { updatedAt: new Date() };

    if (body.status) updateData.status = body.status;
    if (body.resolutionAction) updateData.resolutionAction = body.resolutionAction;
    if (body.resolution) updateData.resolution = body.resolution;

    if (body.status === 'resolved') {
      updateData.resolvedBy = adminInfo.userId;
      updateData.resolvedAt = new Date();
    }

    await db.collection('orderResolutions').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    // ── Handle stock adjustments ──────────────────────────────────────────────
    if (body.adjustStock && existing.affectedItems?.length > 0) {
      const action = body.resolutionAction;

      // Actions that ADD stock (keep extra over-delivered items)
      const addStockActions = ['keep_and_pay', 'keep_as_goodwill'];

      // Actions that REMOVE stock (return items to supplier)
      const removeStockActions = ['return_extra', 'returned_to_supplier'];

      if (addStockActions.includes(action) || removeStockActions.includes(action)) {
        const multiplier = addStockActions.includes(action) ? 1 : -1;

        for (const item of existing.affectedItems) {
          const qty = item.quantity * multiplier;

          if (item.variantId) {
            await db.collection('products').updateOne(
              {
                _id: new ObjectId(item.productId.toString()),
                'variants._id': item.variantId,
              },
              {
                $inc: { 'variants.$.stockLevel': qty },
                $set: { updatedAt: new Date() },
              }
            );
          } else {
            await db.collection('products').updateOne(
              { _id: new ObjectId(item.productId.toString()) },
              {
                $inc: { stockLevel: qty },
                $set: { updatedAt: new Date() },
              }
            );
          }
        }

        console.log(`✅ Stock adjusted for resolution ${params.id} — action: ${action}`);
      }
    }

    console.log('✅ Resolution updated:', params.id, body.status);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update resolution:', error);
    return NextResponse.json({ error: 'Failed to update resolution' }, { status: 500 });
  }
}