import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const slug         = searchParams.get('slug');
    const all          = searchParams.get('all');
    const branchId     = searchParams.get('branchId');
    const withChildren = searchParams.get('withChildren');
    const featured     = searchParams.get('featured');
    const listed       = searchParams.get('listed');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query: any = { active: true };

    if (all === 'true') {
      const auth = await requirePermission('categories:read');
      if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
      delete query.active;
      if (!auth.isSuperAdmin && auth.branchId) query.branchId = auth.branchId;
    } else {
      if (branchId) query.branchId = new ObjectId(branchId);
    }

    if (slug)              query.slug     = slug;
    if (featured === 'true') query.featured = true;
    if (listed   === 'true') query.listed   = true;

    const categories = await db.collection('categories').find(query).sort({ order: 1, name: 1 }).toArray();

    if (withChildren === 'true') {
      const buildTree = (parentId: string | null = null): any[] =>
        categories
          .filter((cat: any) => (cat.parentId?.toString() || null) === parentId)
          .map((cat: any) => ({ ...cat, children: buildTree(cat._id.toString()) }));
      return NextResponse.json({ categories: buildTree(null) });
    }

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('categories:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (auth.isSuperAdmin) {
    return NextResponse.json({ error: 'Super admins cannot create categories directly. Please assign to a branch.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const existing = await db.collection('categories').findOne({ branchId: auth.branchId, slug });
    if (existing) return NextResponse.json({ error: 'A category with this name already exists in your branch' }, { status: 400 });

    let level = 0;
    if (body.parentId) {
      const parent = await db.collection('categories').findOne({ _id: new ObjectId(body.parentId), branchId: auth.branchId });
      if (!parent) return NextResponse.json({ error: 'Parent category not found' }, { status: 400 });
      level = (parent.level || 0) + 1;
    }

    const category = {
      name: body.name, slug, description: body.description || '', image: body.image || '',
      banner: body.banner || '', icon: body.icon || '',
      parentId: body.parentId ? new ObjectId(body.parentId) : null,
      level, order: body.order || 0,
      active: body.active !== undefined ? body.active : true,
      featured: body.featured || false, listed: body.listed || false,
      branchId: auth.branchId, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await db.collection('categories').insertOne(category);
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
