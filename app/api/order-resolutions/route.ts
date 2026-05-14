import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('resolutions:read');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const type   = searchParams.get('type');
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const query: any = {};
    if (!auth.isSuperAdmin && auth.branchId) query.branchId = auth.branchId;
    if (status) query.status = status;
    if (type)   query.type   = type;
    const resolutions = await db.collection('orderResolutions').find(query).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({ resolutions });
  } catch (error) {
    console.error('Failed to fetch resolutions:', error);
    return NextResponse.json({ error: 'Failed to fetch resolutions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('resolutions:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const resolution = {
      purchaseOrderId: new ObjectId(body.purchaseOrderId), orderNumber: body.orderNumber,
      branchId: auth.branchId, type: body.type, description: body.description,
      affectedItems: body.affectedItems.map((item: any) => ({ productId: new ObjectId(item.productId), variantId: item.variantId || undefined, productName: item.productName, quantity: item.quantity })),
      status: 'open', priority: body.priority || 'medium',
      createdBy: auth.userId, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await db.collection('orderResolutions').insertOne(resolution);
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create resolution:', error);
    return NextResponse.json({ error: 'Failed to create resolution' }, { status: 500 });
  }
}
