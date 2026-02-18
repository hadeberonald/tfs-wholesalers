import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getAdminBranch } from '@/lib/get-admin-branch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const adminInfo = await getAdminBranch();
    if ('error' in adminInfo) {
      return NextResponse.json({ error: adminInfo.error }, { status: adminInfo.status });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const branchQuery = adminInfo.isSuperAdmin 
      ? {} 
      : { branchId: adminInfo.branchId };

    // EXISTING STATS
    const totalOrders = await db.collection('orders').countDocuments(branchQuery);

    const revenueAgg = await db.collection('orders')
      .aggregate([
        { $match: branchQuery },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ])
      .toArray();
    const totalRevenue = revenueAgg[0]?.total || 0;

    const totalProducts = await db.collection('products').countDocuments({
      ...branchQuery,
      active: true
    });

    const customersAgg = await db.collection('orders')
      .aggregate([
        { $match: branchQuery },
        { $group: { _id: '$userId' } },
        { $count: 'total' }
      ])
      .toArray();
    const totalCustomers = customersAgg[0]?.total || 0;

    const pendingOrders = await db.collection('orders').countDocuments({
      ...branchQuery,
      orderStatus: 'pending'
    });

    const completedOrders = await db.collection('orders').countDocuments({
      ...branchQuery,
      orderStatus: 'delivered'
    });

    const cancelledOrders = await db.collection('orders').countDocuments({
      ...branchQuery,
      orderStatus: 'cancelled'
    });

    const outForDelivery = await db.collection('orders').countDocuments({
      ...branchQuery,
      orderStatus: 'out-for-delivery'
    });

    // Growth metrics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const previousRevenue = await db.collection('orders')
      .aggregate([
        {
          $match: {
            ...branchQuery,
            createdAt: { $lt: thirtyDaysAgo }
          }
        },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ])
      .toArray();

    const revenueGrowth = previousRevenue[0]?.total 
      ? Math.round(((totalRevenue - previousRevenue[0].total) / previousRevenue[0].total) * 100)
      : 0;

    const previousOrders = await db.collection('orders').countDocuments({
      ...branchQuery,
      createdAt: { $lt: thirtyDaysAgo }
    });

    const ordersGrowth = previousOrders
      ? Math.round(((totalOrders - previousOrders) / previousOrders) * 100)
      : 0;

    // PURCHASE ORDER STATS
    const totalPOs = await db.collection('purchaseOrders').countDocuments(branchQuery);

    const pendingPOApprovals = await db.collection('purchaseOrders').countDocuments({
      ...branchQuery,
      status: 'pending_approval'
    });

    const confirmedPOs = await db.collection('purchaseOrders').countDocuments({
      ...branchQuery,
      status: 'confirmed'
    });

    const sentPOs = await db.collection('purchaseOrders').countDocuments({
      ...branchQuery,
      status: 'sent'
    });

    const receivingPOs = await db.collection('purchaseOrders').countDocuments({
      ...branchQuery,
      status: { $in: ['sent', 'partially_received'] }
    });

    const poValueAgg = await db.collection('purchaseOrders')
      .aggregate([
        { $match: branchQuery },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ])
      .toArray();
    const totalPOValue = poValueAgg[0]?.total || 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPOActivity = await db.collection('purchaseOrders').countDocuments({
      ...branchQuery,
      createdAt: { $gte: sevenDaysAgo }
    });

    // ORDER RESOLUTIONS
    const openResolutions = await db.collection('orderResolutions').countDocuments({
      ...branchQuery,
      status: 'open'
    });

    const highPriorityResolutions = await db.collection('orderResolutions').countDocuments({
      ...branchQuery,
      status: 'open',
      priority: 'high'
    });

    // STOCK TAKES
    const pendingStockTakes = await db.collection('stockTakes').countDocuments({
      ...branchQuery,
      status: 'pending'
    });

    const overdueStockTakes = await db.collection('stockTakes').countDocuments({
      ...branchQuery,
      status: 'pending',
      scheduledDate: { $lt: new Date() }
    });

    const completedStockTakes = await db.collection('stockTakes').countDocuments({
      ...branchQuery,
      status: 'completed'
    });

    // LOW STOCK
    const lowStockProducts = await db.collection('products')
      .aggregate([
        { 
          $match: {
            ...branchQuery,
            active: true,
            $expr: { $lte: ['$stockLevel', '$lowStockThreshold'] }
          }
        },
        { $count: 'total' }
      ])
      .toArray();
    const lowStockCount = lowStockProducts[0]?.total || 0;

    return NextResponse.json({
      stats: {
        totalOrders,
        totalRevenue,
        totalProducts,
        totalCustomers,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        outForDelivery,
        revenueGrowth,
        ordersGrowth,
        purchaseOrders: {
          total: totalPOs,
          pendingApproval: pendingPOApprovals,
          confirmed: confirmedPOs,
          sent: sentPOs,
          awaitingReceiving: receivingPOs,
          totalValue: totalPOValue,
          recentActivity: recentPOActivity
        },
        inventory: {
          lowStockCount,
          pendingStockTakes,
          overdueStockTakes,
          completedStockTakes
        },
        resolutions: {
          open: openResolutions,
          highPriority: highPriorityResolutions
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}