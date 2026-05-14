import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const combo = await db.collection('combos').findOne({ _id: new ObjectId(params.id) });
    if (!combo) return NextResponse.json({ error: 'Combo not found' }, { status: 404 });
    return NextResponse.json({ combo });
  } catch (error) {
    console.error('Failed to fetch combo:', error);
    return NextResponse.json({ error: 'Failed to fetch combo' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('combos:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const existing = await db.collection('combos').findOne({ _id: new ObjectId(params.id) });
    if (!existing) return NextResponse.json({ error: 'Combo not found' }, { status: 404 });
    if (!auth.isSuperAdmin && existing.branchId.toString() !== auth.branchId.toString()) {
      return NextResponse.json({ error: 'Not authorized to edit this combo' }, { status: 403 });
    }

    const { _id, branchId, createdAt, ...updateData } = body;
    updateData.updatedAt = new Date();
    await db.collection('combos').updateOne({ _id: new ObjectId(params.id) }, { $set: updateData });
    console.log('✅ Combo updated:', params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update combo:', error);
    return NextResponse.json({ error: 'Failed to update combo' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('combos:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const existing = await db.collection('combos').findOne({ _id: new ObjectId(params.id) });
    if (!existing) return NextResponse.json({ error: 'Combo not found' }, { status: 404 });
    if (!auth.isSuperAdmin && existing.branchId.toString() !== auth.branchId.toString()) {
      return NextResponse.json({ error: 'Not authorized to delete this combo' }, { status: 403 });
    }

    await db.collection('combos').deleteOne({ _id: new ObjectId(params.id) });
    console.log('✅ Combo deleted:', params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete combo:', error);
    return NextResponse.json({ error: 'Failed to delete combo' }, { status: 500 });
  }
}
