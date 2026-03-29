import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query = branchId ? { branchId: new ObjectId(branchId) } : {};

    const banners = await db.collection('hero_banners')
      .find(query)
      .sort({ order: 1 })
      .toArray();

    return NextResponse.json({ banners });
  } catch (error) {
    console.error('Failed to fetch banners:', error);
    return NextResponse.json({ error: 'Failed to fetch banners' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    if (!body.branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    }

    const banner = {
      ...body,
      branchId: new ObjectId(body.branchId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('hero_banners').insertOne(banner);
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create banner:', error);
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 });
  }
}