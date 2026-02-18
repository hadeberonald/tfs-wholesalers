import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production';

// Verify user is super admin
async function verifySuperAdmin(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
    
    if (!user || user.role !== 'super-admin') {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
}

// GET - Get single branch
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifySuperAdmin(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const params = await context.params;
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const branch = await db.collection('branches').findOne({
      _id: new ObjectId(params.id)
    });

    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({ branch });
  } catch (error) {
    console.error('Get branch error:', error);
    return NextResponse.json({ error: 'Failed to fetch branch' }, { status: 500 });
  }
}

// PUT - Update branch
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifySuperAdmin(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const params = await context.params;
    const body = await request.json();
    const { _id, createdAt, createdBy, ...updateData } = body;

    // If slug is being updated, check for conflicts
    if (updateData.slug) {
      const client = await clientPromise;
      const db = client.db('tfs-wholesalers');
      
      const existing = await db.collection('branches').findOne({
        slug: updateData.slug,
        _id: { $ne: new ObjectId(params.id) }
      });

      if (existing) {
        return NextResponse.json({ error: 'Slug already in use' }, { status: 400 });
      }
    }

    updateData.updatedAt = new Date();

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const result = await db.collection('branches').findOneAndUpdate(
      { _id: new ObjectId(params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      branch: result
    });
  } catch (error) {
    console.error('Update branch error:', error);
    return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 });
  }
}

// DELETE - Delete branch (with safety checks)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifySuperAdmin(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const params = await context.params;
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Safety check: Count orders for this branch
    const orderCount = await db.collection('orders').countDocuments({
      branchId: new ObjectId(params.id)
    });

    if (orderCount > 0) {
      return NextResponse.json({ 
        error: `Cannot delete branch with ${orderCount} orders. Please pause instead.`,
        orderCount 
      }, { status: 400 });
    }

    // Safety check: Count products
    const productCount = await db.collection('products').countDocuments({
      branchId: new ObjectId(params.id)
    });

    if (productCount > 0) {
      return NextResponse.json({ 
        error: `Cannot delete branch with ${productCount} products. Please pause instead.`,
        productCount 
      }, { status: 400 });
    }

    // If safe, delete the branch
    await db.collection('branches').deleteOne({
      _id: new ObjectId(params.id)
    });

    // Also delete branch users (admins, pickers)
    await db.collection('users').deleteMany({
      branchId: new ObjectId(params.id)
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete branch error:', error);
    return NextResponse.json({ error: 'Failed to delete branch' }, { status: 500 });
  }
}

// PATCH - Pause/Resume branch
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifySuperAdmin(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const params = await context.params;
    const { status } = await request.json();

    if (!['active', 'paused', 'inactive'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const result = await db.collection('branches').findOneAndUpdate(
      { _id: new ObjectId(params.id) },
      { 
        $set: { 
          status,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      branch: result
    });
  } catch (error) {
    console.error('Pause branch error:', error);
    return NextResponse.json({ error: 'Failed to update branch status' }, { status: 500 });
  }
}