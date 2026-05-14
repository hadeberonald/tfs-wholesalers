import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const order = await db.collection('wholesale_purchase_orders').findOne({ _id: new ObjectId(params.id) });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    return NextResponse.json({ order });
  } catch (error) {
    console.error('Failed to fetch order:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('wholesale-orders:write');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const updateData: any = { updatedAt: new Date() };
    if (body.orderStatus) updateData.orderStatus = body.orderStatus;
    if (body.paymentStatus) updateData.paymentStatus = body.paymentStatus;
    if (body.trackingNumber) updateData.trackingNumber = body.trackingNumber;

    const result = await db.collection('wholesale_purchase_orders').updateOne({ _id: new ObjectId(params.id) }, { $set: updateData });
    if (result.matchedCount === 0) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    console.log('✅ Order updated:', params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Failed to update order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
