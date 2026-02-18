import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const special = await db.collection('specials').findOne({
      _id: new ObjectId(params.id)
    });

    if (!special) {
      return NextResponse.json({ error: 'Special not found' }, { status: 404 });
    }

    return NextResponse.json({ special });
  } catch (error) {
    console.error('Failed to fetch special:', error);
    return NextResponse.json({ error: 'Failed to fetch special' }, { status: 500 });
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

    // ✅ Verify ownership
    const existing = await db.collection('specials').findOne({
      _id: new ObjectId(params.id)
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Special not found' }, { status: 404 });
    }
    
    if (!adminInfo.isSuperAdmin && existing.branchId.toString() !== adminInfo.branchId.toString()) {
      return NextResponse.json({ error: 'Not authorized to edit this special' }, { status: 403 });
    }

    const { _id, branchId, createdAt, ...updateData } = body;
    updateData.updatedAt = new Date();

    await db.collection('specials').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    console.log('✅ Special updated:', params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update special:', error);
    return NextResponse.json({ error: 'Failed to update special' }, { status: 500 });
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

    // ✅ Verify ownership
    const existing = await db.collection('specials').findOne({
      _id: new ObjectId(params.id)
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Special not found' }, { status: 404 });
    }
    
    if (!adminInfo.isSuperAdmin && existing.branchId.toString() !== adminInfo.branchId.toString()) {
      return NextResponse.json({ error: 'Not authorized to delete this special' }, { status: 403 });
    }

    await db.collection('specials').deleteOne({
      _id: new ObjectId(params.id)
    });

    console.log('✅ Special deleted:', params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete special:', error);
    return NextResponse.json({ error: 'Failed to delete special' }, { status: 500 });
  }
}