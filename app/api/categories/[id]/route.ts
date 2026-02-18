import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const category = await db.collection('categories').findOne({
      _id: new ObjectId(params.id)
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Failed to fetch category:', error);
    return NextResponse.json({ error: 'Failed to fetch category' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // ✅ Verify ownership
    const existing = await db.collection('categories').findOne({
      _id: new ObjectId(params.id)
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    
    if (!adminInfo.isSuperAdmin && existing.branchId.toString() !== adminInfo.branchId.toString()) {
      return NextResponse.json({ error: 'Not authorized to edit this category' }, { status: 403 });
    }

    const { _id, branchId, createdAt, ...updateData } = body;

    // Update slug if name changed
    if (updateData.name && updateData.name !== existing.name) {
      updateData.slug = updateData.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Check for duplicate slug
      const duplicate = await db.collection('categories').findOne({
        _id: { $ne: new ObjectId(params.id) },
        branchId: existing.branchId,
        slug: updateData.slug
      });

      if (duplicate) {
        return NextResponse.json({ 
          error: 'A category with this name already exists in your branch' 
        }, { status: 400 });
      }
    }

    // Update level if parent changed
    if ('parentId' in updateData) {
      if (updateData.parentId) {
        const parent = await db.collection('categories').findOne({
          _id: new ObjectId(updateData.parentId),
          branchId: existing.branchId
        });
        
        if (!parent) {
          return NextResponse.json({ 
            error: 'Parent category not found' 
          }, { status: 400 });
        }
        
        updateData.level = (parent.level || 0) + 1;
        updateData.parentId = new ObjectId(updateData.parentId);
      } else {
        updateData.level = 0;
        updateData.parentId = null;
      }
    }

    updateData.updatedAt = new Date();

    await db.collection('categories').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    console.log('✅ Category updated:', params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update category:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // ✅ Verify ownership
    const existing = await db.collection('categories').findOne({
      _id: new ObjectId(params.id)
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    
    if (!adminInfo.isSuperAdmin && existing.branchId.toString() !== adminInfo.branchId.toString()) {
      return NextResponse.json({ error: 'Not authorized to delete this category' }, { status: 403 });
    }

    // Check if category has children
    const hasChildren = await db.collection('categories').findOne({
      parentId: new ObjectId(params.id)
    });

    if (hasChildren) {
      return NextResponse.json({ 
        error: 'Cannot delete category with subcategories. Please delete or move subcategories first.' 
      }, { status: 400 });
    }

    // Check if category is used by products
    const hasProducts = await db.collection('products').findOne({
      categories: params.id
    });

    if (hasProducts) {
      return NextResponse.json({ 
        error: 'Cannot delete category that is assigned to products. Please reassign products first.' 
      }, { status: 400 });
    }

    await db.collection('categories').deleteOne({
      _id: new ObjectId(params.id)
    });

    console.log('✅ Category deleted:', params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}