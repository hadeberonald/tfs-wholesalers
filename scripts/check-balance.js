/**
 * Checks your main Paystack account's actual balance — available vs pending.
 * "Available" is what can actually be used for a refund right now.
 * "Pending" is money collected but not yet settled into usable balance.
 *
 * Usage:
 *   node --env-file=.env scripts/check-balance.js
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!PAYSTACK_SECRET_KEY) {
  console.error('❌ PAYSTACK_SECRET_KEY is not set.');
  process.exit(1);
}

async function main() {
  const res = await fetch('https://api.paystack.co/balance', {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  });
  const data = await res.json();

  if (!data.status) {
    console.error('❌ Could not fetch balance:', data.message);
    process.exit(1);
  }

  console.log('Main account balance:\n');
  for (const entry of data.data) {
    console.log(`${entry.currency}: R${(entry.balance / 100).toFixed(2)}`);
  }
  console.log('\nNote: this is your main account balance only — it does NOT include');
  console.log('money sitting in branch subaccounts (Ladysmith/Dundee), since that');
  console.log('never passes through the main balance at all when bearer is "subaccount".');
}

main();