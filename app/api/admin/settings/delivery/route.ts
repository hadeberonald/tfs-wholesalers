import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const result = await db.collection('settings').updateOne(
      { type: 'delivery-pricing' },
      {
        $set: {
          ...body,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update delivery pricing' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const settings = await db.collection('settings').findOne({ type: 'delivery-pricing' });

    if (!settings) {
      return NextResponse.json({
        local: 35,
        localRadius: 20,
        medium: 85,
        mediumRadius: 40,
        far: 105,
        farRadius: 60,
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch delivery pricing' }, { status: 500 });
  }
}
