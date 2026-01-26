import { NextRequest, NextResponse } from 'next/server';
import { paystackService } from '@/lib/payment';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const { reference } = await request.json();

    if (!reference) {
      return NextResponse.json(
        { error: 'Payment reference is required' },
        { status: 400 }
      );
    }

    // Verify payment with Paystack
    const result = await paystackService.verifyPayment(reference);

    if (result.status && result.data.status === 'success') {
      const { data } = result;

      // Extract order ID from metadata
      const orderId = data.metadata?.orderId || data.metadata?.custom_fields?.find(
        (field: any) => field.variable_name === 'order_id'
      )?.value;

      if (orderId) {
        // Update order status in database directly
        const client = await clientPromise;
        const db = client.db('tfs-wholesalers');
        
        await db.collection('orders').findOneAndUpdate(
          { _id: new ObjectId(orderId) },
          { 
            $set: { 
              paymentStatus: 'paid',
              status: 'processing',
              paymentDetails: {
                reference: data.reference,
                amount: data.amount / 100,
                paidAt: data.paid_at,
                channel: data.channel,
              },
              updatedAt: new Date()
            } 
          }
        );
      }

      return NextResponse.json({
        verified: true,
        orderId,
        amount: data.amount / 100,
        reference: data.reference,
      });
    } else {
      return NextResponse.json(
        { 
          verified: false, 
          error: result.message || 'Payment verification failed' 
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}