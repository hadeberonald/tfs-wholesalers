/**
 * Cross-checks refund records that look "resolved" in your DB but have no
 * providerRef, against what Paystack actually has on file — using the API
 * directly (your PAYSTACK_SECRET_KEY), no dashboard login required.
 *
 * For each suspect record, this calls:
 *   GET /refund?reference={paymentRef}
 * which returns any refunds Paystack has processed against that transaction.
 * If Paystack has nothing, the refund genuinely never happened and the
 * customer is still owed their money.
 *
 * This is READ-ONLY against Paystack — it checks, it does not refund anyone.
 * Use the output to decide what to actually refund next.
 *
 * Usage:
 *   node --env-file=.env scripts/verify-refunds-with-paystack.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const DB_NAME = 'tfs-wholesalers';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Run with: node --env-file=.env scripts/verify-refunds-with-paystack.js');
  process.exit(1);
}
if (!PAYSTACK_SECRET_KEY) {
  console.error('❌ PAYSTACK_SECRET_KEY is not set.');
  process.exit(1);
}

async function checkPaystackRefund(reference) {
  const res = await fetch(`https://api.paystack.co/refund?reference=${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  });
  const data = await res.json();

  if (!data.status) {
    return { checked: false, error: data.message || 'Paystack API error' };
  }

  const refunds = data.data || [];
  if (refunds.length === 0) {
    return { checked: true, found: false, refunds: [] };
  }

  return { checked: true, found: true, refunds };
}

async function main() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const refundsCollection = db.collection('refunds');

    const suspectStatuses = ['approved', 'processed', 'pending'];
    const suspects = await refundsCollection
      .find({
        paymentMethod: 'card',
        status: { $in: suspectStatuses },
        $or: [
          { providerRef: { $exists: false } },
          { providerRef: null },
          { providerRef: '' },
        ],
      })
      .sort({ createdAt: 1 })
      .toArray();

    if (suspects.length === 0) {
      console.log('✅ No unconfirmed card refunds to check.');
      return;
    }

    console.log(`Checking ${suspects.length} record(s) against Paystack directly...\n`);

    const genuinelyUnrefunded = [];
    const actuallyRefundedButDbMissed = [];
    const couldNotCheck = [];

    for (const r of suspects) {
      const result = await checkPaystackRefund(r.paymentRef);

      if (!result.checked) {
        couldNotCheck.push({ r, error: result.error });
        console.log(`? ${r.orderNumber} (${r.customerName}) — could not check: ${result.error}`);
        continue;
      }

      if (result.found) {
        actuallyRefundedButDbMissed.push({ r, paystackRefunds: result.refunds });
        const status = result.refunds[0]?.status || 'unknown';
        console.log(`✅ ${r.orderNumber} (${r.customerName}) — Paystack HAS a refund on file (status: ${status}). Your DB just didn't record it — safe to update the record, don't refund again.`);
      } else {
        genuinelyUnrefunded.push(r);
        console.log(`❌ ${r.orderNumber} (${r.customerName}) — R${r.refundAmount.toFixed(2)} — NOTHING on Paystack. Customer was never refunded.`);
      }

      // Light rate-limit courtesy — avoid hammering the API in a tight loop
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    console.log('\n──────────────────────────────────────────');
    console.log(`Genuinely unrefunded: ${genuinelyUnrefunded.length} customer(s), ` +
      `R${genuinelyUnrefunded.reduce((s, r) => s + r.refundAmount, 0).toFixed(2)} total — these need a real refund now.`);
    console.log(`Refunded on Paystack but missing from your DB: ${actuallyRefundedButDbMissed.length} — just update providerRef on these, no action needed toward the customer.`);
    if (couldNotCheck.length > 0) {
      console.log(`Could not check: ${couldNotCheck.length} — review manually.`);
    }
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();