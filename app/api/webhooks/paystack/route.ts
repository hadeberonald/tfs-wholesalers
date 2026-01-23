import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature found' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Parse webhook data
    const event = JSON.parse(body);

    // Handle different event types
    switch (event.event) {
      case 'charge.success':
        await handleSuccessfulCharge(event.data);
        break;

      case 'charge.failed':
        await handleFailedCharge(event.data);
        break;

      default:
        console.log('Unhandled event type:', event.event);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleSuccessfulCharge(data: any) {
  try {
    // Extract order ID from metadata
    const orderId = data.metadata?.orderId || data.metadata?.custom_fields?.find(
      (field: any) => field.variable_name === 'order_id'
    )?.value;

    if (!orderId) {
      console.error('No order ID found in payment metadata');
      return;
    }

    // Update order in database
    await fetch(`${process.env.NEXTAUTH_URL}/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentStatus: 'paid',
        status: 'processing',
        paymentDetails: {
          reference: data.reference,
          amount: data.amount / 100,
          paidAt: data.paid_at,
          channel: data.channel,
        },
      }),
    });

    // TODO: Send confirmation email to customer
    console.log(`Payment successful for order ${orderId}`);
  } catch (error) {
    console.error('Error handling successful charge:', error);
  }
}

async function handleFailedCharge(data: any) {
  try {
    const orderId = data.metadata?.orderId || data.metadata?.custom_fields?.find(
      (field: any) => field.variable_name === 'order_id'
    )?.value;

    if (!orderId) {
      console.error('No order ID found in payment metadata');
      return;
    }

    // Update order status
    await fetch(`${process.env.NEXTAUTH_URL}/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentStatus: 'failed',
        paymentDetails: {
          reference: data.reference,
          failureReason: data.gateway_response,
        },
      }),
    });

    console.log(`Payment failed for order ${orderId}`);
  } catch (error) {
    console.error('Error handling failed charge:', error);
  }
}