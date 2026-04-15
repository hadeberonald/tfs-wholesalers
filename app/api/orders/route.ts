// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';
import { verifyMobileToken } from '@/lib/verify-mobile-token';
import {
  notifyBranchPickers,
  buildOrderConfirmationEmail,
  sendTransactionalEmail,
} from '@/lib/sendPushNotification';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId  = searchParams.get('userId');
    const all     = searchParams.get('all');
    const picking = searchParams.get('picking');

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');
    const query: any = {};

    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
      if (!mobileUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (mobileUser.activeBranchId) {
        try { query.branchId = new ObjectId(mobileUser.activeBranchId); }
        catch { query.branchId = mobileUser.activeBranchId; }
      }

      query.status = picking === 'true'
        ? { $in: ['pending', 'confirmed', 'picking', 'packaging', 'collecting', 'ready_for_delivery'] }
        : { $nin: ['payment_pending', 'payment_failed', 'out_for_delivery', 'delivered'] };

      const orders = await db.collection('orders')
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      return NextResponse.json({
        orders: orders.map(o => ({ ...o, _id: o._id.toString() })),
      });
    }

    if (all === 'true') {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }
      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        query.branchId = adminInfo.branchId;
      }
    } else if (userId) {
      query.userId = userId;
    }

    const orders = await db.collection('orders')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body   = await request.json();
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    if (!body.branchId) {
      return NextResponse.json({ error: 'Branch ID is required' }, { status: 400 });
    }

    const enrichedItems = await Promise.all(
      body.items.map(async (item: any) => {
        try {
          const product = await db.collection('products').findOne({
            _id:      new ObjectId(item.productId),
            branchId: new ObjectId(body.branchId),
          });

          if (!product) {
            console.warn(`⚠️ Product not found: ${item.productId}, using cart data`);
            return item;
          }

          if (item.variantId && product.variants?.length > 0) {
            const variant = product.variants.find((v: any) => v._id === item.variantId);
            if (variant) {
              return {
                productId:   item.productId,
                variantId:   item.variantId,
                name:        product.name,
                variantName: variant.name,
                sku:         variant.sku    || item.sku,
                price:       item.price,
                quantity:    item.quantity,
                image:       variant.images?.[0] || product.images?.[0] || item.image || '',
                barcode:     variant.barcode || undefined,
                description: `${product.description || ''} - ${variant.name}`.trim(),
              };
            }
          }

          return {
            productId:   item.productId,
            name:        product.name        || item.name,
            sku:         product.sku         || item.sku,
            price:       item.price,
            quantity:    item.quantity,
            image:       product.images?.[0] || item.image || '',
            barcode:     product.barcode     || undefined,
            description: product.description || undefined,
          };
        } catch (error) {
          console.error(`❌ Error enriching item ${item.productId}:`, error);
          return item;
        }
      })
    );

    const orderNumber = `ORD-${Date.now()}`;
    const order = {
      ...body,
      items:       enrichedItems,
      branchId:    new ObjectId(body.branchId),
      orderNumber,
      status:      body.status ?? 'pending',
      createdAt:   new Date(),
      updatedAt:   new Date(),
      // These are stored explicitly so the PATCH route can read them back
      // for status-update emails without having to fetch the user separately
      customerName:    body.customerName    ?? null,
      customerEmail:   body.customerEmail   ?? null,
      deliveryAddress: body.deliveryAddress ?? null,
    };

    const result  = await db.collection('orders').insertOne(order);
    const orderId = result.insertedId.toString();
    console.log('✅ Order created:', orderId);

    // ── Notify branch pickers (push) — fire and forget ─────────────────────
    notifyBranchPickers(body.branchId, {
      title: '🛒 New Order',
      body:  `Order ${orderNumber} is ready to pick — ${enrichedItems.length} item(s)`,
      data:  { type: 'new_order', orderId, orderNumber },
    }).catch(() => {});

    // ── Confirm to customer (email) — fire and forget ──────────────────────
    if (body.customerEmail) {
      const emailPayload = buildOrderConfirmationEmail({
        orderNumber,
        customerName:    body.customerName    ?? 'Customer',
        customerEmail:   body.customerEmail,
        items:           enrichedItems,
        total:           body.total           ?? 0,
        deliveryAddress: body.deliveryAddress ?? undefined,
      });
      sendTransactionalEmail(emailPayload).catch(() => {});
    }

    return NextResponse.json({ success: true, orderId, orderNumber }, { status: 201 });
  } catch (error) {
    console.error('❌ Failed to create order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}