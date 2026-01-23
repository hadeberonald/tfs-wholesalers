import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const banners = await db.collection('hero_banners')
      .find({})
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

    const banner = {
      ...body,
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