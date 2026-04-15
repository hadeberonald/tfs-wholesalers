// scripts/backfill-customer-fields.ts
//
// Run once to fix existing orders where customerName/customerEmail are null
// but customerInfo.name/email exist.
//
// Usage:
//   npx ts-node -r tsconfig-paths/register scripts/backfill-customer-fields.ts
//
// Or compile and run:
//   npx tsc scripts/backfill-customer-fields.ts --outDir dist && node dist/backfill-customer-fields.js

import clientPromise from '../lib/mongodb';

async function backfill() {
  const client = await clientPromise;
  const db     = client.db('tfs-wholesalers');
  const orders = db.collection('orders');

  // Find all orders where customerName is null/missing but customerInfo.name exists
  const affected = await orders.find({
    $and: [
      { $or: [{ customerName: null }, { customerName: { $exists: false } }] },
      { 'customerInfo.name': { $exists: true, $ne: null } },
    ],
  }).toArray();

  console.log(`Found ${affected.length} orders to backfill`);

  let updated = 0;
  for (const order of affected) {
    const name  = order.customerInfo?.name  ?? null;
    const email = order.customerInfo?.email ?? null;
    const addr  =
      order.deliveryAddress ||
      order.shippingAddress?.address ||
      null;

    const result = await orders.updateOne(
      { _id: order._id },
      {
        $set: {
          customerName:    name,
          customerEmail:   email,
          deliveryAddress: addr,
        },
      }
    );

    if (result.modifiedCount) {
      updated++;
      console.log(`  ✅ ${order.orderNumber} → name: "${name}", email: "${email}"`);
    }
  }

  console.log(`\nBackfill complete: ${updated} / ${affected.length} orders updated`);
  process.exit(0);
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});