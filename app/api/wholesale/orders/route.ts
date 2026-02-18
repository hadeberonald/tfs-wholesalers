import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const all = searchParams.get('all'); // Admin
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const query: any = {};
    
    if (all === 'true') {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }
      
      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        query.branchId = adminInfo.branchId;
      }
    } else if (customerId) {
      query.customerId = new ObjectId(customerId);
    }
    
    const orders = await db.collection('wholesale_purchase_orders')
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

    // Validate customer exists and is approved
    const customer = await db.collection('wholesale_customers').findOne({
      _id: new ObjectId(body.customerId)
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (customer.verificationStatus !== 'approved') {
      return NextResponse.json({ 
        error: 'Your wholesale account is not yet approved' 
      }, { status: 403 });
    }

    if (!customer.active) {
      return NextResponse.json({ 
        error: 'Your wholesale account is suspended' 
      }, { status: 403 });
    }

    // Generate PO number
    const year = new Date().getFullYear();
    const count = await db.collection('wholesale_purchase_orders').countDocuments();
    const poNumber = `PO-${year}-${String(count + 1).padStart(6, '0')}`;

    // Calculate totals
    const subtotal = body.items.reduce((sum: number, item: any) => 
      sum + item.totalPrice, 0
    );
    
    const vatAmount = subtotal * 0.15; // 15% VAT
    const total = subtotal + vatAmount + (body.deliveryFee || 0);

    const order = {
      ...body,
      poNumber,
      customerId: new ObjectId(body.customerId),
      branchId: customer.branchId,
      customerBusinessName: customer.businessName,
      subtotal,
      vatAmount,
      total,
      orderStatus: 'pending',
      paymentStatus: 'pending',
      isRecurring: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('wholesale_purchase_orders').insertOne(order);
    
    console.log('✅ Purchase order created:', poNumber);
    
    return NextResponse.json({ 
      success: true,
      orderId: result.insertedId.toString(),
      poNumber
    }, { status: 201 });
  } catch (error) {
    console.error('❌ Failed to create purchase order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}