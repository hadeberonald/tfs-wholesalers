import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const featured = searchParams.get('featured');
    const parentId = searchParams.get('parentId');
    const slug = searchParams.get('slug');
    const all = searchParams.get('all'); // For admin
    const withChildren = searchParams.get('withChildren'); // Get nested structure
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const query: any = all === 'true' ? {} : { active: true };
    
    if (featured === 'true') query.featured = true;
    if (slug) {
      query.slug = slug;
      // When querying by slug, don't apply active filter unless explicitly requested
      if (all !== 'true') {
        query.active = true;
      }
    }
    if (parentId === 'null' || parentId === null) {
      query.parentId = null;
    } else if (parentId) {
      query.parentId = new ObjectId(parentId);
    }
    
    let categories = await db
      .collection('categories')
      .find(query)
      .sort({ order: 1, name: 1 })
      .toArray();

    // If withChildren is true, build nested structure
    if (withChildren === 'true' && !slug) {
      const buildTree = (parentId: ObjectId | null = null): any[] => {
        return categories
          .filter(cat => {
            if (parentId === null) return !cat.parentId;
            return cat.parentId?.toString() === parentId.toString();
          })
          .map(cat => ({
            ...cat,
            children: buildTree(cat._id)
          }));
      };
      
      const tree = buildTree();
      return NextResponse.json({ categories: tree });
    }

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Generate slug from name
    const slug = body.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Determine level based on parent
    let level = 0;
    if (body.parentId) {
      const parent = await db.collection('categories').findOne({
        _id: new ObjectId(body.parentId)
      });
      if (parent) {
        level = (parent.level || 0) + 1;
      }
    }

    const category = {
      name: body.name,
      slug,
      description: body.description || '',
      image: body.image || '',
      banner: body.banner || '',
      parentId: body.parentId ? new ObjectId(body.parentId) : null,
      level,
      order: body.order || 0,
      active: body.active !== false,
      featured: body.featured || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('categories').insertOne(category);
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}