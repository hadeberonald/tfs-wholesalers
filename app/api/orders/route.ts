import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { generateOrderNumber } from '../../../lib/utils';

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const orders = await db
      .collection('orders')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const order = {
      orderNumber: generateOrderNumber(),
      ...body,
      paymentStatus: 'pending',
      orderStatus: 'pending',
      deliveryFee: 35,
      subtotal: body.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    order.total = order.subtotal + order.deliveryFee;

    const result = await db.collection('orders').insertOne(order);
    return NextResponse.json({ orderId: result.insertedId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
