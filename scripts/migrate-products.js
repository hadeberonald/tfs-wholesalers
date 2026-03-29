const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'tfs-wholesalers';
const BRANCH_SLUG = 'vryheid';
const CSV_FILE = path.join(__dirname, 'products.csv');

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env');
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI, {
  tls: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
});

function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter(l => l.trim());

  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const headers = firstLine.split(delimiter).map(h => h.trim());

  return lines.slice(1).map(line => {
    const cols = line.split(delimiter).map(c => c.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cols[i] || ''));
    return row;
  }).filter(r => r['Description']?.trim());
}

function toSlug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function migrate() {
  console.log('🚀 Starting products migration...\n');

  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ products.csv not found at: ${CSV_FILE}`);
    process.exit(1);
  }

  const rows = parseCSV(CSV_FILE);
  console.log(`📄 ${rows.length} products found in CSV\n`);

  await client.connect();
  console.log('✅ Connected to MongoDB\n');

  const db = client.db(DB_NAME);

  const branch = await db.collection('branches').findOne({ slug: BRANCH_SLUG });
  if (!branch) {
    console.error(`❌ Branch "${BRANCH_SLUG}" not found`);
    await client.close();
    process.exit(1);
  }
  console.log(`🏪 Branch: ${branch.displayName || branch.name}\n`);

  const dropped = await db.collection('products').deleteMany({ branchId: branch._id });
  console.log(`🗑️  Dropped ${dropped.deletedCount} existing products\n`);

  const docs = rows.map(row => ({
    name: row['Description'].trim(),
    slug: toSlug(row['Description'].trim()),
    sku: row['Code']?.trim() || '',
    barcode: row['Bar Code']?.trim() || '',
    price: parseFloat(row['Inc.Price']) || 0,
    stockLevel: parseInt(row['Qty']) || 0,
    lowStockThreshold: 10,
    categories: [],
    images: [],
    active: true,
    branchId: branch._id,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const result = await db.collection('products').insertMany(docs, { ordered: false });

  console.log(`✅ Inserted ${result.insertedCount} products`);

  await client.close();
  console.log('\n🔌 Done');
}

migrate().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});