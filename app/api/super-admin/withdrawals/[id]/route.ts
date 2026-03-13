// app/api/super-admin/withdrawals/[id]/route.ts — approve/reject
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }
    if (!adminInfo.isSuperAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const existing = await db.collection('withdrawalRequests').findOne({
      _id: new ObjectId(params.id),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });
    }

    const updateData: any = {
      status: body.status,
      updatedAt: new Date(),
    };

    if (body.adminNotes) updateData.adminNotes = body.adminNotes;
    if (body.status === 'rejected' || body.status === 'approved') {
      updateData.processedAt = new Date();
      updateData.processedBy = adminInfo.userId;
    }

    await db.collection('withdrawalRequests').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    console.log(`✅ Withdrawal ${params.id} → ${body.status}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update withdrawal:', error);
    return NextResponse.json({ error: 'Failed to update withdrawal' }, { status: 500 });
  }
}