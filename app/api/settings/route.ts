// app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const branch = await db.collection('branches').findOne({
      _id: new ObjectId(branchId),
    });

    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({
      settings: branch.settings?.deliveryPricing || {
        local: 35,
        localRadius: 20,
        medium: 85,
        mediumRadius: 40,
        far: 105,
        farRadius: 60,
      },
      location: branch.settings?.storeLocation || {
        lat: -29.8587,
        lng: 31.0218,
        address: '',
      },
    });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}