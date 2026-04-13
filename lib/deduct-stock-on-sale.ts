/**
 * lib/deduct-stock-on-sale.ts
 *
 * Call this after a customer order is confirmed/paid.
 * Deducts sold quantities from product stock and writes
 * online_sale entries to the stockLedger collection.
 *
 * Usage in app/api/orders/route.ts POST, after insertOne:
 *
 *   import { deductStockOnSale } from '@/lib/deduct-stock-on-sale';
 *   await deductStockOnSale(db, { ...order, _id: result.insertedId });
 */

import { Db, ObjectId } from 'mongodb';

interface OrderItem {
  productId:   string;
  variantId?:  string;
  name?:       string;
  sku?:        string;
  quantity:    number;
}

interface Order {
  _id?:         any;
  orderNumber?: string;
  branchId:     any;
  items:        OrderItem[];
}

export async function deductStockOnSale(db: Db, order: Order): Promise<void> {
  const branchId    = order.branchId;
  const orderId     = order._id;
  const orderNumber = order.orderNumber || orderId?.toString();
  const now         = new Date();

  for (const item of order.items) {
    try {
      if (!item.productId || !ObjectId.isValid(item.productId)) continue;

      const productOid = new ObjectId(item.productId);
      const product    = await db.collection('products').findOne({ _id: productOid });

      if (!product) {
        console.warn(`[StockDeduct] Product not found: ${item.productId}`);
        continue;
      }

      const deductQty = item.quantity;
      let previousStock: number;
      let newStock:      number;
      let sku:           string;

      if (item.variantId && product.variants?.length > 0) {
        const variant = product.variants.find((v: any) => v._id === item.variantId);
        if (!variant) {
          console.warn(`[StockDeduct] Variant ${item.variantId} not found on ${product.name}`);
          continue;
        }
        previousStock = variant.stockLevel ?? 0;
        newStock      = Math.max(0, previousStock - deductQty);
        sku           = variant.sku || product.sku;

        await db.collection('products').updateOne(
          { _id: productOid, 'variants._id': item.variantId },
          { $set: { 'variants.$.stockLevel': newStock, updatedAt: now } },
        );
      } else {
        previousStock = product.stockLevel ?? 0;
        newStock      = Math.max(0, previousStock - deductQty);
        sku           = product.sku;

        await db.collection('products').updateOne(
          { _id: productOid },
          { $set: { stockLevel: newStock, updatedAt: now } },
        );
      }

      await db.collection('stockLedger').insertOne({
        branchId,
        productId:    productOid,
        variantId:    item.variantId || undefined,
        productName:  product.name,
        sku,
        eventType:    'online_sale',
        previousStock,
        newStock,
        delta:        -deductQty,
        orderId:      orderId ? new ObjectId(orderId.toString()) : undefined,
        orderNumber,
        source:       'order_fulfillment',
        notes:        `Sold ${deductQty}× on order ${orderNumber}`,
        createdAt:    now,
      });

      console.log(
        `[StockDeduct] ${product.name}${item.variantId ? ` (${item.variantId})` : ''}: ` +
        `${previousStock} → ${newStock} (−${deductQty})`,
      );

    } catch (err: any) {
      // Non-fatal — a stock deduction failure must never block the order
      console.error(`[StockDeduct] Error on ${item.productId}:`, err.message);
    }
  }
}