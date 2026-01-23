import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function PUT(request: NextRequest) {
  try {
    const { updates } = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Update each banner's order
    const updatePromises = updates.map((update: { id: string; order: number }) =>
      db.collection('hero_banners').updateOne(
        { _id: new ObjectId(update.id) },
        { $set: { order: update.order, updatedAt: new Date() } }
      )
    );

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reorder banners:', error);
    return NextResponse.json({ error: 'Failed to reorder banners' }, { status: 500 });
  }
}