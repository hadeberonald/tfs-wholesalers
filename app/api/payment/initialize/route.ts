import { NextRequest, NextResponse } from 'next/server';
import { paystackService, generatePaymentReference, formatAmountForPayment } from '@/lib/payment';

export async function POST(request: NextRequest) {
  try {
    const { orderId, email, amount, authorizationCode } = await request.json();

    if (!orderId || !email || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate unique payment reference
    const reference = generatePaymentReference(`ORDER-${orderId}`);

    // If using saved card, charge directly
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
            custom_fields: [
              {
                display_name: 'Order ID',
                variable_name: 'order_id',
                value: orderId,
              },
            ],
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
          // Update order status immediately
          await fetch(`${process.env.NEXTAUTH_URL}/api/orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentReference: reference,
              paymentStatus: 'paid',
              status: 'processing',
            }),
          });

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
        return NextResponse.json(
          { error: error.message || 'Failed to charge saved card' },
          { status: 400 }
        );
      }
    }

    // For new cards, initialize standard payment
    const paymentData = {
      email,
      amount: formatAmountForPayment(amount),
      currency: 'ZAR',
      reference,
      callback_url: `${process.env.NEXTAUTH_URL}/api/payment/callback`,
      metadata: {
        orderId,
        custom_fields: [
          {
            display_name: 'Order ID',
            variable_name: 'order_id',
            value: orderId,
          },
        ],
      },
    };

    const result = await paystackService.initializePayment(paymentData);

    if (result.status) {
      // Store reference in database for verification later
      await fetch(`${process.env.NEXTAUTH_URL}/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentReference: reference,
        }),
      });

      return NextResponse.json({
        success: true,
        charged: false,
        reference,
        authorization_url: result.data.authorization_url,
        access_code: result.data.access_code,
        publicKey: paystackService.getPublicKey(),
      });
    } else {
      return NextResponse.json(
        { error: result.message || 'Payment initialization failed' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Payment initialization error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}