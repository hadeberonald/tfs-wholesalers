import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const categories = await db
      .collection('categories')
      .find({ active: true })
      .sort({ order: 1 })
      .toArray();

    return NextResponse.json({ categories });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const category = {
      ...body,
      slug: body.name.toLowerCase().replace(/\s+/g, '-'),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('categories').insertOne(category);
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
