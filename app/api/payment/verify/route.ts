import { NextRequest, NextResponse } from 'next/server';
import { paystackService } from '@/lib/payment';

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
        // Update order status in database
        await fetch(`${process.env.NEXTAUTH_URL}/api/orders/${orderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentStatus: 'paid',
            status: 'processing',
            paymentDetails: {
              reference: data.reference,
              amount: data.amount / 100, // Convert from kobo to rands
              paidAt: data.paid_at,
              channel: data.channel,
            },
          }),
        });
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