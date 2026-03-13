// app/api/revenue/stats/route.ts
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

    const branchQuery: any = {};
    if (!adminInfo.isSuperAdmin && adminInfo.branchId) {
      branchQuery.branchId = adminInfo.branchId;
    }

    // Total revenue from delivered orders
    const revenueResult = await db.collection('orders').aggregate([
      { $match: { ...branchQuery, orderStatus: 'delivered', paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]).toArray();

    const totalRevenue = revenueResult[0]?.total || 0;

    // This month revenue
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thisMonthResult = await db.collection('orders').aggregate([
      { $match: { ...branchQuery, orderStatus: 'delivered', paymentStatus: 'paid', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]).toArray();

    const lastMonthResult = await db.collection('orders').aggregate([
      { $match: { ...branchQuery, orderStatus: 'delivered', paymentStatus: 'paid', createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]).toArray();

    // Withdrawals
    const withdrawalsResult = await db.collection('withdrawalRequests').aggregate([
      { $match: { ...branchQuery, status: { $in: ['completed', 'processing', 'approved'] } } },
      { $group: { _id: '$status', total: { $sum: '$amount' } } },
    ]).toArray();

    let totalWithdrawn = 0;
    let pendingWithdrawals = 0;

    withdrawalsResult.forEach((r) => {
      if (r._id === 'completed') totalWithdrawn += r.total;
      else pendingWithdrawals += r.total;
    });

    const availableBalance = totalRevenue - totalWithdrawn - pendingWithdrawals;

    return NextResponse.json({
      stats: {
        totalRevenue,
        totalWithdrawn,
        pendingWithdrawals,
        availableBalance: Math.max(availableBalance, 0),
        thisMonthRevenue: thisMonthResult[0]?.total || 0,
        lastMonthRevenue: lastMonthResult[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error('Revenue stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch revenue stats' }, { status: 500 });
  }
}