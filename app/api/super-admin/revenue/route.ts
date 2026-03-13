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
    if (!adminInfo.isSuperAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Get all branches
    const branches = await db.collection('branches').find({}).toArray();

    // For each branch, run the same aggregations as /api/admin/stats
    const revenue = await Promise.all(
      branches.map(async (branch) => {
        const q = { branchId: branch._id };

        const [
          ordersAgg,
          totalOrders,
          completedOrders,
          poAgg,
          withdrawalsAgg,
        ] = await Promise.all([
          // totalRevenue — same as stats: sum ALL orders.total (no status filter)
          db.collection('orders').aggregate([
            { $match: q },
            { $group: { _id: null, total: { $sum: '$total' } } },
          ]).toArray(),

          db.collection('orders').countDocuments(q),

          db.collection('orders').countDocuments({ ...q, orderStatus: 'delivered' }),

          // PO total value
          db.collection('purchaseOrders').aggregate([
            { $match: q },
            { $group: { _id: null, total: { $sum: '$total' } } },
          ]).toArray(),

          // Withdrawals per status
          db.collection('withdrawalRequests').aggregate([
            { $match: { branchId: branch._id } },
            { $group: { _id: '$status', total: { $sum: '$amount' } } },
          ]).toArray(),
        ]);

        const totalRevenue = ordersAgg[0]?.total ?? 0;
        const poSpend      = poAgg[0]?.total ?? 0;

        let totalWithdrawn   = 0;
        let pendingWithdrawals = 0;
        withdrawalsAgg.forEach(r => {
          if (r._id === 'completed')                               totalWithdrawn   += r.total;
          if (['pending','approved','processing'].includes(r._id)) pendingWithdrawals += r.total;
        });

        const available = Math.max(totalRevenue - totalWithdrawn - pendingWithdrawals, 0);

        return {
          branchId:    String(branch._id),
          branchName:  branch.displayName,
          slug:        branch.slug,
          totalRevenue,
          totalOrders,
          completedOrders,
          poSpend,
          totalWithdrawn,
          pendingWithdrawals,
          available,
        };
      })
    );

    return NextResponse.json({ revenue });
  } catch (error) {
    console.error('Super admin revenue error:', error);
    return NextResponse.json({ error: 'Failed to fetch revenue data' }, { status: 500 });
  }
}