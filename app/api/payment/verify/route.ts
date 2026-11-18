// ═══════════════════════════════════════════════════════════════════════════
// DESTINATION: app/api/payment/verify/route.ts     (REPLACES the existing file)
// ═══════════════════════════════════════════════════════════════════════════
//
// Body: { reference }  — verify one Paystack reference (existing clients), or
//       { orderId }    — check every reference ever started for that order
//                        (for "Check again" buttons / lost-reference recovery).

import { NextRequest, NextResponse } from 'next/server';
import { paystackService } from '@/lib/payment';
import { FREE_ORDER_REF_PREFIX } from '@/lib/promo-engine';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import {
  DB_NAME,
  markOrderPaid,
  orderIdFromTransaction,
  orderReferences,
  settleOrder,
  type MarkPaidResult,
} from '@/lib/order-payment';

// "abandoned" is NOT final: Paystack uses it for any transaction the customer
// hasn't completed *yet* (popup closed early, OTP pending, app switched...).
const RETRYABLE_STATUSES = new Set(['ongoing', 'pending', 'processing', 'queued', 'abandoned']);
const TERMINAL_FAILURE_STATUSES = new Set(['failed', 'reversed', 'cancelled', 'timeout']);

async function getBranchSlug(db: any, branchId: any): Promise<string | null> {
  if (!branchId) return null;
  try {
    const branch = await db
      .collection('branches')
      .findOne({ _id: new ObjectId(branchId.toString()) }, { projection: { slug: 1 } });
    return branch?.slug || null;
  } catch {
    return null;
  }
}

function pendingResponse(status: string, message?: string) {
  return NextResponse.json(
    {
      verified: false,
      pending: true,
      retryable: true,
      status,
      error: message || `Payment is not confirmed yet (status: "${status}")`,
    },
    { status: 202 }
  );
}

async function successResponse(db: any, order: any, reference: string, amountRand: number) {
  const branchSlug = await getBranchSlug(db, order.branchId);
  return NextResponse.json({
    verified: true,
    orderId: order._id.toString(),
    branchSlug,
    amount: amountRand,
    reference,
  });
}

function failureFromResult(result: Extract<MarkPaidResult, { ok: false }>, reference: string) {
  switch (result.reason) {
    case 'not_found':
      return NextResponse.json({ verified: false, retryable: false, error: 'Order not found' }, { status: 404 });
    case 'amount_mismatch':
      return NextResponse.json(
        {
          verified: false,
          retryable: false,
          error: `Payment amount does not match your order. Please contact support with reference: ${reference}`,
        },
        { status: 409 }
      );
    default:
      return NextResponse.json(
        {
          verified: false,
          retryable: false,
          error: `Payment could not be matched to your order. Please contact support with reference: ${reference}`,
        },
        { status: 422 }
      );
  }
}

// ─── Free orders (promo took the total to R0.00) ──────────────────────────────
async function verifyFreeOrder(db: any, reference: string) {
  const order = await db.collection('orders').findOne({ paymentReference: reference });
  if (!order) {
    return NextResponse.json({ verified: false, retryable: false, error: 'Order not found' }, { status: 404 });
  }
  if (Number(order.total) !== 0 || !order.promoCode?.id) {
    return NextResponse.json(
      { verified: false, retryable: false, error: 'This order requires payment' },
      { status: 400 }
    );
  }

  const result = await markOrderPaid(
    db,
    order._id.toString(),
    {
      reference,
      amount: 0,
      currency: 'ZAR',
      paid_at: new Date().toISOString(),
      channel: 'promo',
      subaccount: null,
    },
    'verify-free'
  );
  if (!result.ok) return failureFromResult(result, reference);
  return successResponse(db, result.order, reference, 0);
}

// ─── Verify by orderId (all references) ───────────────────────────────────────
async function verifyByOrderId(db: any, orderId: string) {
  if (!ObjectId.isValid(orderId)) {
    return NextResponse.json({ verified: false, retryable: false, error: 'Invalid order ID' }, { status: 400 });
  }
  const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
  if (!order) {
    return NextResponse.json({ verified: false, retryable: false, error: 'Order not found' }, { status: 404 });
  }
  if (order.paymentStatus === 'paid') {
    return successResponse(
      db,
      order,
      order.paymentReference,
      Number(order.paymentDetails?.amount ?? order.total)
    );
  }
  if (orderReferences(order).length === 0) {
    return NextResponse.json(
      { verified: false, retryable: false, error: 'No payment has been started for this order' },
      { status: 400 }
    );
  }

  let settled;
  try {
    settled = await settleOrder(db, order, 'verify-by-order');
  } catch (err: any) {
    console.error(`[Verify] Network error settling order ${orderId}:`, err?.message);
    return pendingResponse('network', 'Could not reach payment provider — retrying…');
  }

  if (settled.result?.ok) {
    return successResponse(db, settled.result.order, settled.result.order.paymentReference, Number(settled.result.order.paymentDetails?.amount ?? 0));
  }
  if (settled.result && !settled.result.ok) {
    return failureFromResult(settled.result as Extract<MarkPaidResult, { ok: false }>, order.paymentReference);
  }
  if (TERMINAL_FAILURE_STATUSES.has(settled.lastStatus)) {
    return NextResponse.json(
      { verified: false, retryable: false, status: settled.lastStatus, error: `Payment ${settled.lastStatus}. Please try again or use a different card.` },
      { status: 400 }
    );
  }
  return pendingResponse(settled.lastStatus || 'unknown');
}

// ─── POST /api/payment/verify ─────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { reference, orderId } = await request.json();
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    if (!reference && orderId) return await verifyByOrderId(db, String(orderId));

    if (!reference) {
      return NextResponse.json({ error: 'Payment reference is required' }, { status: 400 });
    }

    if (typeof reference === 'string' && reference.startsWith(FREE_ORDER_REF_PREFIX)) {
      return await verifyFreeOrder(db, reference);
    }

    // ── Step 1: ask Paystack ─────────────────────────────────────────────────
    let paystackResult: any;
    try {
      paystackResult = await paystackService.verifyPayment(reference);
    } catch (fetchErr: any) {
      console.error(`[Verify] Network error calling Paystack for ${reference}:`, fetchErr.message);
      return pendingResponse('network', 'Could not reach payment provider — retrying…');
    }

    const paystackStatus: string = paystackResult?.data?.status ?? '';
    console.log(`[Verify] Paystack status "${paystackStatus}" for ${reference}`);

    // ── Step 2: not settled yet (includes "abandoned") → client keeps polling ─
    if (RETRYABLE_STATUSES.has(paystackStatus)) {
      return pendingResponse(paystackStatus);
    }

    // ── Step 3: genuine terminal failures ────────────────────────────────────
    if (TERMINAL_FAILURE_STATUSES.has(paystackStatus)) {
      console.warn(`[Verify] Terminal failure "${paystackStatus}" for ${reference}`);
      return NextResponse.json(
        {
          verified: false,
          retryable: false,
          status: paystackStatus,
          error: `Payment ${paystackStatus}. Please try again or use a different card.`,
        },
        { status: 400 }
      );
    }

    // ── Step 4: anything else that isn't success ─────────────────────────────
    if (!paystackResult?.status || paystackStatus !== 'success') {
      console.warn(`[Verify] Non-success status "${paystackStatus}" for ${reference}:`, paystackResult?.message);
      return NextResponse.json(
        {
          verified: false,
          retryable: false,
          error: paystackResult?.message || `Payment was not successful (status: ${paystackStatus})`,
        },
        { status: 400 }
      );
    }

    // ── Step 5: success → one atomic, amount-checked transition ──────────────
    const data = paystackResult.data;
    const resolvedOrderId = orderIdFromTransaction(data);

    if (!resolvedOrderId) {
      console.error(`[Verify] CRITICAL: ${reference} succeeded on Paystack but has no orderId.`, JSON.stringify(data.metadata ?? null));
      return NextResponse.json(
        {
          verified: false,
          retryable: false,
          error: `Payment received but could not be matched to your order. Please contact support with reference: ${reference}`,
        },
        { status: 422 }
      );
    }

    const result = await markOrderPaid(db, resolvedOrderId, data, 'verify');
    if (!result.ok) return failureFromResult(result, reference);

    return successResponse(db, result.order, data.reference, data.amount / 100);
  } catch (error: any) {
    console.error('[Verify] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', retryable: false },
      { status: 500 }
    );
  }
}