import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const all = searchParams.get('all');
    const paymentStatus = searchParams.get('paymentStatus');
    const popStatus = searchParams.get('popStatus');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const query: any = {};

    if (all === 'true') {
      const auth = await requirePermission('wholesale-orders:read');
      if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (!auth.isSuperAdmin && auth.branchId) query.branchId = auth.branchId;
    } else if (customerId) {
      query.customerId = new ObjectId(customerId);
    }

    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (popStatus) query.popStatus = popStatus;

    const orders = await db
      .collection('wholesale_purchase_orders')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Failed to fetch purchase orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const customer = await db
      .collection('wholesale_customers')
      .findOne({ _id: new ObjectId(body.customerId) });

    if (!customer)
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    if (customer.verificationStatus !== 'approved')
      return NextResponse.json({ error: 'Your wholesale account is not yet approved' }, { status: 403 });
    if (!customer.active)
      return NextResponse.json({ error: 'Your wholesale account is suspended' }, { status: 403 });
    if (customer.blockedFromOrdering)
      return NextResponse.json(
        { error: 'Your account has been blocked due to an outstanding overdue balance. Please settle your account before placing new orders.' },
        { status: 403 }
      );

    // Determine payment type
    // paymentType from client: 'paystack' | 'credit' | 'pop'
    const paymentType = body.paymentType ?? 'paystack';

    // Credit customers can only use credit/pop if credit is approved
    if ((paymentType === 'credit' || paymentType === 'pop') && !customer.creditApproved) {
      return NextResponse.json(
        { error: 'Your account is not approved for credit. Please pay via Paystack.' },
        { status: 403 }
      );
    }

    const year = new Date().getFullYear();
    const count = await db.collection('wholesale_purchase_orders').countDocuments();
    const poNumber = `PO-${year}-${String(count + 1).padStart(6, '0')}`;

    const subtotal = body.items.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
    const vatAmount = subtotal * 0.15;
    const total = subtotal + vatAmount + (body.deliveryFee ?? 0);

    // Calculate due date for credit orders
    let dueDate: Date | null = null;
    if (paymentType === 'credit' && customer.netTerms) {
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + customer.netTerms);
    }

    const orderStatus = paymentType === 'paystack' ? 'pending_payment' : 'pending';
    const paymentStatus =
      paymentType === 'paystack' ? 'pending_payment' :
      paymentType === 'pop'     ? 'pending_pop_review' :
      'pending'; // credit: pending until due date

    const order = {
      ...body,
      poNumber,
      customerId: new ObjectId(body.customerId),
      branchId: customer.branchId,
      customerBusinessName: customer.businessName,
      subtotal,
      vatAmount,
      total,
      orderStatus,
      paymentStatus,
      paymentType,
      dueDate,
      paidAt: null,
      popUrl: null,
      popStatus: null,
      paystackReference: null,
      isRecurring: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('wholesale_purchase_orders').insertOne(order);

    // If credit order, increment customer outstanding balance
    if (paymentType === 'credit') {
      await db.collection('wholesale_customers').updateOne(
        { _id: new ObjectId(body.customerId) },
        { $inc: { outstandingBalance: total } }
      );
    }

    console.log('✅ Purchase order created:', poNumber);
    return NextResponse.json(
      { success: true, orderId: result.insertedId.toString(), poNumber },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ Failed to create purchase order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}