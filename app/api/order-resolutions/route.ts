import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const all = searchParams.get('all');
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const query: any = {};
    
    // Only check admin auth if requesting filtered data
    if (all === 'true' || status) {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }
      
      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        query.branchId = adminInfo.branchId;
      }
    }
    
    if (status) {
      query.status = status;
    }
    
    const resolutions = await db.collection('orderResolutions')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    
    return NextResponse.json({ resolutions });
  } catch (error) {
    console.error('Failed to fetch order resolutions:', error);
    return NextResponse.json({ error: 'Failed to fetch order resolutions' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query: any = { _id: new ObjectId(body.id) };
    
    if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
      query.branchId = adminInfo.branchId;
    }

    const updateData: any = {
      status: body.status,
      updatedAt: new Date()
    };

    if (body.resolution) {
      updateData.resolution = body.resolution;
    }

    if (body.status === 'resolved') {
      updateData.resolvedBy = adminInfo.userId;
      updateData.resolvedAt = new Date();
    }

    await db.collection('orderResolutions').updateOne(
      query,
      { $set: updateData }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update order resolution:', error);
    return NextResponse.json({ error: 'Failed to update order resolution' }, { status: 500 });
  }
}