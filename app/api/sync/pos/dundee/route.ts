/**
 * app/api/sync/pos/dundee/route.ts
 *
 * POS stock sync scoped exclusively to the Dundee branch.
 * Identical logic to app/api/sync/pos/route.ts but:
 *   - Branch ID is hardcoded to the Dundee ObjectId
 *   - Uses its own SYNC_SECRET_DUNDEE env var so the Dundee
 *     POS machine's secret is independent of other branches
 *   - Route is /api/sync/pos/dundee — the batch file on the
 *     Dundee POS machine points here, not at /api/sync/pos
 *
 * Add to .env:
 *   SYNC_SECRET_DUNDEE=<generate a new secret for this branch>
 *
 * ── DIAGNOSTICS ──────────────────────────────────────────────
 * GET /api/sync/pos/dundee?secret=<SYNC_SECRET_DUNDEE>
 *   Returns a safe (non-secret-leaking) status report: whether
 *   the env var is configured, whether the Dundee branch exists
 *   in Mongo, and how many products currently exist for it.
 *   Use this to verify the whole pipeline WITHOUT needing the
 *   POS machine or a CSV file.
 *
 * TEST WITHOUT THE POS MACHINE:
 *   curl -s -X POST "https://tfs-wholesalers.onrender.com/api/sync/pos/dundee" ^
 *        -H "Authorization: Bearer <SYNC_SECRET_DUNDEE>" ^
 *        -F "file=@sample.csv"
 *   (sample.csv just needs the same 7 columns as the real export)
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
// CONFIG — Dundee branch only
// ─────────────────────────────────────────────────────────────────────────────
const DUNDEE_BRANCH_ID = '698894236fadbf1e005f6c91';
const DB_NAME          = 'tfs-wholesalers';

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — hardened against invisible whitespace / stray quotes in the env var,
// and now logs enough (without leaking the real secret) to diagnose a mismatch
// ─────────────────────────────────────────────────────────────────────────────
function normalize(raw: string): string {
  // Strip surrounding whitespace/newlines (common when pasting into a
  // dashboard env var field) and strip a single layer of wrapping quotes
  // (common when copying a value that included quotes by accident).
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function authorized(request: NextRequest): { ok: boolean; reason?: string } {
  const rawSecret = process.env.SYNC_SECRET_DUNDEE || '';
  if (!rawSecret) {
    console.error('[Dundee Sync] SYNC_SECRET_DUNDEE env var is not set');
    return { ok: false, reason: 'env_missing' };
  }

  const secret = normalize(rawSecret);
  const rawHeader = request.headers.get('authorization') || '';

  // Accept "Bearer X" case-insensitively on the prefix, tolerate extra spaces
  const match = rawHeader.match(/^\s*bearer\s+(.*)$/i);
  const headerToken = match ? normalize(match[1]) : '';

  if (!rawHeader) {
    console.error('[Dundee Sync] No Authorization header on request at all');
    return { ok: false, reason: 'no_header' };
  }

  if (headerToken === secret) {
    return { ok: true };
  }

  // Mismatch — log enough to diagnose without ever printing the real secret
  console.error(
    `[Dundee Sync] Auth mismatch — ` +
    `header_len:${headerToken.length} secret_len:${secret.length} ` +
    `header_prefix:"${headerToken.slice(0, 4)}" secret_prefix:"${secret.slice(0, 4)}" ` +
    `header_suffix:"${headerToken.slice(-4)}" secret_suffix:"${secret.slice(-4)}"`
  );
  return { ok: false, reason: 'mismatch' };
}

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
// FILE INTAKE — multipart upload (HTTPS push from batch file)
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
    console.log(`[Dundee Sync] Received file — ${buffer.length} bytes`);
    return true;
  } catch (err: any) {
    console.error('[Dundee Sync] Failed to extract uploaded file:', err.message);
    return false;
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
      console.error('[Dundee Sync]', msg);
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
// GET — safe diagnostics, no data mutation.
// Requires the same secret (as ?secret= query param, since a browser can't
// easily set an Authorization header) so it doesn't leak anything publicly.
// Never echoes the actual secret value back.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const provided = normalize(request.nextUrl.searchParams.get('secret') || '');
  const expected = normalize(process.env.SYNC_SECRET_DUNDEE || '');

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'SYNC_SECRET_DUNDEE is not set on the server' },
      { status: 500 },
    );
  }

  if (!provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!ObjectId.isValid(DUNDEE_BRANCH_ID)) {
      return NextResponse.json({
        ok: false,
        error: `DUNDEE_BRANCH_ID "${DUNDEE_BRANCH_ID}" is not a valid ObjectId`,
      });
    }

    const branchOid = new ObjectId(DUNDEE_BRANCH_ID);
    const client     = await clientPromise;
    const db         = client.db(DB_NAME);

    const branchDoc      = await db.collection('branches').findOne({ _id: branchOid });
    const productCount   = await db.collection('products').countDocuments({ branchId: branchOid });
    const activeCount    = await db.collection('products').countDocuments({ branchId: branchOid, active: true });
    const lastSyncLog    = await db.collection('syncLog')
      .find({ type: 'pos_ftp_sync', branch: 'dundee' })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    return NextResponse.json({
      ok: true,
      envConfigured: true,
      secretLength: expected.length,
      dundeeBranchId: DUNDEE_BRANCH_ID,
      branchFoundInDb: !!branchDoc,
      branchName: branchDoc?.name ?? null,
      branchStatus: branchDoc?.status ?? null,
      totalProductsForBranch: productCount,
      activeProductsForBranch: activeCount,
      lastSyncLog: lastSyncLog[0] ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER — POST
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  console.log('[Dundee Sync] Request received');

  const auth = authorized(request);
  if (!auth.ok) {
    console.error(`[Dundee Sync] Rejected — reason: ${auth.reason}`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const branchOid = new ObjectId(DUNDEE_BRANCH_ID);
  const localPath = path.join(os.tmpdir(), `pos_sync_dundee_${Date.now()}.csv`);
  const startTime = Date.now();

  try {
    const wasUploaded = await extractUploadedFile(request, localPath);
    if (!wasUploaded) {
      console.error('[Dundee Sync] No file received in multipart body');
      return NextResponse.json(
        { error: 'No file received. This route only accepts HTTPS push (multipart upload).' },
        { status: 400 },
      );
    }

    const rows = await parseCsv(localPath);
    console.log(`[Dundee Sync] Parsed ${rows.length} rows`);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV parsed to 0 rows — aborting to prevent data loss' },
        { status: 422 },
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const result  = await syncProducts(db, rows, branchOid);
    const expired = await expireDatedSpecials(db, branchOid);
    result.specialsExpired += expired;

    const durationMs = Date.now() - startTime;

    await db.collection('syncLog').insertOne({
      type:            'pos_ftp_sync',
      branch:          'dundee',
      branchId:        DUNDEE_BRANCH_ID,
      success:         true,
      method:          'https_push',
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
      `[Dundee Sync] ✅ Done in ${durationMs}ms — ` +
      `updated:${result.updated} created:${result.created} ` +
      `specials:${result.specialsApplied} errors:${result.errors.length}`
    );

    return NextResponse.json({
      success:         true,
      branch:          'dundee',
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
    console.error('[Dundee Sync] Fatal:', err.message);

    try {
      const client = await clientPromise;
      await client.db(DB_NAME).collection('syncLog').insertOne({
        type:      'pos_ftp_sync',
        branch:    'dundee',
        branchId:  DUNDEE_BRANCH_ID,
        success:   false,
        method:    'https_push',
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