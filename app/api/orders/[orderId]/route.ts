import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/orders/[orderId]
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    console.log('🔍 Fetching order:', params.orderId);
    console.log('⏳ Connecting to MongoDB...');
    
    const client = await clientPromise;
    console.log('✅ MongoDB connected');
    
    const db = client.db('tfs-wholesalers');
    console.log('📊 Using database: tfs-wholesalers');

    // Try to fetch by ObjectId first (MongoDB _id)
    let order;
    
    if (ObjectId.isValid(params.orderId)) {
      console.log('🔎 Searching by ObjectId...');
      order = await db.collection('orders').findOne({
        _id: new ObjectId(params.orderId)
      });
      console.log(order ? '✅ Found by ObjectId' : '❌ Not found by ObjectId');
    }
    
    // If not found, try searching by orderNumber field
    if (!order) {
      console.log('🔎 Searching by orderNumber...');
      order = await db.collection('orders').findOne({
        orderNumber: params.orderId
      });
      console.log(order ? '✅ Found by orderNumber' : '❌ Not found by orderNumber');
    }

    if (!order) {
      console.log('❌ Order not found after all search attempts');
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    console.log('✅ Order retrieved successfully');

    // Convert MongoDB _id to string for JSON serialization
    const orderData = {
      ...order,
      _id: order._id.toString(),
      id: order._id.toString(),
    };

    return NextResponse.json({
      order: orderData
    });
  } catch (error: any) {
    console.error('❌ Error fetching order:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to fetch order';
    let statusCode = 500;
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      errorMessage = 'Database connection failed. Please check your MongoDB connection string.';
      console.error('💡 Tip: Check your MONGODB_URI environment variable and MongoDB Atlas network settings');
    } else if (error.message.includes('authentication')) {
      errorMessage = 'Database authentication failed';
      console.error('💡 Tip: Check your MongoDB username and password');
    }
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: error.message,
        orderId: params.orderId 
      },
      { status: statusCode }
    );
  }
}

// PATCH /api/orders/[orderId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const updates = await request.json();
    console.log('📝 Updating order:', params.orderId);
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Remove fields that shouldn't be updated
    delete updates._id;
    delete updates.id;

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
      orderId: params.orderId,
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