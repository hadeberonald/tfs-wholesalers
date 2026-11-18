// ═══════════════════════════════════════════════════════════════════════════
// DESTINATION: app/api/payment/initialize/route.ts   (REPLACES the existing file)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { paystackService, generatePaymentReference, formatAmountForPayment } from '@/lib/payment';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { FREE_ORDER_REF_PREFIX } from '@/lib/promo-engine';
import { DB_NAME, markOrderPaid, orderReferences, settleOrder } from '@/lib/order-payment';

// ─── Resolve how this branch's payments should be routed ─────────────────────
//   { blocked: true, reason }                     — misconfigured branch, refuse
//   { blocked: false, subaccountCode: null }      — main account, by design (e.g. Vryheid)
//   { blocked: false, subaccountCode: 'ACCT_x' }  — split payment, branch bears the fee
function resolvePaymentRouting(branch: any): {
  blocked: boolean;
  reason?: string;
  subaccountCode: string | null;
} {
  const paystackConfig = branch?.paymentConfig?.paystack;
  const subaccountCode: string | undefined = paystackConfig?.subaccountCode;
  const routeToMainAccount: boolean = paystackConfig?.routeToMainAccount === true;

  if (subaccountCode) {
    if (!/^ACCT_/.test(subaccountCode)) {
      console.warn(`[Initialize] Branch "${branch?.name}" subaccountCode "${subaccountCode}" doesn't look like an ACCT_ code`);
    }
    return { blocked: false, subaccountCode };
  }
  if (routeToMainAccount) return { blocked: false, subaccountCode: null };

  return {
    blocked: true,
    reason: `Branch "${branch?.name || branch?._id}" has no subaccountCode and routeToMainAccount is not set`,
    subaccountCode: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: amount is NOT accepted from the client — always read from the DB.
    const { orderId, email, authorizationCode } = await request.json();

    if (!orderId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!ObjectId.isValid(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const orderDoc = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
    if (!orderDoc) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // ── Guards: never start a new payment on a finished/dead order ───────────
    if (orderDoc.status === 'cancelled') {
      return NextResponse.json({ error: 'This order has been cancelled' }, { status: 409 });
    }
    if (orderDoc.paymentStatus === 'paid') {
      // Clients treat charged:true as "go verify this reference" → verified.
      return NextResponse.json({
        success: true,
        charged: true,
        reference: orderDoc.paymentReference,
        publicKey: paystackService.getPublicKey(),
      });
    }

    // ── Free orders: a promo took the total to R0.00 — no gateway ────────────
    const orderTotal = Number(orderDoc.total);
    if (!Number.isFinite(orderTotal) || orderTotal < 0) {
      return NextResponse.json({ error: 'Order total is invalid' }, { status: 400 });
    }
    if (orderTotal === 0) {
      if (!orderDoc.promoCode?.id) {
        return NextResponse.json({ error: 'Order total is invalid' }, { status: 400 });
      }
      const freeReference =
        typeof orderDoc.paymentReference === 'string' && orderDoc.paymentReference.startsWith(FREE_ORDER_REF_PREFIX)
          ? orderDoc.paymentReference
          : `${FREE_ORDER_REF_PREFIX}${orderId}-${Date.now()}`;

      await db.collection('orders').updateOne(
        { _id: orderDoc._id },
        { $set: { paymentReference: freeReference, updatedAt: new Date() } }
      );
      return NextResponse.json({
        success: true,
        charged: true,
        reference: freeReference,
        publicKey: paystackService.getPublicKey(),
      });
    }

    // ── Branch payment routing ───────────────────────────────────────────────
    if (!orderDoc.branchId) {
      console.error(`[Initialize] Order ${orderId} has no branchId — cannot route payment`);
      return NextResponse.json({ error: 'Order is missing branch information' }, { status: 400 });
    }
    const branch = await db.collection('branches').findOne({ _id: new ObjectId(orderDoc.branchId.toString()) });
    if (!branch) {
      console.error(`[Initialize] Order ${orderId} references unknown branch ${orderDoc.branchId}`);
      return NextResponse.json({ error: 'Order references an unknown branch' }, { status: 400 });
    }
    const routing = resolvePaymentRouting(branch);
    if (routing.blocked) {
      console.error(`[Initialize] Blocking payment for order ${orderId}: ${routing.reason}`);
      return NextResponse.json(
        { error: 'This store is not yet set up to accept payments. Please contact support.' },
        { status: 400 }
      );
    }
    const subaccountCode = routing.subaccountCode;
    const splitFields = subaccountCode
      ? { subaccount: subaccountCode, bearer: 'subaccount' as const }
      : {};

    // ── Did an earlier attempt on this order already succeed? ────────────────
    // (Customer paid, app lost track, customer taps "Try again".) Settle it
    // instead of charging them a second time.
    if (orderReferences(orderDoc).length > 0) {
      try {
        const prior = await settleOrder(db, orderDoc, 'initialize-precheck');
        if (prior.result?.ok) {
          console.log(`[Initialize] Order ${orderId} was already paid by an earlier attempt — not starting a new one`);
          return NextResponse.json({
            success: true,
            charged: true,
            reference: prior.result.order.paymentReference,
            publicKey: paystackService.getPublicKey(),
          });
        }
      } catch (err: any) {
        console.warn(`[Initialize] Prior-reference check failed for ${orderId}:`, err?.message);
      }
    }

    // Always the DB amount — never trust a client-supplied one.
    const amount = orderDoc.total;
    const reference = generatePaymentReference(`ORDER-${orderId}`);

    // Record the reference BEFORE talking to Paystack, so the webhook, verify
    // and the reconciler can always find it, even if we crash mid-request.
    await db.collection('orders').updateOne(
      { _id: orderDoc._id },
      {
        $addToSet: { paymentReferences: reference },
        $set: {
          paymentReference: reference,
          expectedSubaccount: subaccountCode, // null = main account on purpose
          updatedAt: new Date(),
        },
      }
    );

    const metadata = {
      orderId,
      custom_fields: [{ display_name: 'Order ID', variable_name: 'order_id', value: orderId }],
    };

    // ── Saved card: charge immediately ───────────────────────────────────────
    if (authorizationCode) {
      try {
        const response = await fetch('https://api.paystack.co/transaction/charge_authorization', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            amount: formatAmountForPayment(amount),
            authorization_code: authorizationCode,
            currency: 'ZAR',
            reference,
            ...splitFields,
            metadata,
          }),
        });
        const result = await response.json();

        if (!(result.status && result.data?.status === 'success')) {
          throw new Error(result.message || 'Charge failed');
        }

        // Re-read the transaction so we settle against the full, canonical object.
        const verified = await paystackService.verifyPayment(reference).catch(() => null);
        const tx = verified?.data?.status === 'success' ? verified.data : result.data;

        const settled = await markOrderPaid(db, orderId, tx, 'charge_authorization');
        if (!settled.ok) {
          return NextResponse.json(
            { error: 'Payment received but could not be matched. Please contact support.' },
            { status: 409 }
          );
        }

        return NextResponse.json({
          success: true,
          charged: true,
          reference,
          publicKey: paystackService.getPublicKey(),
        });
      } catch (error: any) {
        console.error('Charge authorization error:', error);
        // The reference is stored, so the reconciler will still pick it up if
        // Paystack completes the charge later.
        return NextResponse.json({ error: 'Failed to charge saved card' }, { status: 400 });
      }
    }

    // ── New card: initialize payment ─────────────────────────────────────────
    const result = await paystackService.initializePayment({
      email,
      amount: formatAmountForPayment(amount),
      currency: 'ZAR',
      reference,
      callback_url: `${process.env.NEXTAUTH_URL}/checkout/callback`,
      ...splitFields,
      metadata,
    });

    if (result.status) {
      return NextResponse.json({
        success: true,
        charged: false,
        reference,
        amountKobo: formatAmountForPayment(amount),
        authorization_url: result.data.authorization_url,
        access_code: result.data.access_code,
        publicKey: paystackService.getPublicKey(),
      });
    }
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 400 });
  } catch (error: any) {
    console.error('Payment initialization error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}