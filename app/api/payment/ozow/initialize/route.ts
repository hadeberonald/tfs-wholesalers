import { NextRequest, NextResponse } from 'next/server';
import { ozowService, generatePaymentReference } from '@/lib/payment';

export async function POST(request: NextRequest) {
  try {
    const { orderId, amount, customer } = await request.json();

    if (!orderId || !amount || !customer) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate unique payment reference
    const transactionReference = generatePaymentReference(`ORDER-${orderId}`);
    const bankReference = `REF-${orderId}-${Date.now()}`;

    // Generate Ozow payment request
    const paymentRequest = await ozowService.generatePaymentRequest({
      amount,
      transactionReference,
      bankReference,
      customer,
      isTest: process.env.NODE_ENV !== 'production', // Use test mode in development
    });

    // Store reference in database
    await fetch(`${process.env.NEXTAUTH_URL}/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentReference: transactionReference,
      }),
    });

    return NextResponse.json({
      success: true,
      paymentUrl: ozowService.getPaymentUrl(),
      paymentRequest,
    });
  } catch (error: any) {
    console.error('Ozow payment initialization error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}