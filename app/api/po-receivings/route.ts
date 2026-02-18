import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }
    
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const query: any = {};
    
    if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
      query.branchId = adminInfo.branchId;
    }
    
    const receivings = await db.collection('poReceivings')
      .find(query)
      .sort({ receivedAt: -1 })
      .toArray();
    
    return NextResponse.json({ receivings });
  } catch (error) {
    console.error('Failed to fetch receivings:', error);
    return NextResponse.json({ error: 'Failed to fetch receivings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const purchaseOrder = await db.collection('purchaseOrders').findOne({
      _id: new ObjectId(body.purchaseOrderId),
      branchId: adminInfo.branchId
    });

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (purchaseOrder.status === 'received') {
      return NextResponse.json({ error: 'This PO has already been fully received' }, { status: 400 });
    }

    const receiving = {
      purchaseOrderId: new ObjectId(body.purchaseOrderId),
      orderNumber: purchaseOrder.orderNumber,
      branchId: adminInfo.branchId,
      receivedBy: adminInfo.userId,
      receivedAt: new Date(),
      items: body.items.map((item: any) => ({
        productId: new ObjectId(item.productId),
        variantId: item.variantId || undefined,
        quantityExpected: item.quantityExpected,
        quantityReceived: item.quantityReceived,
        quantityDamaged: item.quantityDamaged || 0,
        notes: item.notes || '',
      })),
      hasIssues: body.items.some((item: any) => 
        item.quantityReceived !== item.quantityExpected || item.quantityDamaged > 0
      ),
      notes: body.notes || '',
    };

    const result = await db.collection('poReceivings').insertOne(receiving);

    // Update stock levels
    for (const item of body.items) {
      const receivedQty = item.quantityReceived - (item.quantityDamaged || 0);
      
      if (receivedQty > 0) {
        if (item.variantId) {
          await db.collection('products').updateOne(
            { 
              _id: new ObjectId(item.productId),
              'variants._id': item.variantId 
            },
            { 
              $inc: { 'variants.$.stockLevel': receivedQty },
              $set: { updatedAt: new Date() }
            }
          );
        } else {
          await db.collection('products').updateOne(
            { _id: new ObjectId(item.productId) },
            { 
              $inc: { stockLevel: receivedQty },
              $set: { updatedAt: new Date() }
            }
          );
        }
      }
    }

    // Update PO
    const updatedItems = purchaseOrder.items.map((poItem: any) => {
      const receivedItem = body.items.find((ri: any) => 
        ri.productId === poItem.productId.toString() &&
        (ri.variantId || null) === (poItem.variantId || null)
      );
      
      if (receivedItem) {
        return {
          ...poItem,
          quantityReceived: (poItem.quantityReceived || 0) + (receivedItem.quantityReceived - (receivedItem.quantityDamaged || 0))
        };
      }
      return poItem;
    });

    const allReceived = updatedItems.every((item: any) => 
      item.quantityReceived >= item.quantityOrdered
    );
    const someReceived = updatedItems.some((item: any) => 
      item.quantityReceived > 0
    );

    const newStatus = allReceived ? 'received' : (someReceived ? 'partially_received' : purchaseOrder.status);

    await db.collection('purchaseOrders').updateOne(
      { _id: new ObjectId(body.purchaseOrderId) },
      { 
        $set: { 
          items: updatedItems,
          status: newStatus,
          updatedAt: new Date()
        } 
      }
    );

    // Create resolution if issues
    if (receiving.hasIssues) {
      const affectedItems = body.items
        .filter((item: any) => 
          item.quantityReceived !== item.quantityExpected || item.quantityDamaged > 0
        )
        .map((item: any) => ({
          productId: new ObjectId(item.productId),
          variantId: item.variantId || undefined,
          productName: item.productName,
          quantity: Math.abs(item.quantityExpected - item.quantityReceived) + (item.quantityDamaged || 0)
        }));

      const resolution = {
        purchaseOrderId: new ObjectId(body.purchaseOrderId),
        orderNumber: purchaseOrder.orderNumber,
        branchId: adminInfo.branchId,
        type: body.items.some((i: any) => i.quantityDamaged > 0) ? 'damaged' : 'missing',
        description: body.notes || 'Discrepancy found during receiving',
        affectedItems,
        status: 'open',
        priority: affectedItems.length > 3 ? 'high' : 'medium',
        createdBy: adminInfo.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('orderResolutions').insertOne(resolution);
    }

    console.log('✅ PO receiving recorded:', purchaseOrder.orderNumber);
    
    return NextResponse.json({ 
      id: result.insertedId,
      hasIssues: receiving.hasIssues 
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to record receiving:', error);
    return NextResponse.json({ error: 'Failed to record receiving' }, { status: 500 });
  }
}