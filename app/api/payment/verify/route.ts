// app/api/payment/verify/route.ts
// Verifies a Paystack payment reference, marks the order paid/confirmed,
// and emits a socket event so the picker app sees the new order instantly.

import { NextRequest, NextResponse } from 'next/server';
import { paystackService } from '@/lib/payment';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getIO } from '@/lib/socket';

function emitNewOrder(order: any) {
  try {
    const io = getIO();
    if (!io) {
      console.warn('[Socket] getIO() returned null in verify route');
      return;
    }
    const branchId   = order.branchId?.toString();
    const serialized = { ...order, _id: order._id?.toString(), id: order._id?.toString() };
    const payload    = { order: serialized, status: serialized.status };

    // Picker app listens on branch room
    if (branchId) io.to(`branch:${branchId}`).emit('order:updated', payload);

    // Customer tracking screen listens on order room
    io.to(`order:${serialized._id}`).emit('order:updated', payload);

    console.log(`[Socket] verify → branch:${branchId} + order:${serialized._id}`);
  } catch (err) {
    console.error('[Socket] verify emit error:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { reference } = await request.json();

    if (!reference) {
      return NextResponse.json({ error: 'Payment reference is required' }, { status: 400 });
    }

    const result = await paystackService.verifyPayment(reference);

    if (result.status && result.data.status === 'success') {
      const { data } = result;

      const orderId = data.metadata?.orderId ||
        data.metadata?.custom_fields?.find(
          (field: any) => field.variable_name === 'order_id'
        )?.value;

      if (orderId) {
        const client = await clientPromise;
        const db     = client.db('tfs-wholesalers');

        const updated = await db.collection('orders').findOneAndUpdate(
          { _id: new ObjectId(orderId) },
          {
            $set: {
              paymentStatus: 'paid',
              status:        'confirmed',   // FIX: was 'processing' — picker watches for 'confirmed'
              paymentDetails: {
                reference: data.reference,
                amount:    data.amount / 100,
                paidAt:    data.paid_at,
                channel:   data.channel,
              },
              updatedAt: new Date(),
            },
          },
          { returnDocument: 'after' }   // FIX: was missing — need the doc to emit
        );

        if (updated) {
          emitNewOrder(updated);  // 🔴 THE CRITICAL MISSING CALL
        }
      }

      return NextResponse.json({
        verified:  true,
        orderId,
        amount:    data.amount / 100,
        reference: data.reference,
      });
    } else {
      return NextResponse.json(
        { verified: false, error: result.message || 'Payment verification failed' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}