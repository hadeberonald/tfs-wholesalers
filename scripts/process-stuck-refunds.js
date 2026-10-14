/**
 * Processes refunds already confirmed (via verify-refunds-with-paystack.js)
 * to have never actually gone through. This is the script that moves real
 * money — it's dry-run by default and only acts when explicitly confirmed.
 *
 * Safety:
 *   - Re-checks each record against Paystack immediately before refunding,
 *     in case anything changed between runs — never refunds something that
 *     already has a refund on file.
 *   - Dry run by default: prints exactly what it WOULD do, calls nothing.
 *   - Only processes when run with CONFIRM=yes.
 *
 * Usage:
 *   Dry run (safe, default):
 *     node --env-file=.env scripts/process-stuck-refunds.js
 *
 *   Actually process the refunds:
 *     CONFIRM=yes node --env-file=.env scripts/process-stuck-refunds.js
 *
 * On Windows cmd.exe, set the var first:
 *   set CONFIRM=yes
 *   node --env-file=.env scripts/process-stuck-refunds.js
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const DB_NAME = 'tfs-wholesalers';
const CONFIRMED = process.env.CONFIRM === 'yes';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set.');
  process.exit(1);
}
if (!PAYSTACK_SECRET_KEY) {
  console.error('❌ PAYSTACK_SECRET_KEY is not set.');
  process.exit(1);
}

async function checkExistingRefund(reference) {
  const res = await fetch(`https://api.paystack.co/refund?reference=${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  });
  const data = await res.json();
  if (!data.status) return { checked: false, error: data.message };
  return { checked: true, found: (data.data || []).length > 0, refunds: data.data || [] };
}

async function issuePaystackRefund(reference, amountZAR, note) {
  const res = await fetch('https://api.paystack.co/refund', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transaction: reference,
      amount: Math.round(amountZAR * 100),
      merchant_note: note,
    }),
  });
  return res.json();
}

async function main() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const refundsCollection = db.collection('refunds');
    const ordersCollection = db.collection('orders');

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
      console.log('✅ Nothing to process.');
      return;
    }

    console.log(
      CONFIRMED
        ? `⚠️  LIVE MODE — this will actually call Paystack and refund real money.\n`
        : `DRY RUN — nothing will actually be charged. Re-run with CONFIRM=yes to process for real.\n`
    );
    console.log(`Checking ${suspects.length} record(s)...\n`);

    let totalProcessed = 0;
    let totalSkipped = 0;

    for (const r of suspects) {
      // Re-check immediately before acting — avoid double-refunding anything
      // that was already handled since the last audit.
      const check = await checkExistingRefund(r.paymentRef);

      if (!check.checked) {
        console.log(`? ${r.orderNumber} (${r.customerName}) — could not verify with Paystack (${check.error}), skipping.`);
        totalSkipped++;
        continue;
      }

      if (check.found) {
        console.log(`⏭  ${r.orderNumber} (${r.customerName}) — already has a refund on Paystack now, skipping (DB will need a manual providerRef update).`);
        totalSkipped++;
        continue;
      }

      // Look up the order for branch-recovery context (subaccount, if any)
      let subaccountCode = null;
      let branchId = null;
      if (r.orderId && ObjectId.isValid(r.orderId)) {
        const order = await ordersCollection.findOne({ _id: new ObjectId(r.orderId) });
        subaccountCode = order?.paymentDetails?.subaccount ?? null;
        branchId = order?.branchId?.toString() || null;
      }
      const needsBranchRecovery = Boolean(subaccountCode);

      if (!CONFIRMED) {
        console.log(
          `Would refund: ${r.orderNumber} (${r.customerName}) — R${r.refundAmount.toFixed(2)} ` +
          `— ref ${r.paymentRef}` +
          (needsBranchRecovery ? ` — ⚠ split payment (${subaccountCode}), would need branch recovery tracking` : '')
        );
        totalProcessed++;
        continue;
      }

      // ── Actually issue the refund ──────────────────────────────────────
      try {
        const result = await issuePaystackRefund(
          r.paymentRef,
          r.refundAmount,
          `Backfill refund for ${r.itemName || r.itemSku || 'item'} on order ${r.orderNumber} (originally failed silently)`
        );

        if (!result.status) {
          console.log(`❌ ${r.orderNumber} (${r.customerName}) — Paystack rejected the refund: ${result.message}`);
          totalSkipped++;
          continue;
        }

        await refundsCollection.updateOne(
          { _id: r._id },
          {
            $set: {
              status: 'processed',
              providerRef: result.data?.id ?? result.data?.reference ?? null,
              branchId,
              subaccountCode,
              needsBranchRecovery,
              recoveryAmount: needsBranchRecovery ? r.refundAmount : 0,
              recoveryStatus: needsBranchRecovery ? 'owed' : null,
              note: 'Backfilled — original automatic refund silently failed, processed manually via script.',
              updatedAt: new Date(),
            },
          }
        );

        console.log(`✅ ${r.orderNumber} (${r.customerName}) — refunded R${r.refundAmount.toFixed(2)}` +
          (needsBranchRecovery ? ` — flagged for branch recovery (${subaccountCode})` : ''));
        totalProcessed++;
      } catch (err) {
        console.log(`❌ ${r.orderNumber} (${r.customerName}) — error: ${err.message}`);
        totalSkipped++;
      }

      // Courtesy rate limit
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log('\n──────────────────────────────────────────');
    console.log(CONFIRMED
      ? `Processed: ${totalProcessed}. Skipped: ${totalSkipped}.`
      : `Would process: ${totalProcessed}. Would skip: ${totalSkipped}. Re-run with CONFIRM=yes to actually refund.`);
  } catch (err) {
    console.error('❌ Script failed:', err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();