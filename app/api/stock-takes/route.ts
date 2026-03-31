// app/api/stock-takes/route.ts
// CHANGE: GET now accepts both admin session cookies AND mobile Bearer tokens
// so the StockCountScreen on the picker app can fetch pending counts.
// POST is unchanged (admin-only).

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';
import { verifyMobileToken } from '@/lib/verify-mobile-token';

function calculateNextStockTake(interval: string): Date {
  const now = new Date();
  switch (interval) {
    case 'weekly':    return new Date(now.setDate(now.getDate() + 7));
    case 'biweekly':  return new Date(now.setDate(now.getDate() + 14));
    case 'monthly':   return new Date(now.setMonth(now.getMonth() + 1));
    case 'quarterly': return new Date(now.setMonth(now.getMonth() + 3));
    default:          return now;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status    = searchParams.get('status');
    const productId = searchParams.get('productId');
    const all       = searchParams.get('all');

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const query: any = {};

    // Mobile picker app (Bearer token) -------------------------------------
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
      if (!mobileUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Scope to the picker's active branch
      if (mobileUser.activeBranchId) {
        try {
          query.branchId = new ObjectId(mobileUser.activeBranchId);
        } catch {
          query.branchId = mobileUser.activeBranchId;
        }
      }

      // App only ever needs pending/in_progress counts
      if (status) {
        query.status = status;
      } else {
        query.status = { $in: ['pending', 'in_progress'] };
      }

      if (productId) {
        try { query.productId = new ObjectId(productId); } catch { query.productId = productId; }
      }

      const stockTakes = await db
        .collection('stockTakes')
        .find(query)
        .sort({
          // OOS-triggered first, then oldest scheduled date
          triggeredByOOS: -1,
          scheduledDate:   1,
        })
        .toArray();

      return NextResponse.json({
        stockTakes: stockTakes.map(st => ({ ...st, _id: st._id.toString() })),
      });
    }

    // Admin dashboard (session cookie) ------------------------------------
    if (all === 'true' || status || productId) {
      const adminInfo = await getAdminBranch();
      if ('error' in adminInfo) {
        return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
      }
      if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
        query.branchId = adminInfo.branchId;
      }
    }

    if (status)    query.status    = status;
    if (productId) query.productId = new ObjectId(productId);

    const stockTakes = await db
      .collection('stockTakes')
      .find(query)
      .sort({ scheduledDate: -1 })
      .toArray();

    return NextResponse.json({ stockTakes });
  } catch (error) {
    console.error('Failed to fetch stock takes:', error);
    return NextResponse.json({ error: 'Failed to fetch stock takes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const body   = await request.json();
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const product = await db.collection('products').findOne({
      _id:      new ObjectId(body.productId),
      branchId: adminInfo.branchId,
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    let expectedStock = product.stockLevel;
    let productName   = product.name;
    let variantName: string | undefined;
    let sku = product.sku;

    if (body.variantId && product.variants) {
      const variant = product.variants.find((v: any) => v._id === body.variantId);
      if (variant) {
        expectedStock = variant.stockLevel;
        variantName   = variant.name;
        sku           = variant.sku;
      }
    }

    const stockTake = {
      branchId:             adminInfo.branchId,
      productId:            new ObjectId(body.productId),
      variantId:            body.variantId || undefined,
      productName,
      variantName,
      sku,
      expectedStock,
      countedStock:         body.countedStock ?? 0,
      variance:             0,
      status:               body.countedStock !== undefined ? 'completed' : 'pending',
      scheduledDate:        body.scheduledDate ? new Date(body.scheduledDate) : new Date(),
      completedDate:        body.countedStock !== undefined ? new Date() : undefined,
      completedBy:          body.countedStock !== undefined ? adminInfo.userId : undefined,
      notes:                body.notes || '',
      autoScheduleInterval: body.autoScheduleInterval || 'never',
      nextScheduledDate:    body.autoScheduleInterval && body.autoScheduleInterval !== 'never'
        ? calculateNextStockTake(body.autoScheduleInterval)
        : undefined,
      createdAt:  new Date(),
      updatedAt:  new Date(),
    };

    if (body.countedStock !== undefined) {
      stockTake.variance = body.countedStock - expectedStock;
    }

    const result = await db.collection('stockTakes').insertOne(stockTake);

    // If immediately completed with a variance, update product stock
    if (body.countedStock !== undefined && stockTake.variance !== 0) {
      if (body.variantId) {
        await db.collection('products').updateOne(
          { _id: new ObjectId(body.productId), 'variants._id': body.variantId },
          { $set: { 'variants.$.stockLevel': body.countedStock, updatedAt: new Date() } }
        );
      } else {
        await db.collection('products').updateOne(
          { _id: new ObjectId(body.productId) },
          { $set: { stockLevel: body.countedStock, updatedAt: new Date() } }
        );
      }
    }

    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create stock take:', error);
    return NextResponse.json({ error: 'Failed to create stock take' }, { status: 500 });
  }
}