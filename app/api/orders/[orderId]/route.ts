import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    console.log('🔍 Fetching order:', params.orderId);
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    let order;
    
    if (ObjectId.isValid(params.orderId)) {
      order = await db.collection('orders').findOne({
        _id: new ObjectId(params.orderId)
      });
    }
    
    if (!order) {
      order = await db.collection('orders').findOne({
        orderNumber: params.orderId
      });
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const orderData = {
      ...order,
      _id: order._id.toString(),
      id: order._id.toString(),
    };

    return NextResponse.json({ order: orderData });
  } catch (error: any) {
    console.error('❌ Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const updates = await request.json();
    console.log('📝 Updating order:', params.orderId);
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // ✅ Verify order belongs to admin's branch
    let order;
    if (ObjectId.isValid(params.orderId)) {
      order = await db.collection('orders').findOne({
        _id: new ObjectId(params.orderId)
      });
    } else {
      order = await db.collection('orders').findOne({
        orderNumber: params.orderId
      });
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (!adminInfo.isSuperAdmin && order.branchId.toString() !== adminInfo.branchId.toString()) {
      return NextResponse.json(
        { error: 'Not authorized to update this order' },
        { status: 403 }
      );
    }

    delete updates._id;
    delete updates.id;
    delete updates.branchId; // Don't allow changing branch

    let result;

    if (ObjectId.isValid(params.orderId)) {
      result = await db.collection('orders').findOneAndUpdate(
        { _id: new ObjectId(params.orderId) },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
    } else {
      result = await db.collection('orders').findOneAndUpdate(
        { orderNumber: params.orderId },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    console.log('✅ Order updated successfully');

    return NextResponse.json({
      success: true,
      order: {
        ...result,
        _id: result._id.toString(),
        id: result._id.toString(),
      }
    });
  } catch (error: any) {
    console.error('❌ Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  return PUT(request, { params });
}