import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function GET(request: NextRequest) {
  const adminInfo = await getAdminBranch();
  if ('error' in adminInfo) {
    return NextResponse.json({ error: adminInfo.error }, { status: (adminInfo as any).status });
  }

  try {
    const branchId = request.nextUrl.searchParams.get('branchId');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const targetId = branchId ? new ObjectId(branchId) : (adminInfo as any).branchId;

    const branch = await db.collection('branches').findOne(
      { _id: targetId },
      { projection: { 'settings.storeLocation': 1 } }
    );

    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({ location: branch.settings?.storeLocation ?? null });
  } catch (error) {
    console.error('Failed to fetch location settings:', error);
    return NextResponse.json({ error: 'Failed to fetch location' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const adminInfo = await getAdminBranch();
  if ('error' in adminInfo) {
    return NextResponse.json({ error: adminInfo.error }, { status: (adminInfo as any).status });
  }

  try {
    const { branchId, lat, lng, address } = await request.json();

    if (lat === undefined || lng === undefined || !address) {
      return NextResponse.json(
        { error: 'lat, lng, and address are required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const targetId = branchId ? new ObjectId(branchId) : (adminInfo as any).branchId;

    const result = await db.collection('branches').updateOne(
      { _id: targetId },
      {
        $set: {
          'settings.storeLocation': { lat, lng, address },
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update location settings:', error);
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
  }
}