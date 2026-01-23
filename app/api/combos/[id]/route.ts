import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const combo = await db.collection('combos').findOne({
      _id: new ObjectId(params.id)
    });

    if (!combo) {
      return NextResponse.json({ error: 'Combo not found' }, { status: 404 });
    }

    return NextResponse.json({ combo });
  } catch (error) {
    console.error('Failed to fetch combo:', error);
    return NextResponse.json({ error: 'Failed to fetch combo' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const { _id, ...updateData } = body;
    updateData.updatedAt = new Date();

    await db.collection('combos').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update combo:', error);
    return NextResponse.json({ error: 'Failed to update combo' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    await db.collection('combos').deleteOne({
      _id: new ObjectId(params.id)
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete combo:', error);
    return NextResponse.json({ error: 'Failed to delete combo' }, { status: 500 });
  }
}