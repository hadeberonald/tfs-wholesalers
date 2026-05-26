/**
 * scripts/cleanup-test-data.ts
 *
 * One-off script to wipe test/dev order data and everything that hangs off it.
 * Leaves products, users, branches, roles, categories, banners, and settings untouched.
 *
 * Collections cleared:
 *   orders
 *   refunds
 *   refundFailures
 *   stockTakes
 *   withdrawalRequests
 *   orderResolutions
 *   wholesale_purchase_orders   (PO receivings / wholesale orders)
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register scripts/cleanup-test-data.ts
 *
 * Or with tsx:
 *   npx tsx scripts/cleanup-test-data.ts
 */

import { MongoClient } from 'mongodb';
import * as readline from 'readline';

const MONGO_URI  = process.env.MONGODB_URI  || '';
const DB_NAME    = process.env.MONGODB_DB   || 'tfs-wholesalers';

if (!MONGO_URI) {
  console.error('❌  MONGODB_URI env var is not set. Aborting.');
  process.exit(1);
}

// Collections to wipe — nothing product, user, or site-setting related
const COLLECTIONS_TO_CLEAR = [
  'orders',
  'refunds',
  'refundFailures',
  'stockTakes',
  'withdrawalRequests',
  'orderResolutions',
  'wholesale_purchase_orders',
];

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

async function run() {
  console.log('\n🧹  TFS Wholesalers — Test Data Cleanup');
  console.log('━'.repeat(48));
  console.log(`Database : ${DB_NAME}`);
  console.log(`URI      : ${MONGO_URI.replace(/:\/\/.*@/, '://<credentials>@')}\n`);
  console.log('Collections that will be fully cleared:');
  COLLECTIONS_TO_CLEAR.forEach((c) => console.log(`  • ${c}`));
  console.log('\nCollections that will NOT be touched:');
  console.log('  • products, users, branches, roles');
  console.log('  • categories, hero-banners, settings');
  console.log('  • wholesale_customers, wholesale_products\n');

  const ok = await confirm('Type "yes" to proceed, anything else to abort: ');
  if (!ok) {
    console.log('\n🚫  Aborted. Nothing was changed.');
    process.exit(0);
  }

  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log('\n🔄  Running...\n');

    const results: { collection: string; deleted: number }[] = [];

    for (const name of COLLECTIONS_TO_CLEAR) {
      try {
        const col = db.collection(name);
        const count = await col.countDocuments();
        if (count === 0) {
          console.log(`  ⏭️  ${name} — already empty`);
          results.push({ collection: name, deleted: 0 });
          continue;
        }
        await col.deleteMany({});
        console.log(`  ✅  ${name} — deleted ${count} document${count !== 1 ? 's' : ''}`);
        results.push({ collection: name, deleted: count });
      } catch (err) {
        console.error(`  ❌  ${name} — error: ${err}`);
        results.push({ collection: name, deleted: -1 });
      }
    }

    const total = results.reduce((s, r) => s + Math.max(r.deleted, 0), 0);
    console.log('\n━'.repeat(48));
    console.log(`✅  Done. ${total} total document${total !== 1 ? 's' : ''} removed.\n`);
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});