/**
 * app/api/stock-ledger/route.ts
 *
 * Unified inventory movement log.
 *
 * eventType values:
 *   pos_sync           — hourly FTP sync from POS
 *   online_sale        — customer order deduction
 *   po_receiving       — purchase order stock received
 *   manual_adjustment  — admin correction
 *   oos_correction     — picker marked OOS (written by item-oos route)
 *
 * GET  ?productId=&eventType=&from=&to=&page=&limit=
 * POST { productId, variantId?, eventType, delta, notes?, orderId?, poId? }
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise                  from '@/lib/mongodb';
import { ObjectId }                   from 'mongodb';
import { getAdminBranch }             from '@/lib/get-admin-branch';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const sp        = request.nextUrl.searchParams;
    const productId = sp.get('productId');
    const eventType = sp.get('eventType');
    const from      = sp.get('from');
    const to        = sp.get('to');
    const page      = Math.max(1, parseInt(sp.get('page')  || '1'));
    const limit     = Math.min(200, parseInt(sp.get('limit') || '50'));

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const query: any = {};

    if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
      query.branchId = adminInfo.branchId;
    }

    if (productId) {
      try { query.productId = new ObjectId(productId); } catch { query.productId = productId; }
    }

    if (eventType) query.eventType = eventType;

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to)   query.createdAt.$lte = new Date(to);
    }

    const [total, entries] = await Promise.all([
      db.collection('stockLedger').countDocuments(query),
      db.collection('stockLedger')
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return NextResponse.json({
      entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Failed to fetch stock ledger:', error);
    return NextResponse.json({ error: 'Failed to fetch stock ledger' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — admin-initiated movement (online_sale / po_receiving / manual_adjustment)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const body = await request.json();
    const { productId, variantId, eventType, delta, notes, orderId, poId } = body;

    if (!productId || !eventType || delta === undefined) {
      return NextResponse.json(
        { error: 'productId, eventType, and delta are required' },
        { status: 400 },
      );
    }

    const ALLOWED = ['online_sale', 'po_receiving', 'manual_adjustment'];
    if (!ALLOWED.includes(eventType)) {
      return NextResponse.json(
        { error: `eventType must be one of: ${ALLOWED.join(', ')}` },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!adminInfo.isSuperAdmin && product.branchId?.toString() !== adminInfo.branchId?.toString()) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    let previousStock: number;
    let newStock: number;

    if (variantId && product.variants?.length > 0) {
      const variant = product.variants.find((v: any) => v._id === variantId);
      if (!variant) return NextResponse.json({ error: 'Variant not found' }, { status: 404 });

      previousStock = variant.stockLevel ?? 0;
      newStock      = Math.max(0, previousStock + delta);

      await db.collection('products').updateOne(
        { _id: new ObjectId(productId), 'variants._id': variantId },
        { $set: { 'variants.$.stockLevel': newStock, updatedAt: new Date() } },
      );
    } else {
      previousStock = product.stockLevel ?? 0;
      newStock      = Math.max(0, previousStock + delta);

      await db.collection('products').updateOne(
        { _id: new ObjectId(productId) },
        { $set: { stockLevel: newStock, updatedAt: new Date() } },
      );
    }

    const entry = {
      branchId:     adminInfo.branchId ?? product.branchId,
      productId:    new ObjectId(productId),
      variantId:    variantId || undefined,
      productName:  product.name,
      sku:          variantId
        ? product.variants?.find((v: any) => v._id === variantId)?.sku || product.sku
        : product.sku,
      eventType,
      previousStock,
      newStock,
      delta,
      orderId:      orderId ? new ObjectId(orderId) : undefined,
      poId:         poId    ? new ObjectId(poId)    : undefined,
      performedBy:  adminInfo.userId,
      source:       'admin',
      notes:        notes || undefined,
      createdAt:    new Date(),
    };

    const result = await db.collection('stockLedger').insertOne(entry);

    return NextResponse.json({
      success: true,
      ledgerEntryId: result.insertedId,
      previousStock,
      newStock,
      delta,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Failed to create ledger entry:', error);
    return NextResponse.json({ error: 'Failed to create ledger entry' }, { status: 500 });
  }
}