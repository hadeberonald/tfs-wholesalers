/**
 * app/api/admin/analytics/business/route.ts
 *
 * Cross-department "business intelligence" feed for the admin dashboard.
 * Gated behind a dedicated `analytics:read` permission so it's easy to hand
 * to exactly the roles you want (Full Access Admin + super-admin) without
 * tying it to any single resource permission.
 *
 * ── SETUP REQUIRED ──────────────────────────────────────────────────────────
 * 1. Add 'analytics:read' to the permission list your role editor pulls from
 *    (wherever getAllPermissions() in lib/route-manifest.ts builds its list —
 *    just add the string, no route-manifest magic needed since this is a
 *    manual permission, not derived from a CRUD route).
 * 2. Tick it on the "Full Access Admin" role in Admin > Roles. Super-admins
 *    bypass permission checks entirely (same as every other route here), so
 *    you don't need to do anything for them.
 *
 * Query params:
 *   from, to        — ISO date strings for the reporting window (required)
 *
 * All amounts are ZAR. "Revenue" always means paymentStatus === 'paid' —
 * payment_pending / payment_failed / declined / cancelled orders are never
 * counted as revenue, only as a "failed payments" signal for the team to
 * chase up.
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

// Orders have historically been written with either `status` or `orderStatus`
// depending on which route touched them — this reads whichever is set.
const STATUS_EXPR = { $ifNull: ['$orderStatus', '$status'] };

function pctGrowth(curr: number, prev: number): number | null {
  if (!prev) return curr > 0 ? null : 0; // null = "new" (no baseline), matches WhatsApp report convention
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission('analytics:read');
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sp = request.nextUrl.searchParams;
  const now = new Date();
  const to = sp.get('to') ? new Date(sp.get('to')!) : now;
  const from = sp.get('from') ? new Date(sp.get('from')!) : new Date(now.getTime() - 30 * 86400000);
  const diffMs = Math.max(to.getTime() - from.getTime(), 1);
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - diffMs);

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const branchQuery: any = auth.isSuperAdmin ? {} : { branchId: auth.branchId };
    const userBranchMatch: any = auth.isSuperAdmin
      ? {}
      : { $expr: { $eq: [{ $ifNull: ['$activeBranchId', '$branchId'] }, auth.branchId] } };

    const inWindow = (field: string, gte: Date, lte: Date) => ({ [field]: { $gte: gte, $lte: lte } });

    // ── SALES ──────────────────────────────────────────────────────────────
    const paidMatch = { ...branchQuery, paymentStatus: 'paid', ...inWindow('createdAt', from, to) };
    const paidMatchPrev = { ...branchQuery, paymentStatus: 'paid', ...inWindow('createdAt', prevFrom, prevTo) };
    const allOrdersMatch = { ...branchQuery, ...inWindow('createdAt', from, to) };

    const [
      revenueCurr, revenuePrev,
      dailyRevenue,
      orderStatusBreakdown,
      failedPayments,
      topCategoriesRaw,
      topProducts,
      customersCurr, customersPrev, newCustomers,
    ] = await Promise.all([
      db.collection('orders').aggregate([{ $match: paidMatch }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]).toArray(),
      db.collection('orders').aggregate([{ $match: paidMatchPrev }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]).toArray(),
      db.collection('orders').aggregate([
        { $match: paidMatch },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray(),
      db.collection('orders').aggregate([
        { $match: allOrdersMatch },
        { $group: { _id: STATUS_EXPR, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('orders').aggregate([
        { $match: { ...allOrdersMatch, $or: [{ paymentStatus: { $in: ['failed', 'declined', 'cancelled'] } }, { [STATUS_EXPR.$ifNull[0].slice(1)]: 'payment_pending' }] } },
        { $count: 'total' },
      ]).toArray().catch(() => []), // fallback below covers this more reliably
      db.collection('orders').aggregate([
        { $match: paidMatch },
        { $unwind: '$items' },
        {
          $addFields: {
            itemRevenue: { $multiply: [{ $ifNull: ['$items.price', 0] }, { $ifNull: ['$items.quantity', 0] }] },
            itemProductOid: { $convert: { input: '$items.productId', to: 'objectId', onError: null, onNull: null } },
          },
        },
        { $match: { itemProductOid: { $ne: null } } },
        { $group: { _id: '$itemProductOid', revenue: { $sum: '$itemRevenue' }, qty: { $sum: '$items.quantity' } } },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$product.categories', preserveNullAndEmptyArrays: true } },
        { $addFields: { categoryOid: { $convert: { input: '$product.categories', to: 'objectId', onError: null, onNull: null } } } },
        { $group: { _id: '$categoryOid', revenue: { $sum: '$revenue' }, qty: { $sum: '$qty' } } },
        { $match: { _id: { $ne: null } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
        { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, name: { $ifNull: ['$cat.name', 'Uncategorized'] }, revenue: 1, qty: 1 } },
        { $sort: { revenue: -1 } },
        { $limit: 8 },
      ]).toArray(),
      db.collection('orders').aggregate([
        { $match: paidMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: { $ifNull: ['$items.sku', '$items.name'] },
            name: { $first: '$items.name' },
            revenue: { $sum: { $multiply: [{ $ifNull: ['$items.price', 0] }, { $ifNull: ['$items.quantity', 0] }] } },
            qty: { $sum: '$items.quantity' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 8 },
      ]).toArray(),
      db.collection('orders').aggregate([{ $match: allOrdersMatch }, { $group: { _id: '$userId' } }, { $count: 'total' }]).toArray(),
      db.collection('orders').aggregate([{ $match: { ...branchQuery, ...inWindow('createdAt', prevFrom, prevTo) } }, { $group: { _id: '$userId' } }, { $count: 'total' }]).toArray(),
      db.collection('users').aggregate([
        { $match: { ...userBranchMatch, role: 'customer', ...inWindow('createdAt', from, to) } },
        { $count: 'total' },
      ]).toArray(),
    ]);

    // More reliable failed-payments count (the $or above can be flaky across
    // the two possible status field names, so recompute explicitly here)
    const failedPaymentsCount = await db.collection('orders').countDocuments({
      ...allOrdersMatch,
      $or: [
        { paymentStatus: { $in: ['failed', 'declined', 'cancelled'] } },
        { orderStatus: { $in: ['payment_pending', 'payment_failed'] } },
        { status: { $in: ['payment_pending', 'payment_failed'] } },
      ],
    });

    const totalOrdersAllStatuses = await db.collection('orders').countDocuments(allOrdersMatch);

    const totalRevenue = revenueCurr[0]?.total || 0;
    const totalOrders = revenueCurr[0]?.count || 0;
    const prevRevenue = revenuePrev[0]?.total || 0;
    const prevOrders = revenuePrev[0]?.count || 0;
    const aov = totalOrders ? totalRevenue / totalOrders : 0;
    const prevAov = prevOrders ? prevRevenue / prevOrders : 0;

    // ── BUYING / PROCUREMENT ──────────────────────────────────────────────
    const poMatch = { ...branchQuery, ...inWindow('createdAt', from, to) };
    const [
      poStatusBreakdown, poValueCurr, poValuePrev, topSuppliers,
      receivingStats, avgReceiveDays, pendingApprovalCount,
    ] = await Promise.all([
      db.collection('purchaseOrders').aggregate([{ $match: poMatch }, { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$total' } } }]).toArray(),
      db.collection('purchaseOrders').aggregate([{ $match: poMatch }, { $group: { _id: null, total: { $sum: '$total' } } }]).toArray(),
      db.collection('purchaseOrders').aggregate([{ $match: { ...branchQuery, ...inWindow('createdAt', prevFrom, prevTo) } }, { $group: { _id: null, total: { $sum: '$total' } } }]).toArray(),
      db.collection('purchaseOrders').aggregate([
        { $match: poMatch },
        { $group: { _id: '$supplierName', total: { $sum: '$total' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 6 },
      ]).toArray(),
      db.collection('poReceivings').aggregate([
        { $match: { ...branchQuery, ...inWindow('receivedAt', from, to) } },
        { $group: { _id: null, total: { $sum: 1 }, issues: { $sum: { $cond: ['$hasIssues', 1, 0] } } } },
      ]).toArray(),
      db.collection('poReceivings').aggregate([
        { $match: { ...branchQuery, ...inWindow('receivedAt', from, to) } },
        { $lookup: { from: 'purchaseOrders', localField: 'purchaseOrderId', foreignField: '_id', as: 'po' } },
        { $unwind: '$po' },
        { $addFields: { days: { $divide: [{ $subtract: ['$receivedAt', '$po.createdAt'] }, 1000 * 60 * 60 * 24] } } },
        { $group: { _id: null, avgDays: { $avg: '$days' } } },
      ]).toArray(),
      db.collection('purchaseOrders').countDocuments({ ...branchQuery, status: 'pending_approval' }),
    ]);

    // ── INVENTORY & FULFILLMENT ───────────────────────────────────────────
    const lowStockAgg = await db.collection('products').aggregate([
      { $match: { ...branchQuery, active: true, $expr: { $lte: ['$stockLevel', { $ifNull: ['$lowStockThreshold', 0] }] } } },
      { $count: 'total' },
    ]).toArray();

    const [
      stockTakeCounts, stockVariance, topOOS, resolutionsByType,
      avgFulfillmentAgg, pickerLeaderboard, driverLeaderboard,
    ] = await Promise.all([
      Promise.all([
        db.collection('stockTakes').countDocuments({ ...branchQuery, status: 'pending' }),
        db.collection('stockTakes').countDocuments({ ...branchQuery, status: 'pending', scheduledDate: { $lt: now } }),
        db.collection('stockTakes').countDocuments({ ...branchQuery, status: 'completed', ...inWindow('completedDate', from, to) }),
      ]).then(([pending, overdue, completed]) => ({ pending, overdue, completed })),
      db.collection('stockTakes').aggregate([
        { $match: { ...branchQuery, status: 'completed', ...inWindow('completedDate', from, to) } },
        { $group: { _id: null, totalVariance: { $sum: { $abs: '$variance' } } } },
      ]).toArray(),
      db.collection('orders').aggregate([
        { $match: { ...allOrdersMatch, 'items.oos': true } },
        { $unwind: '$items' },
        { $match: { 'items.oos': true } },
        { $group: { _id: { $ifNull: ['$items.sku', '$items.name'] }, name: { $first: '$items.name' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]).toArray(),
      db.collection('orderResolutions').aggregate([
        { $match: { ...branchQuery, ...inWindow('createdAt', from, to) } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('orders').aggregate([
        { $match: { ...branchQuery, $expr: { $eq: [STATUS_EXPR, 'delivered'] }, ...inWindow('updatedAt', from, to) } },
        { $addFields: { hours: { $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 1000 * 60 * 60] } } },
        { $group: { _id: null, avgHours: { $avg: '$hours' } } },
      ]).toArray(),
      db.collection('orders').aggregate([
        { $match: branchQuery },
        { $unwind: '$handlingLog' },
        {
          $match: {
            'handlingLog.eventType': { $in: ['item_picked_barcode', 'item_picked_manual'] },
            'handlingLog.timestamp': { $gte: from.toISOString(), $lte: to.toISOString() },
          },
        },
        { $group: { _id: '$handlingLog.actorName', items: { $sum: 1 } } },
        { $sort: { items: -1 } },
        { $limit: 6 },
      ]).toArray(),
      db.collection('orders').aggregate([
        { $match: branchQuery },
        { $unwind: '$handlingLog' },
        {
          $match: {
            'handlingLog.eventType': 'delivery_completed',
            'handlingLog.timestamp': { $gte: from.toISOString(), $lte: to.toISOString() },
          },
        },
        { $group: { _id: '$handlingLog.actorName', deliveries: { $sum: 1 } } },
        { $sort: { deliveries: -1 } },
        { $limit: 6 },
      ]).toArray(),
    ]);

    const openResolutions = await db.collection('orderResolutions').countDocuments({ ...branchQuery, status: 'open' });
    const highPriorityResolutions = await db.collection('orderResolutions').countDocuments({ ...branchQuery, status: 'open', priority: 'high' });

    // ── MARKETING ──────────────────────────────────────────────────────────
    const [
      specialsAgg, combosAgg, promoAgg, topPromoCodes,
      npsInStore, npsInStorePrev, npsDelivery, npsDeliveryPrev,
    ] = await Promise.all([
      db.collection('specials').aggregate([{ $match: branchQuery }, { $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: ['$active', 1, 0] } } } }]).toArray(),
      db.collection('combos').aggregate([{ $match: branchQuery }, { $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: ['$active', 1, 0] } } } }]).toArray(),
      db.collection('promoCodes').aggregate([{ $match: branchQuery }, { $group: { _id: null, totalUses: { $sum: '$usedCount' }, count: { $sum: 1 } } }]).toArray(),
      db.collection('promoCodes').find(branchQuery).sort({ usedCount: -1 }).limit(5).project({ code: 1, usedCount: 1 }).toArray(),
      db.collection('nps_responses').aggregate([
        { $match: { ...branchQuery, ...inWindow('submittedAt', from, to) } },
        { $group: { _id: null, total: { $sum: 1 }, promoters: { $sum: { $cond: [{ $gte: ['$score', 5] }, 1, 0] } }, detractors: { $sum: { $cond: [{ $lte: ['$score', 2] }, 1, 0] } } } },
      ]).toArray(),
      db.collection('nps_responses').aggregate([
        { $match: { ...branchQuery, ...inWindow('submittedAt', prevFrom, prevTo) } },
        { $group: { _id: null, total: { $sum: 1 }, promoters: { $sum: { $cond: [{ $gte: ['$score', 5] }, 1, 0] } }, detractors: { $sum: { $cond: [{ $lte: ['$score', 2] }, 1, 0] } } } },
      ]).toArray(),
      db.collection('nps_delivery_responses').aggregate([
        { $match: { ...branchQuery, ...inWindow('submittedAt', from, to) } },
        { $group: { _id: null, total: { $sum: 1 }, promoters: { $sum: { $cond: [{ $gte: ['$score', 5] }, 1, 0] } }, detractors: { $sum: { $cond: [{ $lte: ['$score', 2] }, 1, 0] } } } },
      ]).toArray(),
      db.collection('nps_delivery_responses').aggregate([
        { $match: { ...branchQuery, ...inWindow('submittedAt', prevFrom, prevTo) } },
        { $group: { _id: null, total: { $sum: 1 }, promoters: { $sum: { $cond: [{ $gte: ['$score', 5] }, 1, 0] } }, detractors: { $sum: { $cond: [{ $lte: ['$score', 2] }, 1, 0] } } } },
      ]).toArray(),
    ]);

    const npsScoreOf = (agg: any[]) => {
      const d = agg[0];
      if (!d || !d.total) return { score: 0, total: 0 };
      return { score: Math.round(((d.promoters - d.detractors) / d.total) * 100), total: d.total };
    };

    // ── PEOPLE ─────────────────────────────────────────────────────────────
    const [staffByRole, tillLinkedCustomers] = await Promise.all([
      db.collection('users').aggregate([
        { $match: { ...userBranchMatch, role: { $ne: 'customer' } } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('online_customers').countDocuments({
        ...(auth.isSuperAdmin ? {} : { $or: [{ branchId: auth.branchId }, { branchId: auth.branchId?.toString() }] }),
        tillAccountNumber: { $nin: [null, ''] },
      }),
    ]);

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      overview: {
        totalRevenue,
        revenueGrowth: pctGrowth(totalRevenue, prevRevenue),
        totalOrders,
        ordersGrowth: pctGrowth(totalOrders, prevOrders),
        totalOrdersAllStatuses,
        avgOrderValue: Math.round(aov * 100) / 100,
        aovGrowth: pctGrowth(aov, prevAov),
        failedPayments: failedPaymentsCount,
        failedPaymentRate: totalOrdersAllStatuses ? Math.round((failedPaymentsCount / totalOrdersAllStatuses) * 1000) / 10 : 0,
        totalCustomers: customersCurr[0]?.total || 0,
        customerGrowth: pctGrowth(customersCurr[0]?.total || 0, customersPrev[0]?.total || 0),
        newCustomers: newCustomers[0]?.total || 0,
      },
      sales: {
        dailyRevenue: dailyRevenue.map((d: any) => ({ date: d._id, revenue: d.revenue, orders: d.orders })),
        orderStatusBreakdown: Object.fromEntries(orderStatusBreakdown.map((s: any) => [s._id || 'unknown', s.count])),
        topCategories: topCategoriesRaw,
        topProducts,
      },
      buying: {
        poStatusBreakdown: Object.fromEntries(poStatusBreakdown.map((s: any) => [s._id || 'unknown', s.count])),
        totalPOValue: poValueCurr[0]?.total || 0,
        poValueGrowth: pctGrowth(poValueCurr[0]?.total || 0, poValuePrev[0]?.total || 0),
        topSuppliers,
        pendingApproval: pendingApprovalCount,
        receivingIssueRate: receivingStats[0]?.total ? Math.round((receivingStats[0].issues / receivingStats[0].total) * 1000) / 10 : 0,
        avgDaysToReceive: avgReceiveDays[0]?.avgDays ? Math.round(avgReceiveDays[0].avgDays * 10) / 10 : null,
      },
      fulfillment: {
        lowStockCount: lowStockAgg[0]?.total || 0,
        pendingStockTakes: stockTakeCounts.pending,
        overdueStockTakes: stockTakeCounts.overdue,
        completedStockTakes: stockTakeCounts.completed,
        stockVarianceTotal: stockVariance[0]?.totalVariance || 0,
        topOOSProducts: topOOS,
        resolutions: {
          open: openResolutions,
          highPriority: highPriorityResolutions,
          byType: Object.fromEntries(resolutionsByType.map((r: any) => [r._id || 'other', r.count])),
        },
        avgFulfillmentHours: avgFulfillmentAgg[0]?.avgHours ? Math.round(avgFulfillmentAgg[0].avgHours * 10) / 10 : null,
        pickerLeaderboard: pickerLeaderboard.map((p: any) => ({ name: p._id || 'Unknown', items: p.items })),
        driverLeaderboard: driverLeaderboard.map((d: any) => ({ name: d._id || 'Unknown', deliveries: d.deliveries })),
      },
      marketing: {
        specials: { active: specialsAgg[0]?.active || 0, total: specialsAgg[0]?.total || 0 },
        combos: { active: combosAgg[0]?.active || 0, total: combosAgg[0]?.total || 0 },
        promoRedemptions: promoAgg[0]?.totalUses || 0,
        promoCodeCount: promoAgg[0]?.count || 0,
        topPromoCodes: topPromoCodes.map((p: any) => ({ code: p.code, uses: p.usedCount || 0 })),
        npsInStore: { ...npsScoreOf(npsInStore), trend: npsScoreOf(npsInStore).score - npsScoreOf(npsInStorePrev).score },
        npsDelivery: { ...npsScoreOf(npsDelivery), trend: npsScoreOf(npsDelivery).score - npsScoreOf(npsDeliveryPrev).score },
      },
      people: {
        staffByRole: Object.fromEntries(staffByRole.map((s: any) => [s._id || 'unknown', s.count])),
        totalStaff: staffByRole.reduce((sum: number, s: any) => sum + s.count, 0),
        newCustomers: newCustomers[0]?.total || 0,
        tillLinkedCustomers,
      },
    });
  } catch (error) {
    console.error('[Business Analytics] Failed:', error);
    return NextResponse.json({ error: 'Failed to compute business analytics' }, { status: 500 });
  }
}