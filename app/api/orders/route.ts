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
import { LEGACY_APP_DELIVERY_FEE, type PromoBenefits } from '@/lib/promo-engine';
import { checkPromo, redeemPromo, releasePromo, recordPromoUsage } from '@/lib/promo-service';

// ── HOTFIX: server-side phone validation ─────────────────────────────────────
// Mirrors the format check used on the mobile checkout screen
// (app/checkout.tsx isValidPhone). The web checkout only relies on the HTML
// `required` attribute, which does not catch whitespace-only values or
// requests that bypass the form entirely. Enforcing this here ensures no
// order — from any client, old build, or direct API call — can be created
// without a usable phone number.
function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const cleaned = phone.trim().replace(/[\s\-()]/g, '');
  return /^(0\d{9}|\+27\d{9})$/.test(cleaned);
}

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
    const customerPhone   = (body.phone || body.customerInfo?.phone || '').toString().trim() || null;
    const deliveryAddress = body.deliveryAddress || body.shippingAddress?.address || null;
    let   deliveryFee     = body.deliveryFee ?? 0;

    // ── HOTFIX: enforce phone server-side, don't just trust the client ──────
    // The web checkout form only has the HTML `required` attribute (no format
    // check, and whitespace can slip through); the mobile app validates format
    // client-side but nothing stopped a stale build, retried request, or
    // direct API call from omitting/blanking it. Reject here so bad orders
    // can no longer reach the DB regardless of which client sent them.
    if (!isValidPhone(customerPhone)) {
      console.warn(
        `⚠️ [Orders] Rejected order — invalid/missing phone. ` +
        `Raw value: ${JSON.stringify(customerPhone)} | customer: ${customerEmail ?? 'guest'} | branch: ${body.branchId}`
      );
      return NextResponse.json({ error: 'A valid South African phone number is required' }, { status: 400 });
    }

    // ── Promo code: re-price on the server, never trust the client's numbers ──
    // The shipped mobile app posts a pre-computed total plus a `promoCode` blob
    // whose `type` / `discountAmount` are a *translation* for old clients (see
    // lib/promo-engine.ts). Only `promoCode.id` is used from the request; the
    // benefits, delivery fee and total are recomputed here from the DB record.
    let promoApplied: { promo: any; benefits: PromoBenefits } | null = null;
    let orderTotal: number = body.total ?? 0;

    if (body.promoCode) {
      const promoId = body.promoCode.id;
      if (!promoId) {
        return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
      }
      const clientSubtotal = Number(body.subtotal);
      if (!Number.isFinite(clientSubtotal) || clientSubtotal < 0) {
        return NextResponse.json({ error: 'Invalid order subtotal' }, { status: 400 });
      }

      // The shipped app always charges R35 delivery (checkout.tsx), so the base fee is fixed.
      const checked = await checkPromo(db, {
        branchId:    body.branchId,
        promoId,
        subtotal:    clientSubtotal,
        email:       customerEmail,
        deliveryFee: LEGACY_APP_DELIVERY_FEE,
      });
      if (!checked.ok) {
        return NextResponse.json({ error: checked.error }, { status: checked.status });
      }

      promoApplied = { promo: checked.promo, benefits: checked.benefits };
      orderTotal   = checked.benefits.total;
      deliveryFee  = Math.round((LEGACY_APP_DELIVERY_FEE - checked.benefits.deliveryDiscount) * 100) / 100;

      const clientTotal = Number(body.total);
      if (Number.isFinite(clientTotal) && Math.abs(clientTotal - orderTotal) > 0.01) {
        console.warn(
          `⚠️ [Orders] Client total R${clientTotal.toFixed(2)} differs from server total ` +
          `R${orderTotal.toFixed(2)} for promo ${checked.promo.code} — using server total`
        );
      }
    }

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
    const promoRecord = promoApplied
      ? {
          id:                   promoApplied.promo._id.toString(),
          code:                 promoApplied.promo.code,
          type:                 promoApplied.promo.type,
          includesFreeDelivery: promoApplied.benefits.freeDelivery && promoApplied.promo.type !== 'free_delivery',
          itemDiscount:         promoApplied.benefits.itemDiscount,
          deliveryDiscount:     promoApplied.benefits.deliveryDiscount,
        }
      : null;
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
      // Server-authoritative promo figures. `promoCode` / `promoDiscount` always
      // overwrite whatever the client sent via ...body, so they can't be spoofed.
      ...(promoApplied ? { total: orderTotal } : {}),
      promoCode:         promoRecord,
      promoDiscount:     promoApplied ? promoApplied.benefits.itemDiscount : 0,
      tillAccountNumber,
      createdAt:         new Date(),
      updatedAt:         new Date(),
      customerName,
      customerEmail,
      phone:             customerPhone,
      deliveryAddress,
    };

    // Take the promo redemption atomically right before saving the order so two
    // concurrent checkouts can't both squeeze past the usage limit.
    if (promoApplied) {
      const redeemed = await redeemPromo(db, promoApplied.promo._id);
      if (!redeemed) {
        return NextResponse.json({ error: 'This promo code has reached its usage limit' }, { status: 400 });
      }
    }

    const result  = await db.collection('orders').insertOne(order).catch(async (err) => {
      if (promoApplied) await releasePromo(db, promoApplied.promo._id).catch(() => {});
      throw err;
    });
    const orderId = result.insertedId.toString();

    if (promoApplied) {
      await recordPromoUsage(db, {
        promoCodeId:      promoApplied.promo._id,
        email:            customerEmail,
        orderId,
        orderNumber,
        code:             promoApplied.promo.code,
        itemDiscount:     promoApplied.benefits.itemDiscount,
        deliveryDiscount: promoApplied.benefits.deliveryDiscount,
      }).catch((err) => console.error('[Orders] Failed to record promo usage:', err));
      console.log(
        '🏷️ Promo applied:', promoApplied.promo.code,
        '| items -R' + promoApplied.benefits.itemDiscount.toFixed(2),
        '| delivery -R' + promoApplied.benefits.deliveryDiscount.toFixed(2),
        '| total R' + orderTotal.toFixed(2)
      );
    }

    // ── HOTFIX: phone now always printed on order-creation log line ─────────
    // Previously the phone was not logged at all, making it impossible to
    // confirm from logs whether it was captured. It is validated above, so
    // it will never be 'MISSING' here — but the fallback is kept as a
    // defensive trip-wire in case validation is ever bypassed or refactored.
    console.log(
      '✅ Order created:', orderId,
      '| customer:', customerEmail ?? 'guest',
      '| phone:', customerPhone ?? 'MISSING',
      '| till:', tillAccountNumber ?? 'none',
      '| status:', orderStatus
    );

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
        total:             orderTotal,
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
      total:             orderTotal,
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