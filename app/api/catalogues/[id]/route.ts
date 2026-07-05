import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const catalogue = await db.collection('catalogues').findOne({ _id: new ObjectId(params.id) });
    if (!catalogue) return NextResponse.json({ error: 'Catalogue not found' }, { status: 404 });
    return NextResponse.json({ catalogue });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch catalogue' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('catalogues:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const existing = await db.collection('catalogues').findOne({ _id: new ObjectId(params.id) });
    if (!existing) return NextResponse.json({ error: 'Catalogue not found' }, { status: 404 });

    if (!auth.isSuperAdmin && existing.branchId.toString() !== auth.branchId.toString()) {
      return NextResponse.json({ error: 'Not authorized to edit this catalogue' }, { status: 403 });
    }

    const { _id, branchId, uploadedAt, ...updateData } = body;

    if (updateData.fileType && !['pdf', 'image'].includes(updateData.fileType)) {
      return NextResponse.json({ error: 'fileType must be "pdf" or "image"' }, { status: 400 });
    }
    if (updateData.expiryDate) updateData.expiryDate = new Date(updateData.expiryDate);
    if ('active' in updateData) updateData.active = Boolean(updateData.active);
    updateData.updatedAt = new Date();

    await db.collection('catalogues').updateOne({ _id: new ObjectId(params.id) }, { $set: updateData });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update catalogue:', error);
    return NextResponse.json({ error: 'Failed to update catalogue' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('catalogues:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const existing = await db.collection('catalogues').findOne({ _id: new ObjectId(params.id) });
    if (!existing) return NextResponse.json({ error: 'Catalogue not found' }, { status: 404 });

    if (!auth.isSuperAdmin && existing.branchId.toString() !== auth.branchId.toString()) {
      return NextResponse.json({ error: 'Not authorized to delete this catalogue' }, { status: 403 });
    }

    await db.collection('catalogues').deleteOne({ _id: new ObjectId(params.id) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete catalogue:', error);
    return NextResponse.json({ error: 'Failed to delete catalogue' }, { status: 500 });
  }
}