import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

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
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const { _id, ...updateData } = body;
    
    // Regenerate slug if name changed
    if (updateData.name) {
      updateData.slug = updateData.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    
    // Update level if parent changed
    if ('parentId' in updateData) {
      if (updateData.parentId) {
        const parent = await db.collection('categories').findOne({
          _id: new ObjectId(updateData.parentId)
        });
        updateData.level = parent ? (parent.level || 0) + 1 : 0;
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
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Check if category has children
    const hasChildren = await db.collection('categories').findOne({
      parentId: new ObjectId(params.id)
    });

    if (hasChildren) {
      return NextResponse.json({ 
        error: 'Cannot delete category with subcategories' 
      }, { status: 400 });
    }

    // Check if category has products
    const hasProducts = await db.collection('products').findOne({
      category: params.id
    });

    if (hasProducts) {
      return NextResponse.json({ 
        error: 'Cannot delete category with products' 
      }, { status: 400 });
    }

    await db.collection('categories').deleteOne({ 
      _id: new ObjectId(params.id) 
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}