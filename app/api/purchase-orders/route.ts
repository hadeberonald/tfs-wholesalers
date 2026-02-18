import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export const dynamic = 'force-dynamic';

async function generatePONumber(db: any, branchId: string) {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  
  const lastPO = await db.collection('purchaseOrders')
    .find({ branchId: new ObjectId(branchId) })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  
  let nextNumber = 1;
  if (lastPO.length > 0 && lastPO[0].orderNumber) {
    const match = lastPO[0].orderNumber.match(/PO-\d{4}-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }
  
  return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const all = searchParams.get('all');
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const query: any = {};
    
    // Only check admin auth if requesting admin data
    if (all === 'true') {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }
      
      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        query.branchId = adminInfo.branchId;
      }
    }
    
    if (status) {
      query.status = status;
    }
    
    const purchaseOrders = await db.collection('purchaseOrders')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    
    return NextResponse.json({ purchaseOrders });
  } catch (error) {
    console.error('Failed to fetch purchase orders:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    if (adminInfo.isSuperAdmin) {
      return NextResponse.json({ 
        error: 'Super admins cannot create purchase orders directly.' 
      }, { status: 403 });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const supplier = await db.collection('suppliers').findOne({
      _id: new ObjectId(body.supplierId),
      branchId: adminInfo.branchId
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const orderNumber = await generatePONumber(db, adminInfo.branchId.toString());

    const purchaseOrder = {
      orderNumber,
      branchId: adminInfo.branchId,
      supplierId: new ObjectId(body.supplierId),
      supplierName: supplier.name,
      supplierEmail: supplier.email,
      items: body.items.map((item: any) => ({
        ...item,
        productId: new ObjectId(item.productId),
        variantId: item.variantId || undefined,
        quantityReceived: 0,
      })),
      subtotal: body.subtotal,
      tax: body.tax || 0,
      total: body.total,
      status: body.status || 'draft',
      notes: body.notes || '',
      expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : null,
      createdBy: adminInfo.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('purchaseOrders').insertOne(purchaseOrder);
    
    console.log('✅ Purchase order created:', orderNumber);
    
    return NextResponse.json({ 
      id: result.insertedId,
      orderNumber 
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create purchase order:', error);
    return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 });
  }
}