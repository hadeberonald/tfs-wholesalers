import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('wholesale-customers:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const updateData: any = { verificationStatus: body.verificationStatus, updatedAt: new Date() };

    if (body.verificationStatus === 'approved') {
      updateData.active = true; updateData.verifiedAt = new Date(); updateData.verifiedBy = auth.userId;
      if (!body.branchId && auth.branchId) updateData.branchId = auth.branchId;
    } else if (body.verificationStatus === 'rejected') {
      updateData.active = false; updateData.rejectedAt = new Date(); updateData.rejectedBy = auth.userId;
    }

    const result = await db.collection('wholesale_customers').updateOne({ _id: new ObjectId(params.id) }, { $set: updateData });
    if (result.matchedCount === 0) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    console.log('✅ Customer verification status updated:', params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Failed to update customer verification:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}
