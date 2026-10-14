/**
 * Shows the fuller picture behind "R0.00 available balance":
 *   1. Balance breakdown (available vs pending, if Paystack returns it)
 *   2. Recent settlement batches — what's been paid to your bank, what's
 *      still pending, and when the next one is expected to land.
 *
 * Usage:
 *   node --env-file=.env scripts/check-pending-settlements.js
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!PAYSTACK_SECRET_KEY) {
  console.error('❌ PAYSTACK_SECRET_KEY is not set.');
  process.exit(1);
}

function fmt(kobo) {
  return `R${(kobo / 100).toFixed(2)}`;
}

async function main() {
  // ── Balance ────────────────────────────────────────────────────────────
  const balRes = await fetch('https://api.paystack.co/balance', {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  });
  const balData = await balRes.json();

  console.log('── Balance ──────────────────────────────');
  if (balData.status) {
    for (const entry of balData.data) {
      console.log(`${entry.currency}:`);
      console.log(`  Available: ${fmt(entry.balance)}`);
      if (typeof entry.pending === 'number') {
        console.log(`  Pending (not yet settled): ${fmt(entry.pending)}`);
        console.log(`  Total: ${fmt(entry.balance + entry.pending)}`);
      }
    }
  } else {
    console.log('Could not fetch balance:', balData.message);
  }

  // ── Recent settlements (last 14 days) ─────────────────────────────────
  const to = new Date();
  const from = new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000);
  const fmtDate = (d) => d.toISOString().split('T')[0];

  const settleRes = await fetch(
    `https://api.paystack.co/settlement?from=${fmtDate(from)}&to=${fmtDate(to)}`,
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
  );
  const settleData = await settleRes.json();

  console.log('\n── Settlements (last 14 days) ───────────');
  if (!settleData.status) {
    console.log('Could not fetch settlements:', settleData.message);
    return;
  }
  if (settleData.data.length === 0) {
    console.log('No settlement batches in this window.');
    return;
  }

  for (const s of settleData.data) {
    console.log(
      `${s.settlement_date || s.createdAt} | status: ${s.status} | ` +
      `gross: ${fmt(s.total_amount || 0)} | fees: ${fmt(s.total_fees || 0)} | ` +
      `net paid to bank: ${fmt(s.total_processed || 0)}`
    );
  }

  console.log('\nIf today\'s order isn\'t in a settlement batch yet, its money is still');
  console.log('"pending" and genuinely not usable for a refund until the next settlement runs.');
}

main();