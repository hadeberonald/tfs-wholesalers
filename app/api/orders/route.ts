// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';
import { verifyMobileToken } from '@/lib/verify-mobile-token';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId  = searchParams.get('userId');
    const all     = searchParams.get('all');
    const picking = searchParams.get('picking'); // ordersStore.fetchOrders sends this

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const query: any = {};

    // ── Picker / delivery app (Bearer token) ─────────────────────────────────
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
      if (!mobileUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Scope to picker's active branch — DB has the latest value after set-branch
      if (mobileUser.activeBranchId) {
        try {
          query.branchId = new ObjectId(mobileUser.activeBranchId);
        } catch {
          query.branchId = mobileUser.activeBranchId;
        }
      }

      // What statuses are relevant to the picker queue
      if (picking === 'true') {
        query.status = {
          $in: ['pending', 'confirmed', 'picking', 'packaging', 'collecting', 'ready_for_delivery'],
        };
      } else {
        // ?all=true from OrdersListScreen — exclude terminal + payment statuses
        query.status = {
          $nin: ['payment_pending', 'payment_failed', 'out_for_delivery', 'delivered'],
        };
      }

      const orders = await db.collection('orders')
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      return NextResponse.json({
        orders: orders.map(o => ({ ...o, _id: o._id.toString() })),
      });
    }

    // ── Admin dashboard (session cookie) ────────────────────────────────────
    if (all === 'true') {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }
      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        query.branchId = adminInfo.branchId;
      }
    } else if (userId) {
      // Customer app — their own orders only
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
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    if (!body.branchId) {
      return NextResponse.json({ error: 'Branch ID is required' }, { status: 400 });
    }

    // Enrich order items with product/variant data including barcodes
    const enrichedItems = await Promise.all(
      body.items.map(async (item: any) => {
        try {
          const product = await db.collection('products').findOne({
            _id: new ObjectId(item.productId),
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
                sku:         variant.sku || item.sku,
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
            name:        product.name || item.name,
            sku:         product.sku  || item.sku,
            price:       item.price,
            quantity:    item.quantity,
            image:       product.images?.[0] || item.image || '',
            barcode:     product.barcode || undefined,
            description: product.description || undefined,
          };
        } catch (error) {
          console.error(`❌ Error enriching item ${item.productId}:`, error);
          return item;
        }
      })
    );

    const order = {
      ...body,
      items:       enrichedItems,
      branchId:    new ObjectId(body.branchId),
      orderNumber: `ORD-${Date.now()}`,
      createdAt:   new Date(),
      updatedAt:   new Date(),
    };

    const result = await db.collection('orders').insertOne(order);

    console.log('✅ Order created:', result.insertedId.toString());
    console.log(`   Branch: ${body.branchId}`);
    console.log(`   ${enrichedItems.filter((i: any) => i.barcode).length}/${enrichedItems.length} items have barcodes`);

    return NextResponse.json({
      success: true,
      orderId:     result.insertedId.toString(),
      orderNumber: order.orderNumber,
    }, { status: 201 });
  } catch (error) {
    console.error('❌ Failed to create order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}