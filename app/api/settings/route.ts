import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    if (!branchId) return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const branch = await db.collection('branches').findOne({ _id: new ObjectId(branchId) });
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    const pricing = branch.settings?.deliveryPricing || {};

    return NextResponse.json({
      settings: {
        local:        35,
        localRadius:  pricing.localRadius  ?? 15,
        medium:       35,
        mediumRadius: pricing.mediumRadius ?? 15,
        far:          35,
        farRadius:    pricing.farRadius    ?? 15,
      },
      location: branch.settings?.storeLocation || { lat: -29.8587, lng: 31.0218, address: '' },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}