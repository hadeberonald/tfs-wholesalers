import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const settings = await db.collection('settings').findOne({ type: 'delivery-pricing' });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    await db.collection('settings').updateOne(
      { type: 'delivery-pricing' },
      { $set: { ...body, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}