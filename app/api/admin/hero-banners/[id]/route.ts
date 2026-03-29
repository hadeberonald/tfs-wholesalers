import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    if (!body.branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    }

    const { _id, branchId, ...updateData } = body;
    updateData.updatedAt = new Date();

    const result = await db.collection('hero_banners').updateOne(
      {
        _id: new ObjectId(params.id),
        branchId: new ObjectId(branchId), // Ensures a branch can only edit its own banners
      },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Banner not found or does not belong to this branch' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update banner:', error);
    return NextResponse.json({ error: 'Failed to update banner' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const result = await db.collection('hero_banners').deleteOne({
      _id: new ObjectId(params.id),
      branchId: new ObjectId(branchId), // Ensures a branch can only delete its own banners
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Banner not found or does not belong to this branch' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete banner:', error);
    return NextResponse.json({ error: 'Failed to delete banner' }, { status: 500 });
  }
}