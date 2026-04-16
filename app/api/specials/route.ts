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
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }
      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        query.branchId = adminInfo.branchId;
      }
    } else {
      query.active = true;
      if (branchId) query.branchId = new ObjectId(branchId);
    }

    if (slug)                query.slug     = slug;
    if (active   === 'true') query.active   = true;
    if (featured === 'true') query.featured = true;

    const specials = await db
      .collection('specials')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // ── Batch-fetch all referenced products in ONE query ──────────────────
    // Collect every productId referenced across all special types
    const rawIds: string[] = [];
    for (const s of specials) {
      if (s.productId)                    rawIds.push(s.productId.toString());
      if (Array.isArray(s.productIds))    s.productIds.forEach((id: any) => rawIds.push(id.toString()));
      if (s.conditions?.buyProductId)     rawIds.push(s.conditions.buyProductId.toString());
      if (s.conditions?.getProductId)     rawIds.push(s.conditions.getProductId.toString());
    }

    const uniqueIds = [...new Set(rawIds)].filter(id => ObjectId.isValid(id));

    const products = uniqueIds.length > 0
      ? await db
          .collection('products')
          .find({ _id: { $in: uniqueIds.map(id => new ObjectId(id)) } })
          .toArray()
      : [];

    const productMap = Object.fromEntries(
      products.map(p => [p._id.toString(), p])
    );

    // Attach the primary product to each special so the app never needs
    // to make a secondary fetch per card
    const enrichedSpecials = specials.map(s => {
      const primaryId =
        s.productId?.toString() ||
        s.productIds?.[0]?.toString() ||
        s.conditions?.buyProductId?.toString() ||
        null;

      return {
        ...s,
        product: primaryId ? (productMap[primaryId] ?? null) : null,
      };
    });

    return NextResponse.json({ specials: enrichedSpecials });

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
      branchId:  adminInfo.branchId,
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