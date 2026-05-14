import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export async function PUT(request: NextRequest) {
  const auth = await requirePermission('hero-banners:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { updates, branchId } = await request.json();
    if (!branchId) return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    if (!Array.isArray(updates) || updates.length === 0) return NextResponse.json({ error: 'updates array is required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    await Promise.all(updates.map((update: { id: string; order: number }) =>
      db.collection('hero_banners').updateOne(
        { _id: new ObjectId(update.id), branchId: new ObjectId(branchId) },
        { $set: { order: update.order, updatedAt: new Date() } }
      )
    ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reorder banners:', error);
    return NextResponse.json({ error: 'Failed to reorder banners' }, { status: 500 });
  }
}
