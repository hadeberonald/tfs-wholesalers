// ═══════════════════════════════════════════════════════════════════════════
// DESTINATION: lib/order-payment.ts        (NEW FILE)
// ═══════════════════════════════════════════════════════════════════════════
//
// Single source of truth for "this order has been paid".
// Used by: /api/payment/verify, /api/payment/webhook, /api/payment/initialize
// (saved-card charge + already-paid guard) and the reconciler at the bottom.
//
// NOTE: relative imports only. This file may also be compiled by tsc through
// server.ts, where the "@/" alias is not resolved (same reason as
// sendPushNotification.ts).

import clientPromise from './mongodb';
import { ObjectId } from 'mongodb';
import { getIO } from './socket';
import { paystackService, formatAmountForPayment } from './payment';
import {
  notifyBranchPickers,
  buildOrderConfirmationEmail,
  buildInternalReceiptEmail,
  sendTransactionalEmail,
} from './sendPushNotification';
import { notifyBranchWeb } from './sendWebPush';

export const DB_NAME = 'tfs-wholesalers';

/**
 * Status a freshly paid order lands in.
 * 'pending' = paid, waiting for POS ring-up + admin confirmation. This matches
 * the internal receipt email ("confirm in the admin portal so picking can
 * begin") and the shipped mobile app, which PATCHes status:'pending' after a
 * successful verify. Set to 'confirmed' only if admin confirmation is no
 * longer a manual step.
 */
export const PAID_ORDER_STATUS = 'pending';

const UNPAID_STATUSES = ['payment_pending', 'payment_failed'];

export type MarkPaidResult =
  | { ok: true; alreadyPaid: boolean; order: any }
  | {
      ok: false;
      reason: 'invalid_order_id' | 'not_found' | 'reference_mismatch' | 'amount_mismatch';
    };

// ─── Small helpers ────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** orderId from Paystack metadata, falling back to the id embedded in our reference. */
export function orderIdFromTransaction(tx: any): string | null {
  const fromMeta =
    tx?.metadata?.orderId ||
    tx?.metadata?.custom_fields?.find((f: any) => f.variable_name === 'order_id')?.value;
  if (fromMeta) return String(fromMeta);
  const m = /^ORDER-([0-9a-f]{24})-/i.exec(String(tx?.reference ?? ''));
  return m ? m[1] : null;
}

/** Every Paystack reference ever started for this order (newest data first isn't needed). */
export function orderReferences(order: any): string[] {
  const all = [...(order?.paymentReferences ?? []), order?.paymentReference].filter(
    (r): r is string => typeof r === 'string' && r.startsWith('ORDER-')
  );
  return Array.from(new Set(all));
}

/** Park anything that needs a human (mismatches, unmatched payments) in one collection. */
export async function recordPaymentIssue(
  db: any,
  issue: { type: string; reference: string; orderId?: string | null; details?: any }
) {
  try {
    await db.collection('paymentIssues').updateOne(
      { reference: issue.reference, type: issue.type },
      { $setOnInsert: { ...issue, status: 'open', createdAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error('[PaymentIssue] failed to record:', err);
  }
}

// ─── Socket ───────────────────────────────────────────────────────────────────

export function emitOrderUpdate(order: any) {
  try {
    const io = getIO();
    if (!io) {
      console.warn('[Socket] getIO() returned null in order-payment');
      return;
    }
    const id = order._id?.toString();
    const branchId = order.branchId?.toString();
    const payload = { order: { ...order, _id: id, id }, status: order.status };
    if (branchId) io.to(`branch:${branchId}`).emit('order:updated', payload);
    io.to(`order:${id}`).emit('order:updated', payload);
    console.log(`[Socket] order:updated → branch:${branchId} + order:${id}`);
  } catch (err) {
    console.error('[Socket] emitOrderUpdate error:', err);
  }
}

// ─── Notifications (paid orders only) ─────────────────────────────────────────

/**
 * Internal POS receipt (salesnv inbox) + customer confirmation + picker push.
 * Called ONLY from markOrderPaid / the reconciler retry — never at order creation.
 */
export async function notifyOrderPaid(db: any, order: any): Promise<void> {
  const orderId = order._id.toString();
  const orderNumber = order.orderNumber || orderId;
  const branchId = order.branchId?.toString();
  const customerEmail = order.customerEmail || order.customerInfo?.email || null;
  const customerName = order.customerName || order.customerInfo?.name || 'Customer';
  const phone = order.phone || order.customerInfo?.phone || undefined;
  const deliveryAddress = order.deliveryAddress || order.shippingAddress?.address || undefined;
  const items = order.items ?? [];
  const total = Number(order.total ?? 0);
  const deliveryFee = Number(order.deliveryFee ?? 0);

  let branchName: string | undefined;
  if (branchId) {
    try {
      const b = await db
        .collection('branches')
        .findOne({ _id: new ObjectId(branchId) }, { projection: { displayName: 1, name: 1 } });
      branchName = b?.displayName || b?.name || undefined;
    } catch {
      /* non-critical */
    }
  }

  const tasks: Promise<unknown>[] = [];

  // 1. Internal receipt → the mailbox person
  tasks.push(
    sendTransactionalEmail(
      buildInternalReceiptEmail({
        orderNumber,
        customerName: customerName ?? 'Unknown Customer',
        customerEmail: customerEmail ?? '(no email provided)',
        phone,
        items,
        total,
        deliveryFee,
        deliveryAddress,
        branchName,
        tillAccountNumber: order.tillAccountNumber ?? undefined,
      })
    )
  );

  // 2. Customer confirmation
  if (customerEmail) {
    tasks.push(
      sendTransactionalEmail(
        buildOrderConfirmationEmail({
          orderNumber,
          customerName,
          customerEmail,
          items,
          total,
          deliveryFee,
          deliveryAddress,
          tillAccountNumber: order.tillAccountNumber ?? undefined,
        })
      )
    );
  } else {
    console.warn(`[Paid] No customer email on order ${orderNumber} — confirmation skipped`);
  }

  // 3. Pickers (app + web)
  if (branchId) {
    const push = {
      title: '🛒 New Order (Paid)',
      body: `Order ${orderNumber} is paid — ${items.length} item(s)`,
      data: { type: 'new_order', orderId, orderNumber },
    };
    tasks.push(notifyBranchPickers(branchId, push), notifyBranchWeb(branchId, push));
  }

  await Promise.allSettled(tasks);
}

// ─── The one function that marks an order paid ────────────────────────────────

/**
 * Idempotent and race-safe. `tx` is a Paystack transaction object
 * (verify.data / webhook.data) — or a synthetic one for free promo orders.
 * Only the caller that wins the atomic transition sends notifications.
 */
export async function markOrderPaid(
  db: any,
  orderId: string,
  tx: any,
  source: string
): Promise<MarkPaidResult> {
  if (!ObjectId.isValid(orderId)) return { ok: false, reason: 'invalid_order_id' };

  const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
  if (!order) return { ok: false, reason: 'not_found' };
  if (order.paymentStatus === 'paid') return { ok: true, alreadyPaid: true, order };

  const reference = String(tx?.reference ?? '');

  // The transaction must actually belong to this order.
  if (!reference.includes(orderId)) {
    console.error(`[Paid] Reference ${reference} does not belong to order ${orderId}`);
    await recordPaymentIssue(db, { type: 'reference_mismatch', reference, orderId });
    return { ok: false, reason: 'reference_mismatch' };
  }

  // Amount check. Reject only a real UNDERpayment (more than R1 short). The web
  // popup is opened with a client-computed amount, so small differences can be
  // legitimate, and a genuine payment must never end up "paid at Paystack but
  // unpaid here". Any difference at all is flagged for a human to look at.
  const flags: string[] = [];
  const expectedKobo = formatAmountForPayment(Number(order.total));
  const paidKobo = Number(tx?.amount);
  if (tx?.currency !== 'ZAR' || !Number.isFinite(paidKobo) || paidKobo < expectedKobo - 100) {
    console.error(
      `[Paid] UNDERPAYMENT order ${orderId}: Paystack ${tx?.amount} ${tx?.currency} vs expected ${expectedKobo} ZAR`
    );
    await recordPaymentIssue(db, {
      type: 'amount_mismatch',
      reference,
      orderId,
      details: { paystackAmount: tx?.amount, currency: tx?.currency, expectedKobo },
    });
    return { ok: false, reason: 'amount_mismatch' };
  }
  if (paidKobo !== expectedKobo) {
    flags.push('amount_difference');
    console.warn(`[Paid] Amount differs on order ${orderId}: paid ${paidKobo}, expected ${expectedKobo} (kobo/cents)`);
    await recordPaymentIssue(db, {
      type: 'amount_difference',
      reference,
      orderId,
      details: { paidKobo, expectedKobo },
    });
  }

  // Advisory: did the split actually get applied the way initialize intended?
  const gotSubaccount: string | null = tx?.subaccount?.subaccount_code ?? null;
  if (order.expectedSubaccount !== undefined && gotSubaccount !== (order.expectedSubaccount ?? null)) {
    flags.push('subaccount_mismatch');
    console.error(
      `[Paid] SUBACCOUNT MISMATCH order ${orderId}: expected ${order.expectedSubaccount ?? 'main account'}, got ${gotSubaccount ?? 'none'}`
    );
    await recordPaymentIssue(db, {
      type: 'subaccount_mismatch',
      reference,
      orderId,
      details: { expected: order.expectedSubaccount ?? null, got: gotSubaccount },
    });
  }

  const wasUnpaidStatus = UNPAID_STATUSES.includes(order.status);
  const paidAfterCancel = order.status === 'cancelled';
  if (paidAfterCancel) {
    flags.push('paid_after_cancel');
    await recordPaymentIssue(db, { type: 'paid_after_cancel', reference, orderId });
  }

  const now = new Date();
  const set: any = {
    paymentStatus: 'paid',
    status: wasUnpaidStatus ? PAID_ORDER_STATUS : order.status,
    paymentReference: reference,
    paymentDetails: {
      reference,
      amount: Number(tx.amount) / 100,
      paidAt: tx.paid_at ?? now.toISOString(),
      channel: tx.channel ?? null,
      subaccount: gotSubaccount,
    },
    paidAt: now,
    paidVia: source,
    updatedAt: now,
  };
  if (flags.length) set.paymentFlags = flags;
  if (wasUnpaidStatus) set.notifyState = 'pending';

  // Atomic: only one concurrent caller gets a document back.
  const updated = await db
    .collection('orders')
    .findOneAndUpdate(
      { _id: order._id, paymentStatus: { $ne: 'paid' } },
      { $set: set },
      { returnDocument: 'after' }
    );

  if (!updated) {
    const current = await db.collection('orders').findOne({ _id: order._id });
    return { ok: true, alreadyPaid: true, order: current };
  }

  console.log(`✅ [Paid] Order ${orderId} → paid (${source}, ref ${reference})`);
  emitOrderUpdate(updated);

  if (wasUnpaidStatus) {
    try {
      await notifyOrderPaid(db, updated);
      await db
        .collection('orders')
        .updateOne(
          { _id: updated._id, notifyState: 'pending' },
          { $set: { notifyState: 'sent', notifiedAt: new Date() } }
        );
    } catch (err) {
      // notifyState stays 'pending' → the reconciler retries it.
      console.error(`[Paid] Notifications failed for ${orderId}, will retry:`, err);
    }
  }

  return { ok: true, alreadyPaid: false, order: updated };
}

// ─── Settle an order by checking all of its references with Paystack ─────────

/** Throws on network errors — callers decide how to react. */
export async function settleOrder(
  db: any,
  order: any,
  source: string
): Promise<{ result: MarkPaidResult | null; lastStatus: string }> {
  let lastStatus = '';
  for (const ref of orderReferences(order)) {
    const r = await paystackService.verifyPayment(ref);
    const tx = r?.data;
    if (tx?.status) lastStatus = tx.status;
    if (r?.status && tx?.status === 'success') {
      const result = await markOrderPaid(db, order._id.toString(), tx, source);
      return { result, lastStatus: 'success' };
    }
  }
  return { result: null, lastStatus };
}

// ─── Reconciler: the safety net ───────────────────────────────────────────────

let reconciling = false;

export async function reconcilePendingPayments() {
  const stats = { checked: 0, settled: 0, renotified: 0 };
  if (reconciling) return stats;
  reconciling = true;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const now = Date.now();
    const twoMinAgo = new Date(now - 2 * 60e3);
    const twoHoursAgo = new Date(now - 2 * 3600e3);
    const oneHourAgo = new Date(now - 3600e3);

    // 1. Unpaid card orders: ask Paystack about every reference we ever started.
    //    Orders < 2h old are checked every run; older ones (up to 48h) hourly.
    const unpaid = await db
      .collection('orders')
      .find({
        status: 'payment_pending',
        paymentStatus: { $ne: 'paid' },
        total: { $gt: 0 },
        createdAt: { $gte: new Date(now - 48 * 3600e3), $lte: twoMinAgo },
        $or: [{ createdAt: { $gte: twoHoursAgo } }, { reconcileCheckedAt: { $not: { $gt: oneHourAgo } } }],
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    for (const order of unpaid) {
      if (orderReferences(order).length === 0) continue;
      stats.checked++;
      try {
        const { result } = await settleOrder(db, order, 'reconcile');
        if (result?.ok && !result.alreadyPaid) {
          stats.settled++;
          console.log(`🛟 [Reconcile] Recovered paid order ${order._id} (${order.orderNumber})`);
        }
        await db
          .collection('orders')
          .updateOne({ _id: order._id }, { $set: { reconcileCheckedAt: new Date() } });
      } catch (err: any) {
        console.warn(`[Reconcile] Order ${order._id} check failed:`, err?.message);
      }
      await sleep(250); // be gentle with the Paystack API
    }

    // 2. Paid orders whose notifications never completed (crash, SMTP down…).
    for (let i = 0; i < 20; i++) {
      const stuck = await db.collection('orders').findOneAndUpdate(
        { paymentStatus: 'paid', notifyState: 'pending', paidAt: { $lte: new Date(now - 3 * 60e3) } },
        { $set: { notifyState: 'retrying', notifyRetriedAt: new Date() } },
        { returnDocument: 'after' }
      );
      if (!stuck) break;
      try {
        await notifyOrderPaid(db, stuck);
        await db
          .collection('orders')
          .updateOne({ _id: stuck._id }, { $set: { notifyState: 'sent', notifiedAt: new Date() } });
        stats.renotified++;
      } catch (err) {
        console.error(`[Reconcile] Re-notify failed for ${stuck._id}:`, err);
      }
    }

    return stats;
  } finally {
    reconciling = false;
  }
}

/** Optional: call once from server.ts next to the Sync Scheduler. */
export function startPaymentReconciler(intervalMs = 3 * 60 * 1000) {
  const run = () =>
    reconcilePendingPayments()
      .then((s) => {
        if (s.settled || s.renotified) console.log('[Reconcile] done', s);
      })
      .catch((e) => console.error('[Reconcile] run failed:', e));
  setTimeout(run, 60_000);
  return setInterval(run, intervalMs);
}