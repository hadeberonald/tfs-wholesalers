import { NextRequest, NextResponse } from 'next/server';
import { ozowService } from '@/lib/payment';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Verify the notification is from Ozow
    const isValid = ozowService.verifyNotification(data);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid notification signature' },
        { status: 400 }
      );
    }

    // Extract order ID from transaction reference
    const transactionRef = data.TransactionReference;
    const orderId = transactionRef.split('-')[1]; // Assuming format: ORDER-{orderId}-{timestamp}-{random}

    // Handle different payment statuses
    switch (data.Status) {
      case 'Complete':
        await handleSuccessfulPayment(orderId, data);
        break;

      case 'Cancelled':
      case 'Error':
        await handleFailedPayment(orderId, data);
        break;

      case 'Pending':
        await handlePendingPayment(orderId, data);
        break;

      default:
        console.log('Unhandled Ozow status:', data.Status);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Ozow webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleSuccessfulPayment(orderId: string, data: any) {
  try {
    await fetch(`${process.env.NEXTAUTH_URL}/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentStatus: 'paid',
        status: 'processing',
        paymentDetails: {
          reference: data.TransactionReference,
          transactionId: data.TransactionId,
          amount: parseFloat(data.Amount),
          paidAt: new Date().toISOString(),
          channel: 'ozow',
        },
      }),
    });

    console.log(`Ozow payment successful for order ${orderId}`);
  } catch (error) {
    console.error('Error handling successful Ozow payment:', error);
  }
}

async function handleFailedPayment(orderId: string, data: any) {
  try {
    await fetch(`${process.env.NEXTAUTH_URL}/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentStatus: 'failed',
        paymentDetails: {
          reference: data.TransactionReference,
          transactionId: data.TransactionId,
          failureReason: data.Status,
        },
      }),
    });

    console.log(`Ozow payment failed for order ${orderId}`);
  } catch (error) {
    console.error('Error handling failed Ozow payment:', error);
  }
}

async function handlePendingPayment(orderId: string, data: any) {
  try {
    await fetch(`${process.env.NEXTAUTH_URL}/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentStatus: 'pending',
        paymentDetails: {
          reference: data.TransactionReference,
          transactionId: data.TransactionId,
        },
      }),
    });

    console.log(`Ozow payment pending for order ${orderId}`);
  } catch (error) {
    console.error('Error handling pending Ozow payment:', error);
  }
}