// app/api/orders/[orderId]/item-oos/route.ts
// Called by the picker when they mark an item as out of stock.
// This route:
//   1. Marks the order item as OOS in the DB
//   2. Queues / issues an automatic partial refund via your payment provider
//   3. Creates a stock-take record so the admin team can verify the stock count
//   4. Emits a socket event so the customer tracking screen can react in real time

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyMobileToken } from '@/lib/verify-mobile-token';
import { getIO } from '@/lib/socket';

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    // Auth ------------------------------------------------------------------
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
    if (!mobileUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sku, productId, variantId, scanKey, refundAmount, itemName } = await request.json();
    if (!sku && !productId) {
      return NextResponse.json({ error: 'sku or productId required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    // Find the order --------------------------------------------------------
    const filter = ObjectId.isValid(params.orderId)
      ? { _id: new ObjectId(params.orderId) }
      : { orderNumber: params.orderId };

    const order = await db.collection('orders').findOne(filter);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Find the first un-processed matching item -----------------------------
    const items: any[] = order.items || [];
    const itemIndex = items.findIndex(
      (item: any) =>
        (sku ? item.sku === sku : item.productId?.toString() === productId) &&
        !item.scanned &&
        !item.oos
    );

    if (itemIndex === -1) {
      return NextResponse.json({ success: false, message: 'Item already processed or not found' });
    }

    const oosItem = items[itemIndex];

    // Mark item as OOS in the order ----------------------------------------
    const updatedOrder = await db.collection('orders').findOneAndUpdate(
      { ...filter, [`items.${itemIndex}.oos`]: { $ne: true } },
      {
        $set: {
          [`items.${itemIndex}.oos`]:      true,
          [`items.${itemIndex}.oosAt`]:    new Date(),
          [`items.${itemIndex}.oosBy`]:    mobileUser.userId || mobileUser.id,
          updatedAt:                        new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedOrder) {
      return NextResponse.json({ success: false, message: 'Concurrent update - already marked OOS' });
    }

    const serializedOrder: Record<string, any> = {
      ...updatedOrder,
      _id: updatedOrder._id.toString(),
      id:  updatedOrder._id.toString(),
    };

    // Issue refund (if applicable) -----------------------------------------
    let refundResult: any = null;
    if (refundAmount && refundAmount > 0) {
      try {
        refundResult = await issueRefund({
          db,
          order,
          itemIndex,
          oosItem,
          refundAmount,
          itemName,
        });
      } catch (refundErr) {
        console.error('[item-oos] Refund failed:', refundErr);
        // Non-fatal - log it and continue. Admin can manually process.
        await db.collection('refundFailures').insertOne({
          orderId:     updatedOrder._id.toString(),
          orderNumber: order.orderNumber,
          sku:         oosItem.sku,
          itemName:    itemName || oosItem.name,
          refundAmount,
          error:       String(refundErr),
          createdAt:   new Date(),
        });
      }
    }

    // Create stock-take record for admin verification -----------------------
    let stockTakeId: string | null = null;
    try {
      const productObjectId = ObjectId.isValid(oosItem.productId)
        ? new ObjectId(oosItem.productId)
        : null;

      // Find the product to get current stock info
      const product = productObjectId
        ? await db.collection('products').findOne({ _id: productObjectId })
        : null;

      let expectedStock = product?.stockLevel ?? 0;
      let productName   = product?.name || itemName || oosItem.name;
      let stockSku      = oosItem.sku;

      if (variantId && product?.variants) {
        const variant = product.variants.find((v: any) => v._id === variantId);
        if (variant) {
          expectedStock = variant.stockLevel ?? 0;
          stockSku      = variant.sku || stockSku;
        }
      }

      const stockTake = {
        branchId:             order.branchId,
        productId:            productObjectId,
        variantId:            variantId || undefined,
        productName,
        variantName:          oosItem.variantName || undefined,
        sku:                  stockSku,
        expectedStock,
        countedStock:         0,       // pending verification
        variance:             0,
        status:               'pending',
        // Flag so admin knows this was picker-triggered
        triggeredByOOS:       true,
        triggeredByOrderId:   updatedOrder._id.toString(),
        triggeredByOrderNum:  order.orderNumber,
        scheduledDate:        new Date(),
        notes:                `Auto-created: picker reported OOS on order #${order.orderNumber}`,
        autoScheduleInterval: 'never',
        createdAt:            new Date(),
        updatedAt:            new Date(),
      };

      const stResult = await db.collection('stockTakes').insertOne(stockTake);
      stockTakeId = stResult.insertedId.toString();
    } catch (stErr) {
      console.error('[item-oos] Stock-take creation failed:', stErr);
      // Non-fatal
    }

    // Emit socket events ----------------------------------------------------
    try {
      const io      = getIO();
      const orderId = serializedOrder._id;
      const branchId = order.branchId?.toString();

      if (io) {
        const payload = {
          orderId,
          scanKey,
          sku:          oosItem.sku,
          productId:    oosItem.productId?.toString(),
          name:         itemName || oosItem.name,
          itemIndex,
          refundAmount: refundAmount || 0,
          stockTakeId,
          order:        serializedOrder,
        };

        io.to(`order:${orderId}`).emit('item:oos', payload);
        if (branchId) io.to(`branch:${branchId}`).emit('item:oos', payload);

        console.log(`[Socket] item:oos -> order:${orderId} (${itemName})`);
      }
    } catch (socketErr) {
      console.error('[Socket] item:oos emit error:', socketErr);
    }

    return NextResponse.json({
      success:     true,
      itemIndex,
      stockTakeId,
      refundResult,
      order:       serializedOrder,
    });
  } catch (error: any) {
    console.error('item-oos error:', error);
    return NextResponse.json({ error: 'Failed to process OOS item', details: error.message }, { status: 500 });
  }
}

// Refund helper ------------------------------------------------------------
// Extend this to call your actual payment provider (Paystack, Ozow, etc.)

async function issueRefund({
  db, order, itemIndex, oosItem, refundAmount, itemName,
}: {
  db: any; order: any; itemIndex: number; oosItem: any;
  refundAmount: number; itemName?: string;
}) {
  const paymentRef = order.paymentReference;

  // Log the pending refund regardless
  const refundRecord = {
    orderId:        order._id.toString(),
    orderNumber:    order.orderNumber,
    userId:         order.userId?.toString(),
    customerName:   order.customerInfo?.name,
    customerEmail:  order.customerInfo?.email,
    customerPhone:  order.customerInfo?.phone,
    itemSku:        oosItem.sku,
    itemName:       itemName || oosItem.name,
    refundAmount,
    currency:       'ZAR',
    paymentMethod:  order.paymentMethod,
    paymentRef,
    status:         'pending',
    reason:         'item_out_of_stock',
    createdAt:      new Date(),
    updatedAt:      new Date(),
  };

  const refundDoc = await db.collection('refunds').insertOne(refundRecord);
  const refundId  = refundDoc.insertedId.toString();

  
  
   if (order.paymentMethod === 'paystack' && paymentRef) {
   const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
   const paystackRes = await fetch('https://api.paystack.co/refund', {
    method: 'POST',
     headers: {
       Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         transaction: paymentRef,
         amount: Math.round(refundAmount * 100), // Paystack uses kobo/cents
         merchant_note: `OOS refund for ${itemName || oosItem.sku} on order ${order.orderNumber}`,
       }),
     });
     const paystackData = await paystackRes.json();
     if (!paystackData.status) throw new Error(paystackData.message);
     // Mark refund as processed
     await db.collection('refunds').updateOne(
     { _id: refundDoc.insertedId },
       { $set: { status: 'processed', providerRef: paystackData.data?.id, updatedAt: new Date() } }
    );
    return { refundId, providerRef: paystackData.data?.id };
  }

  // For cash orders or unimplemented providers - mark as manual
  if (order.paymentMethod === 'cash') {
    await db.collection('refunds').updateOne(
      { _id: refundDoc.insertedId },
      { $set: { status: 'manual_required', note: 'Cash order - refund manually at collection/delivery', updatedAt: new Date() } }
    );
  }

  return { refundId, status: 'pending' };
}