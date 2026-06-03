/**
 * app/api/sync/wholesale/route.ts
 *
 * Syncs WholesaleMaster.csv into wholesale_product_configs.
 *
 * CSV columns (same as retail POS):
 *   Code, Bar Code, Description, Qty, Inc.Price, inc.spl, end Date
 *
 * Behaviour:
 *  - Matches products by barcode first, SKU fallback (same as retail sync)
 *  - If product exists in `products` collection → upserts wholesale_product_config
 *    and auto-activates it
 *  - If product does NOT exist → creates a new inactive product + inactive config
 *    (admin must review and activate)
 *  - MOQ / units-per-box config set via admin dashboard — this sync only
 *    updates stock level and price, never overwrites MOQ fields already set
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId, Db } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const CFG = {
  syncSecret: process.env.SYNC_SECRET || '',
  branchId:   process.env.BRANCH_ID   || '',
  dbName:     'tfs-wholesalers',
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface CsvRow {
  code:        string;
  barcode:     string;
  description: string;
  qty:         number;
  incPrice:    number;
  incSpl:      number;
  endDate:     string | null;
}

interface SyncResult {
  updated:  number;
  created:  number;
  skipped:  number;
  errors:   string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
function authorized(request: NextRequest): boolean {
  if (!CFG.syncSecret) return false;
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${CFG.syncSecret}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE EXTRACTION (multipart upload)
// ─────────────────────────────────────────────────────────────────────────────
async function extractUploadedFile(request: NextRequest, localPath: string): Promise<boolean> {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) return false;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return false;

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) return false;

    fs.writeFileSync(localPath, buffer);
    console.log(`[WholesaleSync] Received uploaded file — ${buffer.length} bytes`);
    return true;
  } catch (err: any) {
    console.error('[WholesaleSync] Failed to extract file:', err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV PARSING — identical format to retail sync
// ─────────────────────────────────────────────────────────────────────────────
function parseDate(raw: string): string | null {
  if (!raw) return null;
  if (raw.replace(/[\s/]/g, '') === '') return null;
  const parts = raw.trim().split('/');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

async function parseCsv(filePath: string): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];

  const rl = readline.createInterface({
    input:     fs.createReadStream(filePath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  });

  let headerSkipped = false;

  for await (const line of rl) {
    if (!headerSkipped) { headerSkipped = true; continue; }
    if (!line.trim()) continue;

    const cols = line.split(',').map(c => c.trim());
    if (cols.length < 7) continue;

    const [code, barcode, description, qtyRaw, incPriceRaw, incSplRaw, ...dateParts] = cols;
    const endDateRaw = dateParts.join(',').trim();
    const qty        = parseInt(qtyRaw, 10);
    const incPrice   = parseFloat(incPriceRaw);
    const incSpl     = parseFloat(incSplRaw) || 0;

    if (!code || isNaN(incPrice)) continue;

    rows.push({
      code:        code.trim(),
      barcode:     barcode.replace(/\s/g, ''),
      description: description.trim(),
      qty:         isNaN(qty) ? 0 : Math.max(0, qty),
      incPrice,
      incSpl,
      endDate:     parseDate(endDateRaw),
    });
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT LOOKUP — barcode first, SKU fallback
// ─────────────────────────────────────────────────────────────────────────────
async function findProduct(db: Db, row: CsvRow, branchOid: ObjectId) {
  if (row.barcode) {
    const hit = await db.collection('products').findOne({
      branchId: branchOid,
      $or: [
        { barcode: row.barcode },
        { 'variants.barcode': row.barcode },
      ],
    });
    if (hit) return { product: hit, matchedBy: 'barcode' };
  }

  if (row.code) {
    const hit = await db.collection('products').findOne({
      branchId: branchOid,
      $or: [
        { sku: row.code },
        { 'variants.sku': row.code },
      ],
    });
    if (hit) return { product: hit, matchedBy: 'sku' };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPSERT WHOLESALE CONFIG
// Only sets price fields — never overwrites MOQ/unitsPerBox if already set
// ─────────────────────────────────────────────────────────────────────────────
async function upsertWholesaleConfig(
  db:        Db,
  productId: ObjectId,
  row:       CsvRow,
  branchOid: ObjectId,
  activate:  boolean,
): Promise<'created' | 'updated'> {
  const existing = await db.collection('wholesale_product_configs').findOne({
    productId,
    branchId: branchOid,
    variantId: null,
  });

  const now = new Date();

  if (existing) {
    // Update price only — preserve MOQ/box config set via admin dashboard
    const $set: Record<string, any> = {
      pricePerBox: row.incPrice,
      updatedAt:   now,
    };
    if (activate) $set.active = true;
    // Sync stock level back to the product (not stored on config)
    await db.collection('products').updateOne(
      { _id: productId },
      { $set: { stockLevel: row.qty, price: row.incPrice, updatedAt: now } }
    );
    await db.collection('wholesale_product_configs').updateOne(
      { _id: existing._id },
      { $set }
    );
    return 'updated';
  }

  // Create a new config with sensible defaults — admin can refine MOQ/box via dashboard
  await db.collection('wholesale_product_configs').insertOne({
    productId,
    variantId:   null,
    branchId:    branchOid,
    moq:         1,           // default — admin sets real value on dashboard
    moqUnit:     'box',
    unitsPerBox: 1,           // default — admin sets real value on dashboard
    pricePerBox: row.incPrice,
    active:      activate,
    source:      'wholesale_csv_sync',
    createdAt:   now,
    updatedAt:   now,
  });
  return 'created';
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE SYNC LOOP
// ─────────────────────────────────────────────────────────────────────────────
async function syncWholesaleProducts(
  db:        Db,
  rows:      CsvRow[],
  branchOid: ObjectId,
): Promise<SyncResult> {
  const result: SyncResult = { updated: 0, created: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    try {
      const match = await findProduct(db, row, branchOid);

      if (match) {
        // Product exists — upsert config, auto-activate
        await upsertWholesaleConfig(db, match.product._id, row, branchOid, true);
        result.updated++;
      } else {
        // Product doesn't exist — create inactive product + inactive config
        if (!row.barcode && !row.code) { result.skipped++; continue; }

        const slug = row.description
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 80);

        const slugExists = await db.collection('products').findOne({ branchId: branchOid, slug });
        const finalSlug  = slugExists ? `${slug}-${row.code.toLowerCase()}` : slug;

        const { insertedId } = await db.collection('products').insertOne({
          name:              row.description,
          slug:              finalSlug,
          description:       '',
          categories:        [],
          price:             row.incPrice,
          sku:               row.code,
          barcode:           row.barcode || null,
          stockLevel:        row.qty,
          lowStockThreshold: 10,
          images:            [],
          hasVariants:       false,
          variants:          [],
          onSpecial:         false,
          specialPrice:      null,
          active:            false,   // needs admin review before going live
          featured:          false,
          branchId:          branchOid,
          source:            'wholesale_csv_sync',
          createdAt:         new Date(),
          updatedAt:         new Date(),
        });

        await upsertWholesaleConfig(db, insertedId, row, branchOid, false);
        result.created++;
      }
    } catch (err: any) {
      const msg = `[${row.code}/${row.barcode}] ${err.message}`;
      console.error('[WholesaleSync]', msg);
      result.errors.push(msg);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ObjectId.isValid(CFG.branchId)) {
    return NextResponse.json(
      { error: 'BRANCH_ID env var missing or invalid' },
      { status: 500 }
    );
  }

  const branchOid = new ObjectId(CFG.branchId);
  const localPath = path.join(os.tmpdir(), `wholesale_sync_${Date.now()}.csv`);
  const startTime = Date.now();

  try {
    const uploaded = await extractUploadedFile(request, localPath);
    if (!uploaded) {
      return NextResponse.json(
        { error: 'No file attached. Send CSV as multipart/form-data field named "file".' },
        { status: 400 }
      );
    }

    const rows = await parseCsv(localPath);
    console.log(`[WholesaleSync] Parsed ${rows.length} rows`);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV parsed to 0 rows — aborting to prevent data loss' },
        { status: 422 }
      );
    }

    const client = await clientPromise;
    const db     = client.db(CFG.dbName);

    const result     = await syncWholesaleProducts(db, rows, branchOid);
    const durationMs = Date.now() - startTime;

    await db.collection('syncLog').insertOne({
      type:      'wholesale_csv_sync',
      success:   true,
      branchId:  CFG.branchId,
      csvRows:   rows.length,
      ...result,
      durationMs,
      createdAt: new Date(),
    });

    console.log(
      `[WholesaleSync] ✅ Done in ${durationMs}ms — ` +
      `updated:${result.updated} created:${result.created} errors:${result.errors.length}`
    );

    return NextResponse.json({ success: true, csvRows: rows.length, ...result, durationMs });

  } catch (err: any) {
    console.error('[WholesaleSync] Fatal:', err.message);
    try {
      const client = await clientPromise;
      await client.db(CFG.dbName).collection('syncLog').insertOne({
        type:      'wholesale_csv_sync',
        success:   false,
        branchId:  CFG.branchId,
        error:     err.message,
        durationMs: Date.now() - startTime,
        createdAt: new Date(),
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({ error: err.message }, { status: 500 });

  } finally {
    if (fs.existsSync(localPath)) {
      try { fs.unlinkSync(localPath); } catch { /* non-fatal */ }
    }
  }
}