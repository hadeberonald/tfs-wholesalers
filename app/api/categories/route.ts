import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const slug = searchParams.get('slug');
    const all = searchParams.get('all');
    const branchId = searchParams.get('branchId');
    const withChildren = searchParams.get('withChildren');
    const featured = searchParams.get('featured');
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const query: any = { active: true };
    
    // Admin requesting their categories
    if (all === 'true') {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }
      
      // Remove active filter for admin
      delete query.active;
      
      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        query.branchId = adminInfo.branchId;
      }
    } else {
      // Customer browsing
      if (branchId) {
        query.branchId = new ObjectId(branchId);
      }
    }
    
    if (slug) {
      query.slug = slug;
    }
    
    // ✅ FIX: Add featured filter
    if (featured === 'true') {
      query.featured = true;
    }
    
    const categories = await db.collection('categories')
      .find(query)
      .sort({ order: 1, name: 1 })
      .toArray();
    
    // Build hierarchical structure if requested
    if (withChildren === 'true') {
      const buildTree = (parentId: string | null = null): any[] => {
        return categories
          .filter((cat: any) => {
            const catParentId = cat.parentId?.toString() || null;
            return catParentId === parentId;
          })
          .map((cat: any) => ({
            ...cat,
            children: buildTree(cat._id.toString())
          }));
      };
      
      const tree = buildTree(null);
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
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    if (adminInfo.isSuperAdmin) {
      return NextResponse.json({ 
        error: 'Super admins cannot create categories directly. Please assign to a branch.' 
      }, { status: 403 });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Generate slug from name
    const slug = body.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check for duplicate slug in same branch
    const existing = await db.collection('categories').findOne({
      branchId: adminInfo.branchId,
      slug
    });

    if (existing) {
      return NextResponse.json({ 
        error: 'A category with this name already exists in your branch' 
      }, { status: 400 });
    }

    // Determine level based on parent
    let level = 0;
    if (body.parentId) {
      const parent = await db.collection('categories').findOne({
        _id: new ObjectId(body.parentId),
        branchId: adminInfo.branchId
      });
      
      if (!parent) {
        return NextResponse.json({ 
          error: 'Parent category not found' 
        }, { status: 400 });
      }
      
      level = (parent.level || 0) + 1;
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
      active: body.active !== undefined ? body.active : true,
      featured: body.featured || false,
      branchId: adminInfo.branchId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('categories').insertOne(category);
    
    console.log('✅ Category created for branch:', adminInfo.branchId.toString());
    
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}