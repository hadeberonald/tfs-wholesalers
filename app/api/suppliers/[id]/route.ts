import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('suppliers:read');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const query: any = { _id: new ObjectId(params.id) };
    if (!auth.isSuperAdmin && auth.branchId) query.branchId = auth.branchId;
    const supplier = await db.collection('suppliers').findOne(query);
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    return NextResponse.json({ supplier });
  } catch (error) {
    console.error('Failed to fetch supplier:', error);
    return NextResponse.json({ error: 'Failed to fetch supplier' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('suppliers:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const query: any = { _id: new ObjectId(params.id) };
    if (!auth.isSuperAdmin && auth.branchId) query.branchId = auth.branchId;

    const existing = await db.collection('suppliers').findOne(query);
    if (!existing) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    if (body.email && body.email !== existing.email) {
      const duplicate = await db.collection('suppliers').findOne({ branchId: existing.branchId, email: body.email, _id: { $ne: new ObjectId(params.id) } });
      if (duplicate) return NextResponse.json({ error: 'A supplier with this email already exists' }, { status: 400 });
    }

    await db.collection('suppliers').updateOne({ _id: new ObjectId(params.id) }, { $set: { name: body.name, email: body.email, phone: body.phone || null, address: body.address || null, updatedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update supplier:', error);
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('suppliers:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const query: any = { _id: new ObjectId(params.id) };
    if (!auth.isSuperAdmin && auth.branchId) query.branchId = auth.branchId;

    const existing = await db.collection('suppliers').findOne(query);
    if (!existing) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const usedInPO = await db.collection('purchaseOrders').findOne({ supplierId: new ObjectId(params.id) });
    if (usedInPO) return NextResponse.json({ error: 'Cannot delete supplier that is used in purchase orders. Deactivate instead.' }, { status: 400 });

    await db.collection('suppliers').deleteOne({ _id: new ObjectId(params.id) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete supplier:', error);
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
  }
}
