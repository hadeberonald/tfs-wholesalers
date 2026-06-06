import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';
import { verifyMobileToken } from '@/lib/verify-mobile-token';
import {
  notifyBranchPickers,
  buildOrderConfirmationEmail,
  buildInternalReceiptEmail,
  sendTransactionalEmail,
} from '@/lib/sendPushNotification';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId        = searchParams.get('userId');
    const all           = searchParams.get('all');
    const picking       = searchParams.get('picking');
    const needsNpsReview = searchParams.get('needsNpsReview') === 'true';

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');
    const query: any = {};

    const authHeader = request.headers.get('authorization') || '';

    // ── Staff / picker app — Bearer token ────────────────────────────────────
    // This branch handles the picker/driver app. It is NOT used for the
    // customer needsNpsReview poll — that goes through the userId branch below,
    // which now also accepts Bearer tokens from the customer app.
    if (authHeader.startsWith('Bearer ') && !userId) {
      const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
      if (!mobileUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      if (mobileUser.activeBranchId) {
        try { query.branchId = new ObjectId(mobileUser.activeBranchId); } catch { query.branchId = mobileUser.activeBranchId; }
      }

      query.status = picking === 'true'
        ? { $in: ['pending', 'confirmed', 'picking', 'packaging', 'collecting', 'ready_for_delivery'] }
        : { $nin: ['payment_pending', 'payment_failed', 'out_for_delivery', 'delivered'] };

      const orders = await db.collection('orders').find(query).sort({ createdAt: -1 }).toArray();
      return NextResponse.json({ orders: orders.map(o => ({ ...o, _id: o._id.toString() })) });
    }

    // ── Admin — fetch all orders ──────────────────────────────────────────────
    if (all === 'true') {
      const auth = await requirePermission('orders:read');
      if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (!auth.isSuperAdmin && auth.branchId) query.branchId = auth.branchId;
    }

    // ── Customer app — fetch orders by userId ─────────────────────────────────
    // Accepts both cookie auth (web) and Bearer token (mobile customer app).
    // The needsNpsReview flag is only valid in this branch.
    else if (userId) {
      if (authHeader.startsWith('Bearer ')) {
        // Customer mobile app sends Bearer token
        const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
        if (!mobileUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // Verify the token belongs to the userId being requested
        if (mobileUser.id !== userId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } else {
        // Web — cookie auth
        const cookieStore = await cookies();
        const token = cookieStore.get('auth-token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        try {
          const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as any;
          if (decoded.userId !== userId) {
            // Not their own orders — require admin permission
            const auth = await requirePermission('orders:read');
            if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
          }
        } catch {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }

      query.userId = userId;

      // ── needsNpsReview: return delivered orders with no NPS response ────────
      // Used by the customer app on launch/foreground to detect orders that
      // need a review even when the push notification was swiped away.
      if (needsNpsReview) {
        query.status = 'delivered';

        const deliveredOrders = await db.collection('orders')
          .find(query)
          .sort({ updatedAt: -1 })
          .limit(10)
          .toArray();

        if (!deliveredOrders.length) {
          return NextResponse.json({ orders: [] });
        }

        // Cross-reference against nps_delivery_responses to exclude
        // orders the customer has already reviewed
        const orderIds = deliveredOrders.map(o => o._id.toString());
        const alreadyReviewed = await db.collection('nps_delivery_responses')
          .find(
            { orderId: { $in: orderIds } },
            { projection: { orderId: 1 } }
          )
          .toArray();

        const reviewedSet = new Set(alreadyReviewed.map(r => r.orderId));
        const unreviewed  = deliveredOrders.filter(o => !reviewedSet.has(o._id.toString()));

        return NextResponse.json({
          orders: unreviewed.map(o => ({
            ...o,
            _id:       o._id.toString(),
            branchSlug: o.branchSlug ?? '',
          })),
        });
      }
    }

    const orders = await db.collection('orders').find(query).sort({ createdAt: -1 }).toArray();
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

    if (!body.branchId) return NextResponse.json({ error: 'Branch ID is required' }, { status: 400 });

    const customerName    = body.customerName  || body.customerInfo?.name  || null;
    const customerEmail   = body.customerEmail || body.customerInfo?.email || null;
    const customerPhone   = body.phone         || body.customerInfo?.phone || null;
    const deliveryAddress = body.deliveryAddress || body.shippingAddress?.address || null;
    const deliveryFee     = body.deliveryFee ?? 0;

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

    // Resolve branch name and slug for the internal receipt and NPS (best-effort)
    let branchName: string | undefined;
    let branchSlug: string | undefined;
    try {
      const branchDoc = await db.collection('branches').findOne(
        { _id: new ObjectId(body.branchId) },
        { projection: { displayName: 1, name: 1, slug: 1 } }
      );
      branchName = branchDoc?.displayName || branchDoc?.name || undefined;
      branchSlug = branchDoc?.slug || undefined;
    } catch { /* non-critical */ }

    // Look up till account number by customer email + branch
    let tillAccountNumber: string | null = null;
    if (customerEmail) {
      try {
        const branchOid = new ObjectId(body.branchId);
        const customerRecord = await db.collection('online_customers').findOne({
          email: customerEmail.toLowerCase(),
          $or: [
            { branchId: branchOid },
            { branchId: body.branchId.toString() },
          ],
        });
        tillAccountNumber = customerRecord?.tillAccountNumber ?? null;
      } catch (e) {
        console.warn('[Orders] Till account lookup failed (non-critical):', e);
      }
    }

    const orderNumber = `ORD-${Date.now()}`;
    const orderStatus = body.status ?? 'pending';
    const order = {
      ...body,
      items:             enrichedItems,
      branchId:          new ObjectId(body.branchId),
      // Store branchSlug on the order so it's available for NPS polling
      // without a second DB lookup. Safe to overwrite the caller-supplied
      // value since we just fetched it from the authoritative branches collection.
      branchSlug:        branchSlug ?? body.branchSlug ?? '',
      orderNumber,
      status:            orderStatus,
      deliveryFee,
      tillAccountNumber,
      createdAt:         new Date(),
      updatedAt:         new Date(),
      customerName,
      customerEmail,
      phone:             customerPhone,
      deliveryAddress,
    };

    const result  = await db.collection('orders').insertOne(order);
    const orderId = result.insertedId.toString();
    console.log('✅ Order created:', orderId, '| customer:', customerEmail ?? 'guest', '| till:', tillAccountNumber ?? 'none', '| status:', orderStatus);

    notifyBranchPickers(body.branchId, {
      title: '🛒 New Order',
      body:  `Order ${orderNumber} is ready to pick — ${enrichedItems.length} item(s)`,
      data:  { type: 'new_order', orderId, orderNumber },
    }).catch(() => {});

    const isPaid = !['payment_pending', 'payment_failed'].includes(orderStatus);

    if (customerEmail && isPaid) {
      const customerEmailPayload = buildOrderConfirmationEmail({
        orderNumber,
        customerName:      customerName ?? 'Customer',
        customerEmail,
        items:             enrichedItems,
        total:             body.total ?? 0,
        deliveryFee,
        deliveryAddress:   deliveryAddress ?? undefined,
        tillAccountNumber: tillAccountNumber ?? undefined,
      });
      sendTransactionalEmail(customerEmailPayload).catch(() => {});
    }

    const internalReceiptPayload = buildInternalReceiptEmail({
      orderNumber,
      customerName:      customerName  ?? 'Unknown Customer',
      customerEmail:     customerEmail ?? '(no email provided)',
      phone:             customerPhone  ?? undefined,
      items:             enrichedItems,
      total:             body.total ?? 0,
      deliveryFee,
      deliveryAddress:   deliveryAddress ?? undefined,
      branchName,
      tillAccountNumber: tillAccountNumber ?? undefined,
    });
    sendTransactionalEmail(internalReceiptPayload).catch(() => {});

    return NextResponse.json({ success: true, orderId, orderNumber }, { status: 201 });
  } catch (error) {
    console.error('❌ Failed to create order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}