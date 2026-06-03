/**
 * scripts/seed-wholesale.ts
 *
 * Seeds sample wholesale products so the shop isn't empty before the first
 * CSV sync. Run once:
 *   npx ts-node --project tsconfig.json scripts/seed-wholesale.ts
 *
 * All seeded products are marked source:'seed' — delete them from the admin
 * dashboard once real products sync in.
 *
 * REQUIRED ENV:  MONGODB_URI  and  BRANCH_ID
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const BRANCH_ID   = process.env.BRANCH_ID   || '';
const DB_NAME     = 'tfs-wholesalers';

if (!MONGODB_URI || !BRANCH_ID) {
  console.error('❌  MONGODB_URI and BRANCH_ID env vars are required');
  process.exit(1);
}

if (!ObjectId.isValid(BRANCH_ID)) {
  console.error('❌  BRANCH_ID is not a valid ObjectId');
  process.exit(1);
}

const branchOid = new ObjectId(BRANCH_ID);

const SAMPLES = [
  {
    name:        'Coca-Cola 330ml Cans',
    sku:         'WS-COCA-330',
    barcode:     '5000112637922',
    description: 'Coca-Cola classic 330ml cans — wholesale case',
    price:        195.00,
    moq:          1,
    moqUnit:     'case',
    unitsPerBox:  24,
    pricePerBox:  195.00,
  },
  {
    name:        'Simba Chips Assorted 30g x 24',
    sku:         'WS-SIMBA-30',
    barcode:     '6001069036019',
    description: 'Simba assorted flavours 30g — box of 24',
    price:        144.00,
    moq:          2,
    moqUnit:     'box',
    unitsPerBox:  24,
    pricePerBox:  144.00,
  },
  {
    name:        'Albany Superior White Bread 700g',
    sku:         'WS-ALB-WH700',
    barcode:     '6001149106007',
    description: 'Albany Superior white bread 700g — tray of 12',
    price:        216.00,
    moq:          1,
    moqUnit:     'tray',
    unitsPerBox:  12,
    pricePerBox:  216.00,
  },
  {
    name:        'Sunlight Dishwashing Liquid 750ml',
    sku:         'WS-SUN-750',
    barcode:     '6001087379043',
    description: 'Sunlight original 750ml — box of 12',
    price:        228.00,
    moq:          1,
    moqUnit:     'box',
    unitsPerBox:  12,
    pricePerBox:  228.00,
  },
  {
    name:        'Ricoffy 750g',
    sku:         'WS-RICO-750',
    barcode:     '6001009000254',
    description: 'Ricoffy chicory coffee blend 750g — box of 6',
    price:        390.00,
    moq:          1,
    moqUnit:     'box',
    unitsPerBox:  6,
    pricePerBox:  390.00,
  },
  {
    name:        'Ace Maize Meal 5kg',
    sku:         'WS-ACE-5KG',
    barcode:     '6001068085118',
    description: 'Ace super maize meal 5kg — bag of 8',
    price:        480.00,
    moq:          1,
    moqUnit:     'bag',
    unitsPerBox:  8,
    pricePerBox:  480.00,
  },
  {
    name:        'Clover Full Cream Milk 1L',
    sku:         'WS-CLV-MILK1L',
    barcode:     '6001243132584',
    description: 'Clover full cream long-life milk 1L — case of 12',
    price:        270.00,
    moq:          2,
    moqUnit:     'case',
    unitsPerBox:  12,
    pricePerBox:  270.00,
  },
  {
    name:        'Lucky Star Pilchards in Tomato 400g',
    sku:         'WS-LS-PILCH400',
    barcode:     '6001259100097',
    description: 'Lucky Star pilchards in tomato sauce 400g — case of 24',
    price:        456.00,
    moq:          1,
    moqUnit:     'case',
    unitsPerBox:  24,
    pricePerBox:  456.00,
  },
];

async function run() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log(`\n🌱  Seeding wholesale products for branch ${BRANCH_ID}...\n`);

  let created = 0;
  let skipped = 0;

  for (const item of SAMPLES) {
    const existing = await db.collection('products').findOne({
      branchId: branchOid,
      sku:      item.sku,
    });

    if (existing) {
      console.log(`  ⚠️  Skipping "${item.name}" — SKU already exists`);
      skipped++;
      continue;
    }

    const slug = item.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { insertedId } = await db.collection('products').insertOne({
      name:              item.name,
      slug,
      description:       item.description,
      categories:        [],
      tags:              [],
      price:             item.price,
      compareAtPrice:    null,
      costPrice:         null,
      sku:               item.sku,
      barcode:           item.barcode,
      stockLevel:        100,
      lowStockThreshold: 10,
      images:            [],
      hasVariants:       false,
      variants:          [],
      onSpecial:         false,
      specialPrice:      null,
      active:            true,
      featured:          false,
      branchId:          branchOid,
      source:            'seed',
      createdAt:         new Date(),
      updatedAt:         new Date(),
    });

    await db.collection('wholesale_product_configs').insertOne({
      productId:   insertedId,
      variantId:   null,
      branchId:    branchOid,
      moq:         item.moq,
      moqUnit:     item.moqUnit,
      unitsPerBox: item.unitsPerBox,
      pricePerBox: item.pricePerBox,
      active:      true,
      source:      'seed',
      createdAt:   new Date(),
      updatedAt:   new Date(),
    });

    console.log(`  ✅  Created "${item.name}" (${item.sku})`);
    created++;
  }

  console.log(`\n✨  Done — ${created} created, ${skipped} skipped\n`);
  console.log('💡  To remove seed data later, filter products by source:"seed" in the admin dashboard.\n');

  await client.close();
}

run().catch(err => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});