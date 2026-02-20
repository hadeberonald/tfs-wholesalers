// app/api/payment/initialize/route.ts
// FIX: After payment succeeds, emit order:new to the branch room
// so the picker app sees the order instantly without any refresh.

import { NextRequest, NextResponse } from 'next/server';
import { paystackService, generatePaymentReference, formatAmountForPayment } from '@/lib/payment';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getIO } from '@/lib/socket';   // ← same wrapper used by the order route

// ─── Helper: notify the picker app that a new order is ready ─────────────────
function emitNewOrder(order: any) {
  try {
    const io = getIO();
    if (!io) {
      console.warn('[Socket] getIO() returned null — server may not be running with custom server.ts');
      return;
    }

    const branchId = order.branchId?.toString();
    if (!branchId) {
      console.warn('[Socket] emitNewOrder: no branchId on order', order._id);
      return;
    }

    const serialized = {
      ...order,
      _id: order._id?.toString(),
      id:  order._id?.toString(),
    };

    // Picker app joins room `branch:<branchId>` on connect
    io.to(`branch:${branchId}`).emit('order:updated', {
      order:  serialized,
      status: serialized.status,
    });

    // Also emit to the order's own room (customer tracking screens join this)
    io.to(`order:${serialized._id}`).emit('order:updated', {
      order:  serialized,
      status: serialized.status,
    });

    console.log(`[Socket] Emitted order:updated (new order) → branch:${branchId} + order:${serialized._id}`);
  } catch (err) {
    console.error('[Socket] emitNewOrder error:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orderId, email, amount, authorizationCode } = await request.json();

    if (!orderId || !email || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const reference = generatePaymentReference(`ORDER-${orderId}`);

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    // ── Saved card: charge immediately ────────────────────────────────────────
    if (authorizationCode) {
      try {
        const chargeData = {
          email,
          amount: formatAmountForPayment(amount),
          authorization_code: authorizationCode,
          currency: 'ZAR',
          reference,
          metadata: {
            orderId,
            custom_fields: [{ display_name: 'Order ID', variable_name: 'order_id', value: orderId }],
          },
        };

        const response = await fetch('https://api.paystack.co/transaction/charge_authorization', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chargeData),
        });

        const result = await response.json();

        if (result.status && result.data.status === 'success') {
          // Update order and fetch the full document to emit
          const updated = await db.collection('orders').findOneAndUpdate(
            { _id: new ObjectId(orderId) },
            {
              $set: {
                paymentReference: reference,
                paymentStatus:    'paid',
                status:           'confirmed',   // FIX: was 'processing' — picker expects 'confirmed'
                updatedAt:        new Date(),
              },
            },
            { returnDocument: 'after' }  // ← get the updated doc back
          );

          if (updated) {
            emitNewOrder(updated);  // 🔴 THE CRITICAL MISSING CALL
          }

          return NextResponse.json({
            success: true,
            charged: true,
            reference,
            publicKey: paystackService.getPublicKey(),
          });
        } else {
          throw new Error(result.message || 'Charge failed');
        }
      } catch (error: any) {
        console.error('Charge authorization error:', error);
        return NextResponse.json({ error: error.message || 'Failed to charge saved card' }, { status: 400 });
      }
    }

    // ── New card: initialize payment (webhook will fire on success) ───────────
    const paymentData = {
      email,
      amount:       formatAmountForPayment(amount),
      currency:     'ZAR',
      reference,
      callback_url: `${process.env.NEXTAUTH_URL}/api/payment/callback`,
      metadata: {
        orderId,
        custom_fields: [{ display_name: 'Order ID', variable_name: 'order_id', value: orderId }],
      },
    };

    const result = await paystackService.initializePayment(paymentData);

    if (result.status) {
      await db.collection('orders').findOneAndUpdate(
        { _id: new ObjectId(orderId) },
        { $set: { paymentReference: reference, updatedAt: new Date() } }
      );

      return NextResponse.json({
        success:           true,
        charged:           false,
        reference,
        authorization_url: result.data.authorization_url,
        access_code:       result.data.access_code,
        publicKey:         paystackService.getPublicKey(),
      });
    } else {
      return NextResponse.json({ error: result.message || 'Payment initialization failed' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Payment initialization error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}