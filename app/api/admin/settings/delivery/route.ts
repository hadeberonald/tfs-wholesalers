// app/api/admin/settings/delivery/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    let branch;
    if (branchId) {
      branch = await db.collection('branches').findOne({ _id: new ObjectId(branchId) });
    } else {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: (adminInfo as any).status });
      }
      branch = await db.collection('branches').findOne({ _id: (adminInfo as any).branchId });
    }

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
  try {
    const body = await request.json();

    // Destructure only the six valid pricing fields — branchId and anything
    // else in the body is intentionally excluded so the DB stays clean.
    const { branchId, local, localRadius, medium, mediumRadius, far, farRadius } = body;

    const pricing = { local, localRadius, medium, mediumRadius, far, farRadius };

    // Resolve target branch
    let targetId: ObjectId;
    if (branchId) {
      targetId = new ObjectId(branchId);
    } else {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: (adminInfo as any).error }, { status: (adminInfo as any).status });
      }
      targetId = (adminInfo as any).branchId;
    }

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

    console.log('✅ Delivery pricing saved:', targetId.toString(), pricing);
    return NextResponse.json({ success: true, settings: pricing });
  } catch (error) {
    console.error('Failed to update delivery settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}