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
    
    const purchaseOrder = await db.collection('purchaseOrders').findOne(query);

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    return NextResponse.json({ purchaseOrder });
  } catch (error) {
    console.error('Failed to fetch purchase order:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase order' }, { status: 500 });
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

    const existing = await db.collection('purchaseOrders').findOne(query);
    
    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const updateData: any = {
      ...body,
      updatedAt: new Date()
    };

    if (body.status === 'confirmed' && existing.status !== 'confirmed') {
      updateData.approvedBy = adminInfo.userId;
      updateData.approvedAt = new Date();
    }

    if (body.status === 'sent' && existing.status !== 'sent') {
      updateData.sentAt = new Date();
    }

    if (body.status === 'received' && existing.status !== 'received') {
      updateData.receivedAt = new Date();
    }

    delete updateData._id;

    await db.collection('purchaseOrders').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    console.log('✅ Purchase order updated:', params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update purchase order:', error);
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 });
  }
}

export async function DELETE(
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

    const existing = await db.collection('purchaseOrders').findOne(query);
    
    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ 
        error: 'Only draft purchase orders can be deleted' 
      }, { status: 400 });
    }

    await db.collection('purchaseOrders').deleteOne({ _id: new ObjectId(params.id) });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete purchase order:', error);
    return NextResponse.json({ error: 'Failed to delete purchase order' }, { status: 500 });
  }
}