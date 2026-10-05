/**
 * One-off migration: wire up Paystack payment routing per branch.
 *
 * - Ladysmith and Dundee get a subaccountCode (100% split, branch bears the fee).
 * - Vryheid gets routeToMainAccount: true (no subaccount yet — payments go
 *   straight to the main Paystack account, as agreed).
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/add-subaccounts.js
 *
 * If your project already loads a .env file via `lib/mongodb.ts`, check what
 * env var name it reads (commonly MONGODB_URI) and make sure it matches below,
 * or just export it inline before running:
 *
 *   export MONGODB_URI="mongodb+srv://..."
 *   node scripts/add-subaccounts.js
 *
 * Requires the `mongodb` package — already a dependency of this project.
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'tfs-wholesalers';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Run with:');
  console.error('   MONGODB_URI="mongodb+srv://..." node scripts/add-subaccounts.js');
  process.exit(1);
}

// ── The actual data being written ─────────────────────────────────────────
const UPDATES = [
  {
    slug: 'ladysmith',
    set: {
      'paymentConfig.paystack.subaccountCode': 'ACCT_3tdv7iltwh9x7j4',
      'paymentConfig.paystack.routeToMainAccount': false,
    },
  },
  {
    slug: 'dundee', // "TFS Discount Warehouse"
    set: {
      'paymentConfig.paystack.subaccountCode': 'ACCT_e3u1xw7x1p3caws',
      'paymentConfig.paystack.routeToMainAccount': false,
    },
  },
  {
    slug: 'vryheid',
    set: {
      'paymentConfig.paystack.subaccountCode': null,
      'paymentConfig.paystack.routeToMainAccount': true,
    },
  },
];

async function main() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const branches = db.collection('branches');

    console.log(`Connected. Updating ${UPDATES.length} branches in "${DB_NAME}"...\n`);

    for (const { slug, set } of UPDATES) {
      const result = await branches.updateOne(
        { slug },
        { $set: { ...set, updatedAt: new Date() } }
      );

      if (result.matchedCount === 0) {
        console.warn(`⚠️  No branch found with slug "${slug}" — nothing updated.`);
        continue;
      }

      console.log(`✅ ${slug}: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
    }

    // ── Verify: print back what each branch now has ───────────────────────
    console.log('\nVerifying...\n');
    const all = await branches
      .find(
        { slug: { $in: UPDATES.map((u) => u.slug) } },
        { projection: { slug: 1, name: 1, 'paymentConfig.paystack': 1 } }
      )
      .toArray();

    for (const b of all) {
      console.log(`${b.name} (${b.slug}):`, JSON.stringify(b.paymentConfig?.paystack, null, 2));
    }

    console.log('\nDone.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();