// ═══════════════════════════════════════════════════════════════════════════
// DESTINATION: app/api/payment/webhook/route.ts    (REPLACES the existing file)
// ═══════════════════════════════════════════════════════════════════════════
//
// Paystack must call the CANONICAL host (https://www.tfswholesalers.com/...).
// The bare domain answers 307, and webhook senders generally don't follow it.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import clientPromise from '@/lib/mongodb';
import {
  DB_NAME,
  markOrderPaid,
  orderIdFromTransaction,
  recordPaymentIssue,
} from '@/lib/order-payment';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

async function handleChargeSuccess(data: any): Promise<void> {
  const reference = String(data?.reference ?? '');

  if (data?.status && data.status !== 'success') {
    console.log(`[Webhook] charge.success with status "${data.status}" for ${reference} — ignoring`);
    return;
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const orderId = orderIdFromTransaction(data);
  if (!orderId) {
    console.error(`[Webhook] charge.success for ${reference} cannot be matched to an order`, JSON.stringify(data?.metadata ?? null));
    await recordPaymentIssue(db, {
      type: 'unmatched_payment',
      reference,
      details: { amount: data?.amount, email: data?.customer?.email, paidAt: data?.paid_at },
    });
    return;
  }

  const result = await markOrderPaid(db, orderId, data, 'webhook');
  if (!result.ok) {
    console.error(`[Webhook] Could not mark ${orderId} paid for ${reference}: ${result.reason}`);
  } else if (result.alreadyPaid) {
    console.log(`[Webhook] Order ${orderId} already paid — nothing to do`);
  }
}

export async function POST(request: NextRequest) {
  if (!PAYSTACK_SECRET) {
    console.error('[Webhook] PAYSTACK_SECRET_KEY is not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // Raw body is required for the signature check.
  const rawBody = await request.text();

  const signature = request.headers.get('x-paystack-signature');
  if (!signature) {
    console.warn('[Webhook] Request missing x-paystack-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const expectedHash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(rawBody).digest('hex');
  if (expectedHash !== signature) {
    console.warn('[Webhook] Signature mismatch — possible spoofed request');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  console.log(`[Webhook] Received event: ${event.event}`);

  try {
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(event.data);
        break;
      default:
        console.log(`[Webhook] Unhandled event type: ${event.event}`);
    }
  } catch (err) {
    // Processing is idempotent, so a 500 here is safe: Paystack will retry,
    // which covers transient DB/network failures. Permanent problems (unknown
    // order, mismatch) don't throw — they're recorded and acknowledged below.
    console.error(`[Webhook] Error processing event ${event.event}:`, err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}