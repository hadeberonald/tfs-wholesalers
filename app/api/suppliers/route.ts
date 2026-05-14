import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const all = request.nextUrl.searchParams.get('all');
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const query: any = { active: true };

    if (all === 'true') {
      const auth = await requirePermission('suppliers:read');
      if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (!auth.isSuperAdmin && auth.branchId) query.branchId = auth.branchId;
      delete query.active;
    }

    const suppliers = await db.collection('suppliers').find(query).sort({ name: 1 }).toArray();
    return NextResponse.json({ suppliers });
  } catch (error) {
    console.error('Failed to fetch suppliers:', error);
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('suppliers:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (auth.isSuperAdmin) {
    return NextResponse.json({ error: 'Super admins cannot create suppliers directly. Please assign to a branch.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const existing = await db.collection('suppliers').findOne({ branchId: auth.branchId, email: body.email });
    if (existing) return NextResponse.json({ error: 'A supplier with this email already exists' }, { status: 400 });

    const supplier = { ...body, branchId: auth.branchId, active: true, createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('suppliers').insertOne(supplier);
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create supplier:', error);
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}
