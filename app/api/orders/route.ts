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
    const userId  = searchParams.get('userId');
    const all     = searchParams.get('all');
    const picking = searchParams.get('picking');

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');
    const query: any = {};

    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
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

    if (all === 'true') {
      const auth = await requirePermission('orders:read');
      if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (!auth.isSuperAdmin && auth.branchId) query.branchId = auth.branchId;
    } else if (userId) {
      // SECURITY: verify the caller is authenticated and owns this userId,
      // or has admin-level orders:read permission.
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
      query.userId = userId;
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

    // Resolve branch name for the internal receipt (best-effort)
    let branchName: string | undefined;
    try {
      const branchDoc = await db.collection('branches').findOne(
        { _id: new ObjectId(body.branchId) },
        { projection: { displayName: 1, name: 1 } }
      );
      branchName = branchDoc?.displayName || branchDoc?.name || undefined;
    } catch { /* non-critical */ }

    const orderNumber = `ORD-${Date.now()}`;
    const order = {
      ...body,
      items:         enrichedItems,
      branchId:      new ObjectId(body.branchId),
      orderNumber,
      status:        body.status ?? 'pending',
      createdAt:     new Date(),
      updatedAt:     new Date(),
      customerName,
      customerEmail,
      phone:         customerPhone,
      deliveryAddress,
    };

    const result  = await db.collection('orders').insertOne(order);
    const orderId = result.insertedId.toString();
    console.log('✅ Order created:', orderId, '| customer:', customerEmail ?? 'guest');

    // ── Notify branch pickers (staff app only) ────────────────────────────
    notifyBranchPickers(body.branchId, {
      title: '🛒 New Order',
      body:  `Order ${orderNumber} is ready to pick — ${enrichedItems.length} item(s)`,
      data:  { type: 'new_order', orderId, orderNumber },
    }).catch(() => {});

    // ── Customer confirmation email ───────────────────────────────────────
    if (customerEmail) {
      const customerEmailPayload = buildOrderConfirmationEmail({
        orderNumber,
        customerName:    customerName ?? 'Customer',
        customerEmail,
        items:           enrichedItems,
        total:           body.total ?? 0,
        deliveryAddress: deliveryAddress ?? undefined,
      });
      sendTransactionalEmail(customerEmailPayload).catch(() => {});
    }

    // ── Internal POS receipt — always sent regardless of customer email ───
    // Allows staff to ring the order up on the POS system.
    const internalReceiptPayload = buildInternalReceiptEmail({
      orderNumber,
      customerName:    customerName  ?? 'Unknown Customer',
      customerEmail:   customerEmail ?? '(no email provided)',
      phone:           customerPhone  ?? undefined,
      items:           enrichedItems,
      total:           body.total ?? 0,
      deliveryAddress: deliveryAddress ?? undefined,
      branchName,
    });
    sendTransactionalEmail(internalReceiptPayload).catch(() => {});

    return NextResponse.json({ success: true, orderId, orderNumber }, { status: 201 });
  } catch (error) {
    console.error('❌ Failed to create order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}