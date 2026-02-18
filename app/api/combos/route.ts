import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get('active');
    const slug = searchParams.get('slug');
    const all = searchParams.get('all');
    const branchId = searchParams.get('branchId');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query: any = {};
    
    // Admin requesting their combos
    if (all === 'true') {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }
      
      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        query.branchId = adminInfo.branchId;
      }
    } else {
      // Customer browsing
      if (active === 'true') query.active = true;
      
      if (branchId) {
        query.branchId = new ObjectId(branchId);
      }
    }
    
    if (slug) query.slug = slug;

    const combos = await db.collection('combos')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ combos });
  } catch (error) {
    console.error('Failed to fetch combos:', error);
    return NextResponse.json({ error: 'Failed to fetch combos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    if (adminInfo.isSuperAdmin) {
      return NextResponse.json({ 
        error: 'Super admins cannot create combos directly. Please assign to a branch.' 
      }, { status: 403 });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const combo = {
      ...body,
      branchId: adminInfo.branchId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('combos').insertOne(combo);
    
    console.log('✅ Combo created for branch:', adminInfo.branchId.toString());

    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create combo:', error);
    return NextResponse.json({ error: 'Failed to create combo' }, { status: 500 });
  }
}