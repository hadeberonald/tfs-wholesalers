// app/api/orders/[orderId]/scan-item/route.ts
// Called by the picker app every time they scan or manually confirm an item.
// Persists the scanned state to the DB and emits a socket event so the
// customer tracking screen can show per-item picking progress in real time.

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyMobileToken } from '@/lib/verify-mobile-token';
import { getIO } from '@/lib/socket';

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
    if (!mobileUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sku, productId, scanKey } = await request.json();
    if (!sku && !productId) {
      return NextResponse.json({ error: 'sku or productId required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const filter = ObjectId.isValid(params.orderId)
      ? { _id: new ObjectId(params.orderId) }
      : { orderNumber: params.orderId };

    const order = await db.collection('orders').findOne(filter);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Find the first unscanned matching item
    const items: any[] = order.items || [];
    const itemIndex = items.findIndex(
      (item: any) =>
        (sku ? item.sku === sku : item.productId?.toString() === productId) &&
        !item.scanned
    );

    if (itemIndex === -1) {
      return NextResponse.json({ success: false, message: 'Item already scanned or not found' });
    }

    // Mark it scanned in the DB using a positional update
    const updatedOrder = await db.collection('orders').findOneAndUpdate(
      {
        ...filter,
        [`items.${itemIndex}.scanned`]: { $ne: true },
      },
      {
        $set: {
          [`items.${itemIndex}.scanned`]: true,
          [`items.${itemIndex}.scannedAt`]: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedOrder) {
      return NextResponse.json({ success: false, message: 'Concurrent scan — already marked' });
    }

    const serialized: Record<string, any> = {
      ...updatedOrder,
      _id: updatedOrder._id.toString(),
      id:  updatedOrder._id.toString(),
    };

    // ── Emit item:scanned to both the order room and branch room ──────────────
    try {
      const io       = getIO();
      const orderId  = serialized._id;
      const branchId = updatedOrder.branchId?.toString();

      if (io) {
        const itemPayload = {
          orderId,
          scanKey,             // lets the customer UI highlight the specific slot
          sku:       items[itemIndex].sku,
          productId: items[itemIndex].productId?.toString(),
          name:      items[itemIndex].name,
          itemIndex,
          // full updated order so screens can re-render without a re-fetch
          order:     serialized,
          status:    serialized.status,
        };

        // Customer tracking screen listens on this room
        io.to(`order:${orderId}`).emit('item:scanned', itemPayload);
        // Picker app list screen listens on this room (order-level badge counts)
        if (branchId) io.to(`branch:${branchId}`).emit('item:scanned', itemPayload);

        console.log(`[Socket] item:scanned → order:${orderId} (${items[itemIndex].name})`);
      }
    } catch (err) {
      console.error('[Socket] item:scanned emit error:', err);
    }

    return NextResponse.json({ success: true, itemIndex, order: serialized });
  } catch (error: any) {
    console.error('scan-item error:', error);
    return NextResponse.json({ error: 'Failed to scan item', details: error.message }, { status: 500 });
  }
}