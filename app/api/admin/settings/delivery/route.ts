import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';
import { ObjectId } from 'mongodb';

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
    const branch = await db.collection('branches').findOne({ _id: targetId });

    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({
      settings: branch.settings?.deliveryPricing || null,
    });
  } catch (error) {
    console.error('Failed to fetch delivery settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const adminInfo = await getAdminBranch();
  if ('error' in adminInfo) {
    return NextResponse.json({ error: adminInfo.error }, { status: (adminInfo as any).status });
  }

  try {
    const { branchId, local, localRadius, medium, mediumRadius, far, farRadius } = await request.json();
    const pricing = { local, localRadius, medium, mediumRadius, far, farRadius };

    const targetId = branchId ? new ObjectId(branchId) : (adminInfo as any).branchId;

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const result = await db.collection('branches').updateOne(
      { _id: targetId },
      {
        $set: {
          'settings.deliveryPricing': pricing,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, settings: pricing });
  } catch (error) {
    console.error('Failed to update delivery settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}