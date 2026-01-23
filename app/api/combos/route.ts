import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get('active');
    const slug = searchParams.get('slug');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Build query
    const query: any = {};
    if (active === 'true') query.active = true;
    if (slug) query.slug = slug;

    const combos = await db.collection('combos')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ combos });
  } catch (error) {
    console.error('Failed to fetch combos:', error);
    return NextResponse.json({ error: 'Failed to fetch combos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const combo = {
      ...body,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('combos').insertOne(combo);

    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create combo:', error);
    return NextResponse.json({ error: 'Failed to create combo' }, { status: 500 });
  }
}