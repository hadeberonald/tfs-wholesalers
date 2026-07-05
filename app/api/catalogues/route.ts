import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const all      = searchParams.get('all');
    const branchId = searchParams.get('branchId');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query: any = {};

    if (all === 'true') {
      // Admin view — sees expired/inactive too, so they can manage them
      const auth = await requirePermission('catalogues:read');
      if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (!auth.isSuperAdmin) query.branchId = auth.branchId;
      else if (branchId) query.branchId = new ObjectId(branchId);
    } else {
      // Public/mobile view — only active, non-expired catalogues
      if (!branchId) return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
      query.branchId = new ObjectId(branchId);
      query.active = true;
      query.expiryDate = { $gt: new Date() };
    }

    const catalogues = await db.collection('catalogues')
      .find(query)
      .sort({ uploadedAt: -1 })
      .toArray();

    return NextResponse.json({ catalogues });
  } catch (error) {
    console.error('Failed to fetch catalogues:', error);
    return NextResponse.json({ error: 'Failed to fetch catalogues' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('catalogues:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (auth.isSuperAdmin) {
    return NextResponse.json({ error: 'Super admins cannot upload catalogues directly. Please assign to a branch.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, description, fileUrl, fileType, expiryDate } = body;

    if (!title || !fileUrl || !fileType) {
      return NextResponse.json({ error: 'title, fileUrl and fileType are required' }, { status: 400 });
    }
    if (!['pdf', 'image'].includes(fileType)) {
      return NextResponse.json({ error: 'fileType must be "pdf" or "image"' }, { status: 400 });
    }
    if (!expiryDate) {
      return NextResponse.json({ error: 'expiryDate is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const catalogue = {
      title,
      description: description || '',
      fileUrl,
      fileType, // 'pdf' | 'image'
      branchId: auth.branchId,
      expiryDate: new Date(expiryDate),
      active: true,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('catalogues').insertOne(catalogue);
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create catalogue:', error);
    return NextResponse.json({ error: 'Failed to create catalogue' }, { status: 500 });
  }
}