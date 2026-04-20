/**
 * app/api/sync/pos/route.ts
 *
 * Two intake methods — whichever works:
 *
 *  1. HTTPS PUSH (primary)
 *     POS machine batch file POSTs the CSV as a multipart form upload.
 *     Works right now, no MTN needed.
 *
 *  2. FTP PULL (automatic fallback)
 *     If no file is attached, the route pulls from FTP.
 *     Kicks in automatically once MTN opens port 21 — zero code changes.
 *
 * Called by:
 *   - Windows batch file on POS server (every 30 min, only when file changes)
 *   - instrumentation.ts scheduler (every hour, checks MongoDB timing)
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise                  from '@/lib/mongodb';
import { ObjectId, Db }               from 'mongodb';
import * as fs                        from 'fs';
import * as path                      from 'path';
import * as os                        from 'os';
import * as readline                  from 'readline';

export const dynamic     = 'force-dynamic';
export const maxDuration = 300;

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const CFG = {
  syncSecret: process.env.SYNC_SECRET || '',
  ftp: {
    host:       process.env.FTP_HOST        || '',
    port:       parseInt(process.env.FTP_PORT || '21'),
    user:       process.env.FTP_USER        || '',
    password:   process.env.FTP_PASSWORD    || '',
    secure:     process.env.FTP_SECURE      === 'true',
    remotePath: process.env.FTP_REMOTE_PATH || '/Online Stock Master.CSV',
  },
  branchId: process.env.BRANCH_ID || '',
  dbName:   'tfs-wholesalers',
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
  updated:         number;
  created:         number;
  skipped:         number;
  specialsApplied: number;
  specialsExpired: number;
  errors:          string[];
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
// METHOD 1 — extract uploaded file from multipart form data
// ─────────────────────────────────────────────────────────────────────────────
async function extractUploadedFile(request: NextRequest, localPath: string): Promise<boolean> {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) return false;

    const formData = await request.formData();
    const file     = formData.get('file') as File | null;

    if (!file) return false;

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) return false;

    fs.writeFileSync(localPath, buffer);
    console.log(`[Sync] Received uploaded file — ${buffer.length} bytes`);
    return true;
  } catch (err: any) {
    console.error('[Sync] Failed to extract uploaded file:', err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// METHOD 2 — FTP pull (fallback once MTN opens port 21)
// ─────────────────────────────────────────────────────────────────────────────
async function downloadViaFtp(localPath: string): Promise<void> {
  // Dynamic import so the module only loads when actually needed
  const ftp = await import('basic-ftp');
  const client = new ftp.Client(30_000);
  client.ftp.verbose = false;

  try {
    await client.access({
      host:     CFG.ftp.host,
      port:     CFG.ftp.port,
      user:     CFG.ftp.user,
      password: CFG.ftp.password,
      secure:   CFG.ftp.secure,
    });

    client.ftp.socket.setKeepAlive(true);
    console.log(`[FTP] Connected to ${CFG.ftp.host}`);

    await client.downloadTo(localPath, CFG.ftp.remotePath);

    const stat = fs.statSync(localPath);
    if (stat.size === 0) throw new Error('Downloaded file is empty');

    console.log(`[FTP] Downloaded ${stat.size} bytes`);
  } finally {
    client.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV PARSING
// Columns: Code, Bar Code, Description, Qty, Inc.Price, inc.spl, end Date
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

    const cols        = line.split(',').map(c => c.trim());
    if (cols.length < 7) continue;

    const [code, barcode, description, qtyRaw, incPriceRaw, incSplRaw, ...dateParts] = cols;
    const endDateRaw  = dateParts.join(',').trim();
    const qty         = parseInt(qtyRaw, 10);
    const incPrice    = parseFloat(incPriceRaw);
    const incSpl      = parseFloat(incSplRaw) || 0;

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
// SPECIAL MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
async function upsertPosSpecial(
  db:           Db,
  productId:    ObjectId,
  productName:  string,
  specialPrice: number,
  endDateIso:   string | null,
  branchOid:    ObjectId,
): Promise<ObjectId> {
  const now = new Date();
  const doc = {
    name:        productName,
    slug:        `pos-special-${productId.toString()}`,
    description: '',
    type:        'fixed_price',
    productId:   productId.toString(),
    conditions:  { newPrice: specialPrice },
    badgeText:   'SPECIAL',
    active:      true,
    featured:    false,
    startDate:   now,
    endDate:     endDateIso ? new Date(endDateIso) : null,
    branchId:    branchOid,
    source:      'pos_ftp_sync',
    updatedAt:   now,
  };

  const existing = await db.collection('specials').findOne({
    productId: productId.toString(),
    source:    'pos_ftp_sync',
    branchId:  branchOid,
  });

  if (existing) {
    await db.collection('specials').updateOne({ _id: existing._id }, { $set: doc });
    return existing._id;
  }

  const res = await db.collection('specials').insertOne({ ...doc, createdAt: now });
  return res.insertedId;
}

async function deactivatePosSpecial(
  db:        Db,
  productId: ObjectId,
  branchOid: ObjectId,
): Promise<boolean> {
  const res = await db.collection('specials').updateMany(
    {
      productId: productId.toString(),
      source:    'pos_ftp_sync',
      branchId:  branchOid,
      active:    true,
    },
    { $set: { active: false, updatedAt: new Date() } },
  );
  return res.modifiedCount > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK LEDGER
// ─────────────────────────────────────────────────────────────────────────────
async function writeLedger(db: Db, entry: Record<string, any>) {
  await db.collection('stockLedger').insertOne({ ...entry, createdAt: new Date() });
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE SYNC LOOP
// ─────────────────────────────────────────────────────────────────────────────
async function syncProducts(
  db:        Db,
  rows:      CsvRow[],
  branchOid: ObjectId,
): Promise<SyncResult> {
  const result: SyncResult = {
    updated: 0, created: 0, skipped: 0,
    specialsApplied: 0, specialsExpired: 0, errors: [],
  };

  for (const row of rows) {
    try {
      const match = await findProduct(db, row, branchOid);

      if (match) {
        const { product, matchedBy } = match;
        const productId  = product._id as ObjectId;
        const hasSpecial = row.incSpl > 0;

        const $set: Record<string, any> = {
          stockLevel: row.qty,
          price:      row.incPrice,
          updatedAt:  new Date(),
        };

        if (hasSpecial) {
          $set.onSpecial    = true;
          $set.specialPrice = row.incSpl;
          if (row.endDate) $set.specialEndDate = new Date(row.endDate);
          $set.specialId    = await upsertPosSpecial(
            db, productId, product.name, row.incSpl, row.endDate, branchOid,
          );
          result.specialsApplied++;
        } else {
          const expired = await deactivatePosSpecial(db, productId, branchOid);
          if (expired) result.specialsExpired++;

          const manualSpecial = product.specialId
            ? await db.collection('specials').findOne({
                _id:    product.specialId,
                source: { $ne: 'pos_ftp_sync' },
                active: true,
              })
            : null;

          if (!manualSpecial) {
            $set.onSpecial    = false;
            $set.specialPrice = null;
            $set.specialId    = null;
          }
        }

        await db.collection('products').updateOne({ _id: productId }, { $set });

        await writeLedger(db, {
          branchId:             branchOid,
          productId,
          productName:          product.name,
          sku:                  row.code,
          barcode:              row.barcode,
          eventType:            'pos_sync',
          previousStock:        product.stockLevel ?? 0,
          newStock:             row.qty,
          delta:                row.qty - (product.stockLevel ?? 0),
          previousPrice:        product.price ?? 0,
          newPrice:             row.incPrice,
          previousSpecialPrice: product.specialPrice ?? null,
          newSpecialPrice:      hasSpecial ? row.incSpl : null,
          source:               'pos_ftp_sync',
          matchedBy,
        });

        result.updated++;

      } else {
        if (!row.barcode && !row.code) { result.skipped++; continue; }

        const slug = row.description
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 80);

        const slugExists = await db.collection('products').findOne({
          branchId: branchOid, slug,
        });
        const finalSlug = slugExists ? `${slug}-${row.code.toLowerCase()}` : slug;

        const newProduct = {
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
          onSpecial:         row.incSpl > 0,
          specialPrice:      row.incSpl > 0 ? row.incSpl : null,
          specialEndDate:    row.endDate ? new Date(row.endDate) : null,
          active:            false,
          featured:          false,
          branchId:          branchOid,
          source:            'pos_ftp_sync',
          createdAt:         new Date(),
          updatedAt:         new Date(),
        };

        const { insertedId } = await db.collection('products').insertOne(newProduct);

        if (row.incSpl > 0) {
          await upsertPosSpecial(
            db, insertedId, row.description, row.incSpl, row.endDate, branchOid,
          );
          result.specialsApplied++;
        }

        await writeLedger(db, {
          branchId:        branchOid,
          productId:       insertedId,
          productName:     row.description,
          sku:             row.code,
          barcode:         row.barcode,
          eventType:       'pos_sync',
          previousStock:   null,
          newStock:        row.qty,
          delta:           row.qty,
          newPrice:        row.incPrice,
          newSpecialPrice: row.incSpl > 0 ? row.incSpl : null,
          source:          'pos_ftp_sync',
          notes:           'New product from POS — inactive pending review',
        });

        result.created++;
      }
    } catch (err: any) {
      const msg = `[${row.code}/${row.barcode}] ${err.message}`;
      console.error('[Sync]', msg);
      result.errors.push(msg);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRE DATED SPECIALS
// ─────────────────────────────────────────────────────────────────────────────
async function expireDatedSpecials(db: Db, branchOid: ObjectId): Promise<number> {
  const now = new Date();

  const res = await db.collection('specials').updateMany(
    {
      branchId: branchOid,
      source:   'pos_ftp_sync',
      active:   true,
      endDate:  { $lt: now, $ne: null },
    },
    { $set: { active: false, updatedAt: now } },
  );

  if (res.modifiedCount > 0) {
    const justExpired = await db.collection('specials').find({
      branchId:  branchOid,
      source:    'pos_ftp_sync',
      active:    false,
      endDate:   { $lt: now, $ne: null },
      updatedAt: { $gte: new Date(now.getTime() - 60_000) },
    }).toArray();

    for (const s of justExpired) {
      if (s.productId) {
        await db.collection('products').updateOne(
          { _id: new ObjectId(s.productId) },
          {
            $set: {
              onSpecial:    false,
              specialPrice: null,
              specialId:    null,
              updatedAt:    now,
            },
          },
        );
      }
    }
  }

  return res.modifiedCount;
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
      { error: 'BRANCH_ID env var is missing or not a valid ObjectId' },
      { status: 500 },
    );
  }

  const branchOid = new ObjectId(CFG.branchId);
  const localPath = path.join(os.tmpdir(), `pos_sync_${Date.now()}.csv`);
  const startTime = Date.now();
  let   method    = 'unknown';

  try {
    // ── Step 1: Get the CSV — push first, FTP fallback ───────────────────
    const wasUploaded = await extractUploadedFile(request, localPath);

    if (wasUploaded) {
      method = 'https_push';
      console.log('[Sync] Using HTTPS push from POS machine');
    } else {
      method = 'ftp_pull';
      console.log('[Sync] No file uploaded — attempting FTP pull');
      await downloadViaFtp(localPath);
    }

    // ── Step 2: Parse ────────────────────────────────────────────────────
    const rows = await parseCsv(localPath);
    console.log(`[Sync] Parsed ${rows.length} rows via ${method}`);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV parsed to 0 rows — aborting to prevent data loss' },
        { status: 422 },
      );
    }

    // ── Step 3: Connect ──────────────────────────────────────────────────
    const client = await clientPromise;
    const db     = client.db(CFG.dbName);

    // ── Step 4: Sync ─────────────────────────────────────────────────────
    const result  = await syncProducts(db, rows, branchOid);

    // ── Step 5: Expire dated specials ────────────────────────────────────
    const expired = await expireDatedSpecials(db, branchOid);
    result.specialsExpired += expired;

    const durationMs = Date.now() - startTime;

    // ── Step 6: Log ──────────────────────────────────────────────────────
    await db.collection('syncLog').insertOne({
      type:            'pos_ftp_sync',
      success:         true,
      method,
      branchId:        CFG.branchId,
      csvRows:         rows.length,
      updated:         result.updated,
      created:         result.created,
      skipped:         result.skipped,
      specialsApplied: result.specialsApplied,
      specialsExpired: result.specialsExpired,
      errors:          result.errors,
      durationMs,
      createdAt:       new Date(),
    });

    console.log(
      `[Sync] ✅ Done in ${durationMs}ms via ${method} — ` +
      `updated:${result.updated} created:${result.created} ` +
      `specials:${result.specialsApplied} errors:${result.errors.length}`
    );

    return NextResponse.json({
      success:         true,
      method,
      csvRows:         rows.length,
      updated:         result.updated,
      created:         result.created,
      skipped:         result.skipped,
      specialsApplied: result.specialsApplied,
      specialsExpired: result.specialsExpired,
      errors:          result.errors,
      durationMs,
    });

  } catch (err: any) {
    console.error('[Sync] Fatal:', err.message);

    try {
      const client = await clientPromise;
      await client.db(CFG.dbName).collection('syncLog').insertOne({
        type:      'pos_ftp_sync',
        success:   false,
        method,
        branchId:  CFG.branchId,
        error:     err.message,
        durationMs: Date.now() - startTime,
        createdAt: new Date(),
      });
    } catch { /* log write must never mask the real error */ }

    return NextResponse.json({ error: err.message }, { status: 500 });

  } finally {
    if (fs.existsSync(localPath)) {
      try { fs.unlinkSync(localPath); } catch { /* non-fatal */ }
    }
  }
}