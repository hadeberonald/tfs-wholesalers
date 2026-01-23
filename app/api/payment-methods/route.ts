import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const paymentMethods = await db.collection('payment_methods')
      .find({ userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    console.error('Failed to fetch payment methods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, authorizationCode, cardNumber, cardType, expiryMonth, expiryYear, bin, last4, bank } = body;

    if (!userId || !authorizationCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Check if this is the first card (make it default)
    const existingCards = await db.collection('payment_methods')
      .countDocuments({ userId });

    const paymentMethod = {
      userId,
      authorizationCode, // Paystack authorization code for charging
      cardNumber: `**** **** **** ${last4}`,
      cardType,
      expiryDate: `${expiryMonth}/${expiryYear}`,
      bin,
      last4,
      bank,
      isDefault: existingCards === 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('payment_methods').insertOne(paymentMethod);

    return NextResponse.json({
      success: true,
      paymentMethodId: result.insertedId.toString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to save payment method:', error);
    return NextResponse.json(
      { error: 'Failed to save payment method' },
      { status: 500 }
    );
  }
}