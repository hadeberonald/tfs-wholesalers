import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const slug     = searchParams.get('slug');
    const active   = searchParams.get('active');
    const featured = searchParams.get('featured');
    const all      = searchParams.get('all');
    const branchId = searchParams.get('branchId');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query: any = {};

    if (all === 'true') {
      // Admin requesting their own specials
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }

      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        query.branchId = adminInfo.branchId;
      }
    } else {
      // Customer browsing — only show active specials
      query.active = true;

      if (branchId) {
        query.branchId = new ObjectId(branchId);
      }
    }

    // ✅ Apply slug filter when provided
    if (slug) {
      query.slug = slug;
    }

    if (active   === 'true') query.active   = true;
    if (featured === 'true') query.featured = true;

    const specials = await db
      .collection('specials')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ specials });
  } catch (error) {
    console.error('Failed to fetch specials:', error);
    return NextResponse.json({ error: 'Failed to fetch specials' }, { status: 500 });
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
        error: 'Super admins cannot create specials directly. Please assign to a branch.',
      }, { status: 403 });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const special = {
      ...body,
      branchId: adminInfo.branchId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('specials').insertOne(special);

    console.log('✅ Special created for branch:', adminInfo.branchId.toString());

    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create special:', error);
    return NextResponse.json({ error: 'Failed to create special' }, { status: 500 });
  }
}